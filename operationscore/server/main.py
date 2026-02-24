from fastapi import APIRouter, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from asyncio import Lock
from uuid import uuid4
import json
import logging
from .models import DeviceMetrics, ScoreReport, ScoreIssue
from .scoring.engine import calculate_score
from .state import device_metrics_cache, device_reports_cache, registered_devices, ws_clients
from .snapshot_store import build_snapshot, atomic_write_snapshot, risk_level as snapshot_risk_level
from . import config
from .http_errors import http_400, http_401, http_403, http_404, http_500

try:
    from .repository import (
        verify_register_credentials,
        upsert_device,
        is_registered,
        save_report,
        get_devices_list,
        get_device_history,
        get_fleet_history,
    )
    REPO_AVAILABLE = True
except ModuleNotFoundError:
    REPO_AVAILABLE = False
    print("WARN: server.repository missing; API endpoints will be disabled until repository is added")

    def verify_register_credentials(username: str, password: str):
        return (False, None)

    def upsert_device(*args, **kwargs):
        raise http_500("Repository layer not available")  # noqa: already a raise

    def is_registered(hostname: str) -> bool:
        return False

    def save_report(*args, **kwargs):
        return None

    def get_devices_list():
        return []

    def get_device_history(hostname: str, limit: int):
        return []

    def get_fleet_history(limit: int):
        return []


from .api_schemas import (
    RegisterRequest,
    RegisterResponse,
    DeviceListItem,
    DevicesListResponse,
    DeviceHistoryPoint,
    DeviceHistoryResponse,
    FleetHistoryPoint,
    FleetHistoryResponse,
)

# Configure logging
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Operational Health Scoring API",
    description="Modular rule-based operational health scoring engine for Linux system monitoring",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.get_allow_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Any, exc: RequestValidationError):
    return Response(
        content=json.dumps({"detail": "Validation error", "errors": exc.errors()}),
        status_code=400,
        media_type="application/json",
    )

from .snapshot_routes import router as snapshot_router

app.include_router(snapshot_router, prefix="/snapshot", tags=["Snapshot"])

api_router = APIRouter(prefix="/api", tags=["API"])


@api_router.post("/register", response_model=RegisterResponse)
async def api_register(req: RegisterRequest, request: Request):
    if not REPO_AVAILABLE:
        raise http_500("Repository layer not available")
    username = req.username.strip()
    if not username:
        raise http_400("username must not be empty")
    source_ip = request.client.host if request.client else None
    ok, role = verify_register_credentials(username, req.password)
    if not ok:
        logger.warning("REGISTER fail username=%s from_ip=%s", username, source_ip)
        raise http_401()
    upsert_device(hostname=req.hostname, registered_ip=req.ip, device_type=role, source_ip=source_ip)
    logger.info("REGISTER ok hostname=%s type=%s ip=%s from_ip=%s", req.hostname, role, req.ip, source_ip)
    return RegisterResponse(ok=True, device_type=role, message="Registered successfully")


@api_router.get("/devices", response_model=DevicesListResponse)
async def api_devices_list():
    if not REPO_AVAILABLE:
        raise http_500("Repository layer not available")
    items = get_devices_list()
    return DevicesListResponse(device_count=len(items), devices=[DeviceListItem(**item) for item in items])


@api_router.get("/devices/{hostname}/history", response_model=DeviceHistoryResponse)
async def api_device_history(hostname: str, limit: int = config.DEFAULT_DEVICE_HISTORY_LIMIT):
    if not REPO_AVAILABLE:
        raise http_500("Repository layer not available")
    if limit < 1 or limit > config.MAX_HISTORY_LIMIT:
        raise http_400("Invalid limit")
    try:
        points = get_device_history(hostname, limit)
    except KeyError:
        raise http_404(f"Device '{hostname}' not found")
    except Exception:
        logger.exception("get_device_history failed hostname=%s", hostname)
        raise http_500()
    # 200 with empty points when device exists but has no reports yet
    return DeviceHistoryResponse(hostname=hostname, points=[DeviceHistoryPoint(**p) for p in points])


@api_router.get("/fleet/history", response_model=FleetHistoryResponse)
async def api_fleet_history(limit: int = config.DEFAULT_FLEET_HISTORY_LIMIT):
    if not REPO_AVAILABLE:
        raise http_500("Repository layer not available")
    if limit < 1 or limit > config.MAX_HISTORY_LIMIT:
        raise http_400("Invalid limit")
    points = get_fleet_history(limit)
    return FleetHistoryResponse(points=[FleetHistoryPoint(**p) for p in points])


app.include_router(api_router)


# ============================================================================
# Phase 2: DB startup — init tables and seed bootstrap accounts
# ============================================================================

@app.on_event("startup")
async def on_startup() -> None:
    """Initialise SQLite DB and seed auth_accounts on every startup (idempotent)."""
    try:
        from .db import init_db, SessionLocal
        from .auth_seed import seed_auth_accounts
        init_db()
        db = SessionLocal()
        try:
            seed_auth_accounts(db)
        finally:
            db.close()
    except Exception as _e:
        logger.warning("on_startup DB init skipped: %s", _e)


# ============================================================================
# Pydantic Models
# ============================================================================

class Task(BaseModel):
    """
    Represents a task queued for execution on a specific device.
    
    Tasks are created asynchronously and retrieved by agents for processing.
    """
    
    task_id: str = Field(
        ...,
        description="Unique task identifier (UUID4)."
    )
    """Unique task ID (UUID)."""
    
    command: str = Field(
        ...,
        min_length=1,
        description="Command or action to execute on the device."
    )
    """Command/action to execute."""
    
    created_at: datetime = Field(
        ...,
        description="ISO 8601 timestamp when the task was created."
    )
    """When task was created."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "task_id": "550e8400-e29b-41d4-a716-446655440000",
                "command": "run_scan",
                "created_at": "2026-02-17T10:30:00Z"
            }
        }


class BroadcastRequest(BaseModel):
    """
    Request body for broadcasting a command to all known devices.

    Example:
        {
            "command": "run_scan"
        }
    """

    command: str = Field(
        ...,
        min_length=1,
        description="Command to enqueue on every known device (e.g., 'run_scan').",
    )

    class Config:
        json_schema_extra = {
            "example": {"command": "run_scan"}
        }


class BroadcastResponse(BaseModel):
    """
    Response returned after broadcasting a task to all devices.

    Contains the unique scan session identifier, the number of devices targeted,
    the command broadcast, and the timestamp when the broadcast was created.
    """

    run_id: str = Field(..., description="Unique scan session identifier (UUID4)")
    devices_targeted: int = Field(..., ge=0, description="Number of devices the task was queued for")
    command: str = Field(..., description="The broadcast command")
    timestamp: datetime = Field(..., description="When the broadcast was created")


class ScanSessionResponse(BaseModel):
    """
    Represents a scan session tracking the progress of a fleet-wide scan.
    
    Each scan session has a unique run_id and tracks the completion status
    of each registered device (pending or completed).
    """
    
    run_id: str = Field(
        ...,
        description="Unique scan session identifier (UUID4)."
    )
    """Unique scan session ID (UUID)."""
    
    created_at: datetime = Field(
        ...,
        description="ISO 8601 timestamp when the scan session was created."
    )
    """When scan session was created."""
    
    devices: Dict[str, str] = Field(
        ...,
        description="Device status map where each device hostname maps to 'pending' or 'completed'."
    )
    """Device scan status: {hostname: 'pending'|'completed'}."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "created_at": "2026-02-19T16:00:00Z",
                "devices": {
                    "prod-server-01": "completed",
                    "dev-server-02": "pending"
                }
            }
        }


class RegisteredDevice(BaseModel):
    """
    Represents a registered device in the multi-device registry.
    
    Tracks device hostname and the last time it submitted a health report.
    """
    
    hostname: str = Field(
        ...,
        description="The hostname of the registered device."
    )
    """Device hostname."""
    
    last_seen: datetime = Field(
        ...,
        description="ISO 8601 timestamp of the last report submission."
    )
    """When device last submitted a report."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "hostname": "prod-server-01",
                "last_seen": "2026-02-19T15:45:30Z"
            }
        }


# ============================================================================
# Multi-Device Cache Storage (In-Memory Only)
# ============================================================================
# device_metrics_cache, device_reports_cache, registered_devices imported from .state

# Store task queues for each device by hostname
# Format: {hostname: [Task, Task, ...]}  (FIFO queue)
task_queues: Dict[str, List[Task]] = {}

# Lock for thread-safe concurrent access to caches
cache_lock = Lock()

# Lock for thread-safe concurrent access to task queues
task_queue_lock = Lock()

# Lock for thread-safe concurrent access to device registry
device_registry_lock = Lock()

# Store active scan sessions by run_id
# Format: {run_id: {"created_at": datetime, "devices": {hostname: "pending"|"completed"}}}
scan_sessions: Dict[str, Dict] = {}

# Lock for thread-safe concurrent access to scan sessions
scan_session_lock = Lock()

# Current active run session ID (simplified tracking for POST /tasks/broadcast)
# Format: run_id (UUID4) or None if no active run
current_run_id: Optional[str] = None

# Single global run session storage by run_id (source of truth)
# Format: {run_id: {"run_id": str, "started_at": datetime, "reports": {hostname: ScoreReport}}}
run_sessions: Dict[str, Dict[str, Any]] = {}

# Lock for thread-safe concurrent access to run sessions
run_lock = Lock()


# WebSocket connection manager for real-time broadcasts
class ConnectionManager:
    """
    Manage active WebSocket client connections and broadcast JSON events.

    This lightweight manager stores active WebSocket connections and provides
    methods to register new connections, remove disconnected clients, and
    broadcast arbitrary JSON-serializable messages to all connected clients.

    Why broadcasting: when devices submit health reports to POST /report the
    server emits real-time events so frontend dashboards and monitoring UIs
    can react immediately (update progress bars, charts, or notifications)
    without polling the REST API.

    How frontends consume events: a frontend establishes a WebSocket
    connection to the `/ws` endpoint and listens for JSON messages. Each
    broadcast from `ws_manager.broadcast(...)` is delivered to all
    connected clients.
    """

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        try:
            self.active_connections.remove(websocket)
        except ValueError:
            pass

    async def broadcast(self, message: dict):
        # broadcast JSON message to all active connections
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                # ignore send errors and continue
                pass


# Global WebSocket manager instance
ws_manager = ConnectionManager()


async def broadcast_event(payload: dict) -> None:
    """
    Broadcast JSON payload to all connected WebSocket clients.
    On send failure, remove the client and continue.
    """
    for ws in list(ws_clients):
        try:
            await ws.send_json(payload)
        except Exception:
            ws_clients.discard(ws)


# ============================================================================
# Response Models for Multi-Device Endpoints
# ============================================================================

class DeviceScore(BaseModel):
    """
    Represents the latest operational health score for a single device.
    
    Contains the device hostname, metrics timestamp, calculated score,
    risk level classification, and detailed rule evaluation results.
    """
    
    hostname: str = Field(
        ...,
        description="The hostname of the device."
    )
    """Device hostname."""
    
    timestamp: datetime = Field(
        ...,
        description="ISO 8601 timestamp when metrics were collected."
    )
    """When metrics were collected."""
    
    final_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Operational health score (0-100). Higher is better."
    )
    """Final health score (0-100)."""
    
    risk_level: str = Field(
        ...,
        description="Risk classification: CRITICAL (0-33), HIGH (34-66), MEDIUM (67-79), LOW (80-100)."
    )
    """Risk level classification based on score."""
    
    issues: List[ScoreIssue] = Field(
        default_factory=list,
        description="List of all detected issues and their penalties."
    )
    """Detected health/security issues."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "hostname": "prod-server-01",
                "timestamp": "2026-02-16T10:30:00Z",
                "final_score": 85.0,
                "risk_level": "LOW",
                "issues": [
                    {
                        "rule_id": "K1",
                        "penalty": 5.0,
                        "message": "3 security updates are pending",
                        "recommendation": "Run 'sudo apt update && sudo apt upgrade'"
                    }
                ]
            }
        }


class LatestReportsResponse(BaseModel):
    """
    Response containing latest scores for all devices currently in cache.
    
    Provides a multi-device snapshot of operational health across the fleet.
    """
    
    device_count: int = Field(
        ...,
        ge=0,
        description="Number of devices in the cache."
    )
    """Number of devices reporting."""
    
    cache_timestamp: datetime = Field(
        ...,
        description="ISO 8601 timestamp of when this response was generated."
    )
    """When cache was queried."""
    
    devices: List[DeviceScore] = Field(
        default_factory=list,
        description="List of all devices with their latest scores."
    )
    """Latest scores for all devices."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "device_count": 2,
                "cache_timestamp": "2026-02-16T10:35:00Z",
                "devices": [
                    {
                        "hostname": "prod-server-01",
                        "timestamp": "2026-02-16T10:30:00Z",
                        "final_score": 85.0,
                        "risk_level": "LOW",
                        "issues": []
                    },
                    {
                        "hostname": "dev-server-02",
                        "timestamp": "2026-02-16T10:32:00Z",
                        "final_score": 62.0,
                        "risk_level": "HIGH",
                        "issues": [
                            {
                                "rule_id": "K2",
                                "penalty": 20.0,
                                "message": "Firewall is disabled",
                                "recommendation": "Enable UFW: sudo ufw enable"
                            }
                        ]
                    }
                ]
            }
        }


class DevicesResponse(BaseModel):
    """
    Response containing the list of registered devices in the device registry.
    
    Provides a snapshot of all devices that have submitted at least one report.
    """
    
    device_count: int = Field(
        ...,
        ge=0,
        description="Number of registered devices."
    )
    """Number of devices in registry."""
    
    devices: List[RegisteredDevice] = Field(
        default_factory=list,
        description="List of all registered devices with their last seen timestamps."
    )
    """Registered devices and last seen times."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "device_count": 2,
                "devices": [
                    {
                        "hostname": "prod-server-01",
                        "last_seen": "2026-02-19T15:45:30Z"
                    },
                    {
                        "hostname": "dev-server-02",
                        "last_seen": "2026-02-19T15:42:15Z"
                    }
                ]
            }
        }


# ============================================================================
# Helper Functions
# ============================================================================

def calculate_risk_level(score: float) -> str:
    """
    Classify risk level based on operational health score.
    
    Args:
        score: Health score from 0-100
        
    Returns:
        Risk level classification: CRITICAL, HIGH, MEDIUM, or LOW
    """
    if score < 34:
        return "CRITICAL"
    elif score < 67:
        return "HIGH"
    elif score < 80:
        return "MEDIUM"
    else:
        return "LOW"


@app.post(
    "/report",
    summary="Generate Operational Health Report",
    tags=["Reporting"]
)
async def create_report(metrics: DeviceMetrics, request: Request):
    """
    Generate an operational health report, cache it, rebuild snapshot, and broadcast.
    Server overwrites last_seen_minutes (K8) for zombie correctness.
    """
    client_ip: str = (request.client.host if request.client else None) or "unknown"

    # G1: Always enforce registration — no REPO_AVAILABLE fallback here
    if not is_registered(metrics.hostname):
        logger.info(
            "REPORT rejected not_registered hostname=%s from_ip=%s",
            metrics.hostname, client_ip,
        )
        raise http_403("Device not registered")

    try:
        now_dt = datetime.now(timezone.utc)

        # Server-side last_seen_minutes (K8) — overwrite agent value
        prev_dt = registered_devices.get(metrics.hostname)
        if prev_dt is not None and prev_dt.tzinfo is None:
            prev_dt = prev_dt.replace(tzinfo=timezone.utc)
        if prev_dt is None:
            mins = 0
        else:
            mins = round((now_dt - prev_dt).total_seconds() / 60)
        metrics = metrics.model_copy(update={"last_seen_minutes": max(0, mins)})

        report = calculate_score(metrics)

        # G2/G3: Persist exactly once, never crash on failure
        score_value = None
        if hasattr(report, "total_score"):
            score_value = report.total_score
        elif isinstance(report, dict) and "total_score" in report:
            score_value = report["total_score"]
        elif isinstance(report, dict) and "score" in report:
            score_value = report["score"]

        try:
            save_report(metrics.hostname, metrics, report, client_ip)
            logger.info(
                "REPORT stored hostname=%s from_ip=%s score=%s",
                metrics.hostname, client_ip, score_value,
            )
        except Exception as exc:
            logger.exception(
                "REPORT store_failed hostname=%s from_ip=%s err=%s",
                metrics.hostname, client_ip, str(exc),
            )
            # G3: do NOT re-raise — still return 200 with the computed score

        # Cache overwrite
        async with cache_lock:
            device_metrics_cache[metrics.hostname] = metrics
            device_reports_cache[metrics.hostname] = {"report": report, "scored_at": now_dt}

        async with device_registry_lock:
            registered_devices[metrics.hostname] = now_dt

        # Update scan session status if device belongs to a pending scan
        async with scan_session_lock:
            for run_id, session_data in scan_sessions.items():
                devices_map = session_data.get("devices", {})
                if metrics.hostname in devices_map and devices_map[metrics.hostname] == "pending":
                    devices_map[metrics.hostname] = "completed"

        # Store report in current run session if active
        async with run_lock:
            if current_run_id and current_run_id in run_sessions:
                run_sessions[current_run_id]["reports"][metrics.hostname] = report
                if metrics.hostname in run_sessions[current_run_id]["devices"]:
                    run_sessions[current_run_id]["devices"][metrics.hostname] = {
                        "status": "completed",
                        "report": report,
                    }
                    logger.debug(f"Attached report for {metrics.hostname} to run {current_run_id}")

        # Build snapshot and atomic overwrite (log on failure, still return 200)
        try:
            snapshot = build_snapshot(
                device_metrics_cache,
                device_reports_cache,
                registered_devices,
                now_iso=now_dt.isoformat(),
            )
            atomic_write_snapshot(snapshot)
        except Exception as e:
            logger.exception("Snapshot write failed: %s", e)

        # WebSocket broadcast (remove failed clients, continue)
        risk = snapshot_risk_level(report.total_score)
        try:
            await broadcast_event({
                "type": "snapshot_updated",
                "hostname": metrics.hostname,
                "score": report.total_score,
                "risk_level": risk,
                "generated_at": now_dt.isoformat(),
            })
        except Exception:
            logger.exception("WebSocket broadcast failed")

        issues_raw = getattr(report, "issues", None) or []
        issues_list = []
        for iss in issues_raw:
            if hasattr(iss, "model_dump"):
                issues_list.append(iss.model_dump())
            elif hasattr(iss, "dict"):
                issues_list.append(iss.dict())
            elif isinstance(iss, dict):
                issues_list.append(iss)

        return {
            "ok": True,
            "hostname": metrics.hostname,
            "score": report.total_score,
            "total_score": report.total_score,
            "risk_level": risk,
            "issues": issues_list,
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid metrics: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@app.get(
    "/health",
    summary="Health Check",
    tags=["System"]
)
async def health_check():
    """
    Check if the API is running.
    
    Returns:
        Health status of the API
    """
    return {
        "status": "healthy",
        "service": "Security Scoring API",
        "timestamp": datetime.now().isoformat()
    }


@app.get(
    "/rules",
    summary="List Available Rules",
    tags=["Scoring"]
)
async def list_rules():
    """
    Get information about all available health evaluation rules.
    
    Returns:
        List of rule IDs and their evaluation purposes
    """
    rules_info = [
        {
            "rule_id": "K1",
            "name": "Pending Package Updates",
            "description": "Checks for unpatched packages that threaten stability and security"
        },
        {
            "rule_id": "K2",
            "name": "Firewall Status",
            "description": "Verifies that UFW firewall is enabled"
        },
        {
            "rule_id": "K3",
            "name": "SSH Root Login",
            "description": "Ensures SSH root login is disabled to prevent direct attacks"
        },
        {
            "rule_id": "K4",
            "name": "Sudo User Privileges",
            "description": "Checks that sudo access is limited to necessary users (≤3)"
        },
        {
            "rule_id": "K5",
            "name": "Unnecessary Services",
            "description": "Identifies resource-wasting and unnecessary background services"
        },
        {
            "rule_id": "K6",
            "name": "Disk Usage",
            "description": "Monitors disk capacity to ensure system stability"
        },
        {
            "rule_id": "K7",
            "name": "Password Policy",
            "description": "Verifies that password policies meet compliance requirements"
        },
        {
            "rule_id": "K8",
            "name": "Zombie Device Detection",
            "description": "Identifies devices that haven't reported recently"
        }
    ]
    
    return {
        "total_rules": len(rules_info),
        "rules": rules_info
    }


@app.get(
    "/latest_reports",
    response_model=LatestReportsResponse,
    summary="Get Latest Reports for All Devices",
    tags=["Reporting"]
)
async def get_latest_reports():
    """
    Retrieve the latest operational health scores for all devices in cache.
    
    Returns a snapshot of all devices currently being monitored with their
    most recent metrics, health scores, risk levels, and detected issues.
    
    Returns:
        LatestReportsResponse containing:
            - device_count: Number of devices currently in cache
            - cache_timestamp: When this response was generated
            - devices: List of DeviceScore objects with:
                - hostname: Device identifier
                - timestamp: When metrics were collected
                - final_score: Health score (0-100)
                - risk_level: Classification (CRITICAL/HIGH/MEDIUM/LOW)
                - issues: List of detected issues and penalties
    
    Notes:
        - Returns only anlık (instant) data from in-memory cache
        - No historical data is stored
        - Device data persists in cache until server restarts
        - Devices are cached when POST /report is called with their metrics
    
    Example Response:
        {
            "device_count": 2,
            "cache_timestamp": "2026-02-16T10:35:00Z",
            "devices": [
                {
                    "hostname": "prod-server-01",
                    "timestamp": "2026-02-16T10:30:00Z",
                    "final_score": 85.0,
                    "risk_level": "LOW",
                    "issues": []
                },
                {
                    "hostname": "dev-server-02",
                    "timestamp": "2026-02-16T10:32:00Z",
                    "final_score": 62.0,
                    "risk_level": "HIGH",
                    "issues": [
                        {
                            "rule_id": "K2",
                            "penalty": 20.0,
                            "message": "Firewall is disabled",
                            "recommendation": "Enable UFW: sudo ufw enable"
                        }
                    ]
                }
            ]
        }
    """
    try:
        devices_list: List[DeviceScore] = []
        
        # Read cached reports safely
        async with cache_lock:
            for hostname, report_data in device_reports_cache.items():
                metrics = device_metrics_cache.get(hostname)
                report = report_data.get("report")
                
                if metrics and report:
                    device_score = DeviceScore(
                        hostname=hostname,
                        timestamp=metrics.timestamp,
                        final_score=report.total_score,
                        risk_level=calculate_risk_level(report.total_score),
                        issues=report.issues
                    )
                    devices_list.append(device_score)
        
        return LatestReportsResponse(
            device_count=len(devices_list),
            cache_timestamp=datetime.now(),
            devices=devices_list
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving cached reports: {str(e)}"
        )


@app.get(
    "/devices",
    response_model=DevicesResponse,
    summary="Get Registered Devices",
    tags=["Device Management"]
)
async def get_devices():
    """
    Retrieve the list of all registered devices in the device registry.
    
    Returns a snapshot of all devices that have submitted at least one health report.
    Each device entry includes the device hostname and the timestamp of its last
    report submission.
    
    The device registry is automatically maintained as devices submit health reports.
    When a device submits a health report via POST /report, it is automatically
    registered or updated in this registry with a fresh last_seen timestamp.
    
    Returns:
        DevicesResponse containing:
            - device_count: Total number of registered devices
            - devices: List of RegisteredDevice objects with:
                - hostname: Device identifier
                - last_seen: Timestamp of last report submission
    
    Notes:
        - Returns only devices that have submitted at least one report
        - This endpoint safely reads from the registry using async locks
        - Device data persists in registry until server restarts
        - Provides device discovery for fleet management queries
    
    Example Response:
        {
            "device_count": 2,
            "devices": [
                {
                    "hostname": "prod-server-01",
                    "last_seen": "2026-02-19T15:45:30Z"
                },
                {
                    "hostname": "dev-server-02",
                    "last_seen": "2026-02-19T15:42:15Z"
                }
            ]
        }
    """
    try:
        devices_list: List[RegisteredDevice] = []
        
        # Read device registry safely
        async with device_registry_lock:
            for hostname, last_seen in registered_devices.items():
                device = RegisteredDevice(
                    hostname=hostname,
                    last_seen=last_seen
                )
                devices_list.append(device)
        
        # Sort by hostname for consistent ordering
        devices_list.sort(key=lambda d: d.hostname)
        
        return DevicesResponse(
            device_count=len(devices_list),
            devices=devices_list
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving device registry: {str(e)}"
        )


@app.post(
    "/tasks/broadcast",
    response_model=BroadcastResponse,
    summary="Broadcast a Task to All Devices",
    tags=["Task Management"]
)
async def broadcast_tasks(request_body: BroadcastRequest):
        """
        Broadcast a scan command to every known device and create a scan session.

        Creates a new scan session that tracks the progress of a fleet-wide scan.
        For every hostname currently present in `registered_devices`, this endpoint will:
        1. Create a scan session with a unique run_id (UUID4)
        2. Initialize each device's scan status as "pending"
        3. Queue a "run_scan" task for each device
        4. Return the run_id and number of devices targeted

        The scan session can be monitored via the GET /scan_sessions/{run_id} endpoint.

        Request body example:
            {
                "command": "run_scan"
            }

        Returns a `BroadcastResponse` with:
            - run_id: Unique scan session identifier
            - devices_targeted: Number of devices the tasks were queued for
            - command: The broadcast command (always "run_scan" for consistency)
            - timestamp: When the broadcast was created

        Raises:
            HTTPException(400): If command is missing or invalid
            HTTPException(500): If broadcasting fails
        """
        try:
            command = request_body.command.strip()
            if not command:
                raise HTTPException(
                    status_code=400,
                    detail="Missing or empty 'command' field in request body"
                )

            # Generate unique run_id for this scan session
            run_id = str(uuid4())
            timestamp = datetime.now()
            
            # Read hostnames from SQLite (persistent) so registered devices are
            # visible even after a server restart, not just from the in-memory cache.
            if REPO_AVAILABLE:
                db_devices = get_devices_list()
                hostnames = [d["hostname"] for d in db_devices]
            else:
                hostnames = list(registered_devices.keys())

            devices_targeted = 0
            
            # Create scan session and queue tasks atomically
            async with task_queue_lock, scan_session_lock, run_lock:
                # Initialize scan session
                scan_sessions[run_id] = {
                    "created_at": timestamp,
                    "devices": {hostname: "pending" for hostname in hostnames}
                }
                
                # Initialize run session for tracking reports
                # devices dict tracks each device with status (pending/completed) and its report
                run_sessions[run_id] = {
                    "run_id": run_id,
                    "started_at": timestamp,
                    "reports": {},  # Keep for backward compatibility
                    "devices": {
                        hostname: {"status": "pending", "report": None}
                        for hostname in hostnames
                    }
                }
                logger.info(f"Created run {run_id} with {len(hostnames)} target devices")
                
                # Set current_run_id globally (will be used by POST /report)
                global current_run_id
                current_run_id = run_id
                
                # Queue tasks for each registered device
                for hostname in hostnames:
                    if hostname not in task_queues:
                        task_queues[hostname] = []
                    task = Task(
                        task_id=str(uuid4()),
                        command=command,
                        created_at=timestamp
                    )
                    task_queues[hostname].append(task)
                    devices_targeted += 1

            return BroadcastResponse(
                run_id=run_id,
                devices_targeted=devices_targeted,
                command=command,
                timestamp=timestamp
            )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error broadcasting task: {str(e)}"
            )


@app.post(
    "/tasks/{hostname}",
    response_model=Task,
    status_code=201,
    summary="Queue a Task for a Device",
    tags=["Task Management"]
)
async def create_task(hostname: str, request_body: dict):
    """
    Create and queue a new task for a specific device.
    
    Tasks are stored in an in-memory FIFO queue for the target device.
    Agents polling the device can retrieve tasks in FIFO order.
    
    Args:
        hostname: Target device hostname
        request_body: JSON body containing:
            - command: (required) Command or action to execute
    
    Returns:
        Task containing:
            - task_id: UUID4 identifier for this task
            - command: The queued command
            - created_at: Timestamp of task creation
    
    Raises:
        HTTPException(400): If command is missing or invalid
        HTTPException(500): If queueing fails
    
    Example Request:
        POST /tasks/prod-server-01
        {
            "command": "run_scan"
        }
    
    Example Response:
        {
            "task_id": "550e8400-e29b-41d4-a716-446655440000",
            "command": "run_scan",
            "created_at": "2026-02-17T10:30:00Z"
        }
    """
    try:
        # Validate command exists and is non-empty
        command = request_body.get("command", "").strip()
        if not command:
            raise HTTPException(
                status_code=400,
                detail="Missing or empty 'command' field in request body"
            )
        
        # Create task with UUID and current timestamp
        task = Task(
            task_id=str(uuid4()),
            command=command,
            created_at=datetime.now()
        )
        
        # Add task to device's queue (create queue if doesn't exist)
        async with task_queue_lock:
            if hostname not in task_queues:
                task_queues[hostname] = []
            task_queues[hostname].append(task)
        
        return task
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating task: {str(e)}"
        )


@app.get(
    "/tasks/{hostname}",
    summary="Dequeue a Task for a Device",
    tags=["Task Management"]
)
async def get_task(hostname: str, response: Response):
    """
    Retrieve and remove the oldest pending task for a device.
    
    Implements FIFO (First-In-First-Out) queue semantics. Returns the oldest
    task in the queue for the device and removes it. Subsequent calls will
    return the next task in line.
    
    Args:
        hostname: Target device hostname
    
    Returns:
        Task containing:
            - task_id: UUID4 identifier for this task
            - command: The queued command
            - created_at: Timestamp of task creation
    
    Returns 204 No Content if:
        - No queue exists for this hostname, OR
        - Queue is empty (all tasks already retrieved)
    
    Raises:
        HTTPException(500): If dequeuing fails
    
    Example Request:
        GET /tasks/prod-server-01
    
    Example Response (when tasks are pending):
        {
            "task_id": "550e8400-e29b-41d4-a716-446655440000",
            "command": "run_scan",
            "created_at": "2026-02-17T10:30:00Z"
        }
    
    Example Response (when no tasks pending):
        HTTP/1.1 204 No Content
    """
    try:
        # Retrieve and remove oldest task (FIFO)
        async with task_queue_lock:
            # Check if queue exists and has tasks
            if hostname not in task_queues or not task_queues[hostname]:
                # No tasks - return 204 No Content
                response.status_code = 204
                return
            
            # Pop oldest task from queue (index 0 = FIFO)
            task = task_queues[hostname].pop(0)
        
        return task
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving task: {str(e)}"
        )


@app.get(
    "/scan_sessions/{run_id}",
    response_model=ScanSessionResponse,
    summary="Get Scan Session Status",
    tags=["Scan Sessions"]
)
async def get_scan_session(run_id: str):
    """
    Retrieve the current status of a scan session.
    
    Returns detailed information about a specific scan session including when it was
    created and the current completion status of each registered device in the scan.
    
    Args:
        run_id: The unique scan session identifier (UUID4) returned by POST /tasks/broadcast
    
    Returns:
        ScanSessionResponse containing:
            - run_id: The scan session identifier
            - created_at: When the scan session was initiated
            - devices: Map of device statuses:
                - "pending": Device has not yet submitted a report for this scan
                - "completed": Device has submitted a report after scan creation
    
    Raises:
        HTTPException(404): If the scan session does not exist
        HTTPException(500): If retrieval fails
    
    Example Request:
        GET /scan_sessions/550e8400-e29b-41d4-a716-446655440000
    
    Example Response (in progress):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "created_at": "2026-02-19T16:00:00Z",
            "devices": {
                "prod-server-01": "completed",
                "dev-server-02": "pending"
            }
        }
    
    Example Response (completed):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "created_at": "2026-02-19T16:00:00Z",
            "devices": {
                "prod-server-01": "completed",
                "dev-server-02": "completed"
            }
        }
    """
    try:
        # Retrieve scan session safely
        async with scan_session_lock:
            if run_id not in scan_sessions:
                raise HTTPException(
                    status_code=404,
                    detail=f"Scan session '{run_id}' not found"
                )
            
            session_data = scan_sessions[run_id]
            return ScanSessionResponse(
                run_id=run_id,
                created_at=session_data["created_at"],
                devices=session_data["devices"]
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving scan session: {str(e)}"
        )


# ============================================================================
# Run Session Models
# ============================================================================

class RunSession(BaseModel):
    """
    Represents a run session that tracks device scanning progress.
    
    Each run session targets a set of registered devices and tracks
    completion status in real-time as reports are submitted.
    """
    
    run_id: str = Field(..., description="Unique run session identifier (UUID4)")
    started_at: datetime = Field(..., description="When the run session was initiated")
    expected_devices: List[str] = Field(
        ...,
        description="List of all device hostnames targeted in this run"
    )
    completed_devices: Dict[str, str] = Field(
        default_factory=dict,
        description="Map of hostname to device status (pending or completed)"
    )
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "started_at": "2026-02-19T16:00:00Z",
                "expected_devices": ["prod-server-01", "dev-server-02", "test-server-03"],
                "completed_devices": {
                    "prod-server-01": "completed",
                    "dev-server-02": "pending",
                    "test-server-03": "completed"
                }
            }
        }


# Response model for run progress endpoint
class RunProgress(BaseModel):
    """
    Real-time progress aggregation for a run session.
    
    Provides completion metrics including device count, completion status,
    and overall progress percentage.
    """
    
    run_id: str = Field(..., description="Unique run session identifier (UUID4)")
    total_devices: int = Field(..., ge=0, description="Total number of devices targeted")
    completed: int = Field(..., ge=0, description="Number of devices that have submitted reports")
    pending: int = Field(..., ge=0, description="Number of devices still awaiting reports")
    completion_percent: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Progress as percentage (0-100)"
    )
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "total_devices": 10,
                "completed": 7,
                "pending": 3,
                "completion_percent": 70.0
            }
        }


# Response model for run start endpoint
class RunStartResponse(BaseModel):
    """
    Response returned when starting a new run session.
    
    Contains the run_id, list of target devices, and session creation timestamp.
    """
    
    run_id: str = Field(..., description="Unique run session identifier (UUID4)")
    target_devices: List[str] = Field(..., description="List of device hostnames targeted by this run")
    started_at: datetime = Field(..., description="When the run session was created")
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "target_devices": ["prod-server-01", "dev-server-02"],
                "started_at": "2026-02-19T16:00:00Z"
            }
        }


# Response model for simplified run session summary
class RunSummary(BaseModel):
    """
    Lightweight summary of a run session.
    
    Used in list endpoints to provide a quick overview of run sessions.
    """
    
    run_id: str = Field(..., description="Unique run session identifier (UUID4)")
    started_at: datetime = Field(..., description="When the run session was started")
    device_count: int = Field(..., ge=0, description="Number of devices that submitted reports in this run")
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "started_at": "2026-02-19T16:00:00Z",
                "device_count": 2
            }
        }


# Response model for device status within a run
class RunDeviceStatus(BaseModel):
    """
    Device status and report within a run session.
    
    Tracks whether a device has completed reporting and includes the full report
    if available, or null if still pending.
    """
    
    status: str = Field(
        ...,
        description="Device status: 'completed' if report received, 'pending' if waiting"
    )
    report: Optional[DeviceScore] = Field(
        default=None,
        description="Full device score report if completed, null if pending"
    )
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "status": "completed",
                "report": {
                    "hostname": "prod-server-01",
                    "timestamp": "2026-02-19T16:05:00Z",
                    "final_score": 85.0,
                    "risk_level": "LOW",
                    "issues": []
                }
            }
        }


# Response model for detailed run information
class RunDetail(BaseModel):
    """
    Complete details of a run session including all device reports and status.
    
    Provides full run metadata with device completion status and operational health 
    scores for all target devices, including pending devices with null reports.
    """
    
    run_id: str = Field(..., description="Unique run session identifier (UUID4)")
    started_at: datetime = Field(..., description="When the run session was started")
    devices: Dict[str, RunDeviceStatus] = Field(
        ...,
        description="All target devices with their completion status and reports"
    )
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "started_at": "2026-02-19T16:00:00Z",
                "devices": {
                    "prod-server-01": {
                        "status": "completed",
                        "report": {
                            "hostname": "prod-server-01",
                            "timestamp": "2026-02-19T16:05:00Z",
                            "final_score": 85.0,
                            "risk_level": "LOW",
                            "issues": []
                        }
                    },
                    "dev-server-02": {
                        "status": "pending",
                        "report": None
                    }
                }
            }
        }


# Response model for run status endpoint
class RunStatusResponse(BaseModel):
    """
    Response containing the current status of a run session.
    
    Includes run metadata, target devices, completion status, and received reports.
    """
    
    run_id: str = Field(..., description="Unique run session identifier (UUID4)")
    started_at: datetime = Field(..., description="When the run session was created")
    target_devices: List[str] = Field(..., description="List of target device hostnames")
    completed_devices: List[str] = Field(
        ..., 
        description="Devices that have submitted reports for this run"
    )
    pending_devices: List[str] = Field(
        ..., 
        description="Target devices that have not yet submitted reports"
    )
    reports: Dict[str, DeviceMetrics] = Field(
        ..., 
        description="Device metrics reports received from participants"
    )
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "started_at": "2026-02-19T16:00:00Z",
                "target_devices": ["prod-server-01", "dev-server-02"],
                "completed_devices": ["prod-server-01"],
                "pending_devices": ["dev-server-02"],
                "reports": {
                    "prod-server-01": {
                        "hostname": "prod-server-01",
                        "timestamp": "2026-02-19T16:05:00Z",
                        "update_count": 3,
                        "firewall_enabled": True,
                        "ssh_root_login_allowed": False,
                        "sudo_users_count": 2,
                        "unnecessary_services": [],
                        "disk_usage_percent": 45,
                        "password_policy_ok": True,
                        "last_seen_minutes": 5
                    }
                }
            }
        }


# Response model for run summary endpoint
class RunSummaryDetail(BaseModel):
    """
    Summary statistics for a run session.
    
    Provides high-level metrics about run completion and operational health scores
    across all target devices.
    """
    
    run_id: str = Field(..., description="Unique run session identifier (UUID4)")
    total_devices: int = Field(..., ge=0, description="Total number of devices targeted in this run")
    completed_devices: int = Field(..., ge=0, description="Number of devices that submitted reports")
    pending_devices: int = Field(..., ge=0, description="Number of devices still awaiting reports")
    average_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Average operational health score of completed devices (null if no devices completed)"
    )
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "run_id": "550e8400-e29b-41d4-a716-446655440000",
                "total_devices": 3,
                "completed_devices": 2,
                "pending_devices": 1,
                "average_score": 75.5
            }
        }


@app.post(
    "/runs/start",
    response_model=RunStartResponse,
    status_code=201,
    summary="Start a New Run Session",
    tags=["Run Sessions"]
)
async def start_run():
    """
    Initiate a new run session that orchestrates scans across all registered devices.
    
    Creates a new run session, snapshots all currently registered devices as targets,
    and broadcasts a "run_scan" task to each device. The run session tracks which
    devices have submitted reports and coordinates multi-device scanning operations.
    
    Returns:
        RunStartResponse containing:
            - run_id: Unique run session identifier (UUID4)
            - target_devices: List of device hostnames targeted for this run
            - started_at: When the run session was created
    
    The run session can be monitored via the GET /runs/{run_id} endpoint.
    
    Raises:
        HTTPException(500): If run initialization fails
    
    Example Request:
        POST /runs/start
    
    Example Response:
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "target_devices": ["prod-server-01", "dev-server-02"],
            "started_at": "2026-02-19T16:00:00Z"
        }
    """
    try:
        # Snapshot currently registered devices as targets
        async with device_registry_lock:
            target_devices = list(registered_devices.keys())
        
        # Generate run_id and timestamp
        run_id = str(uuid4())
        started_at = datetime.now()
        
        # Initialize run session in single global storage
        async with run_lock:
            run_sessions[run_id] = {
                "run_id": run_id,
                "started_at": started_at,
                "reports": {},  # Keep for backward compatibility
                "devices": {
                    hostname: {"status": "pending", "report": None}
                    for hostname in target_devices
                }
            }
            logger.info(f"Started run {run_id} with {len(target_devices)} target devices")
            
            # Set current_run_id globally (will be used by POST /report)
            global current_run_id
            current_run_id = run_id
        
        # Broadcast "run_scan" task to all target devices
        devices_targeted = 0
        async with task_queue_lock:
            for hostname in target_devices:
                if hostname not in task_queues:
                    task_queues[hostname] = []
                task = Task(
                    task_id=str(uuid4()),
                    command="run_scan",
                    created_at=started_at
                )
                task_queues[hostname].append(task)
                devices_targeted += 1
        
        return RunStartResponse(
            run_id=run_id,
            target_devices=target_devices,
            started_at=started_at
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error starting run session: {str(e)}"
        )


@app.get(
    "/runs",
    summary="List All Run Sessions",
    tags=["Run Sessions"]
)
async def list_runs() -> Dict[str, Any]:
    """
    Retrieve a list of all run sessions with summary information.
    
    Returns a summary of all run sessions including when they started
    and how many devices submitted reports during each run.
    
    Returns:
        Dictionary containing:
            - run_count: Total number of runs executed
            - runs: List of RunSummary objects with:
                - run_id: Session identifier
                - started_at: When the run started
                - device_count: Devices that reported in this run
    
    Notes:
        - Returns empty list if no runs have been executed
        - Runs persist in memory until server restarts
    
    Example Response:
        {
            "run_count": 2,
            "runs": [
                {
                    "run_id": "550e8400-e29b-41d4-a716-446655440000",
                    "started_at": "2026-02-19T16:00:00Z",
                    "device_count": 2
                },
                {
                    "run_id": "660f9501-f40c-52e5-b827-557766551111",
                    "started_at": "2026-02-19T16:15:00Z",
                    "device_count": 1
                }
            ]
        }
    """
    try:
        runs_list: List[RunSummary] = []
        
        # Read all run sessions safely
        async with run_lock:
            for run_id, run_data in run_sessions.items():
                device_count = len(run_data.get("reports", {}))
                summary = RunSummary(
                    run_id=run_id,
                    started_at=run_data["started_at"],
                    device_count=device_count
                )
                runs_list.append(summary)
        
        # Sort by started_at descending (newest first)
        runs_list.sort(key=lambda r: r.started_at, reverse=True)
        logger.debug(f"Retrieved {len(runs_list)} run sessions")
        
        return {
            "run_count": len(runs_list),
            "runs": runs_list
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving run sessions: {str(e)}"
        )


@app.get(
    "/runs/{run_id}",
    response_model=RunDetail,
    summary="Get Run Session Details",
    tags=["Run Sessions"]
)
async def get_run_detail(run_id: str):
    """
    Retrieve detailed information about a specific run session.
    
    Returns the complete run session including all device reports and their
    operational health scores collected during that run.
    
    Args:
        run_id: The unique run session identifier (UUID4)
    
    Returns:
        RunDetail containing:
            - run_id: The session identifier
            - started_at: When the run was initiated
            - devices: Dictionary of all target devices with their status and reports
                - Each entry has status ("completed" or "pending") and report (DeviceScore or null)
    
    Raises:
        HTTPException(404): If the run session does not exist
        HTTPException(500): If retrieval fails
    
    Example Request:
        GET /runs/550e8400-e29b-41d4-a716-446655440000
    
    Example Response:
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "started_at": "2026-02-19T16:00:00Z",
            "devices": {
                "prod-server-01": {
                    "status": "completed",
                    "report": {
                        "hostname": "prod-server-01",
                        "timestamp": "2026-02-19T16:05:00Z",
                        "final_score": 85.0,
                        "risk_level": "LOW",
                        "issues": []
                    }
                },
                "dev-server-02": {
                    "status": "pending",
                    "report": null
                }
            }
        }
    """
    try:
        # Retrieve run session safely
        async with run_lock:
            if run_id not in run_sessions:
                logger.warning(f"Run ID not found: {run_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Run session '{run_id}' not found"
                )
            
            run_data = run_sessions[run_id]
            logger.debug(f"Retrieved run {run_id} with {len(run_data.get('devices', {}))} target devices")
            
            # Convert stored device status/reports to RunDeviceStatus objects
            device_status_map: Dict[str, RunDeviceStatus] = {}
            for hostname, device_info in run_data.get("devices", {}).items():
                status = device_info.get("status", "pending")
                raw_report = device_info.get("report")
                
                # Convert raw report to DeviceScore if completed
                device_score = None
                if status == "completed" and raw_report:
                    # Get the metrics from cache for timestamp
                    async with cache_lock:
                        metrics = device_metrics_cache.get(hostname)
                    
                    if metrics:
                        device_score = DeviceScore(
                            hostname=hostname,
                            timestamp=metrics.timestamp,
                            final_score=raw_report.total_score,
                            risk_level=calculate_risk_level(raw_report.total_score),
                            issues=raw_report.issues
                        )
                
                device_status_map[hostname] = RunDeviceStatus(
                    status=status,
                    report=device_score
                )
            
            return RunDetail(
                run_id=run_id,
                started_at=run_data["started_at"],
                devices=device_status_map
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving run details: {str(e)}"
        )


@app.get(
    "/runs/{run_id}/summary",
    response_model=RunSummaryDetail,
    summary="Get Run Session Summary",
    tags=["Run Sessions"]
)
async def get_run_summary(run_id: str):
    """
    Retrieve summary statistics for a run session.
    
    Returns high-level metrics about run completion, device participation,
    and average operational health score across all devices in the run.
    
    Args:
        run_id: The unique run session identifier (UUID4)
    
    Returns:
        RunSummaryDetail containing:
            - run_id: The session identifier
            - total_devices: Total number of devices targeted
            - completed_devices: Number of devices that submitted reports
            - pending_devices: Number of devices still awaiting reports
            - average_score: Average health score of completed devices, or null if none completed
    
    Raises:
        HTTPException(404): If the run session does not exist
        HTTPException(500): If retrieval fails
    
    Example Request:
        GET /runs/550e8400-e29b-41d4-a716-446655440000/summary
    
    Example Response (mixed pending and completed):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "total_devices": 3,
            "completed_devices": 2,
            "pending_devices": 1,
            "average_score": 75.5
        }
    
    Example Response (all devices completed):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "total_devices": 2,
            "completed_devices": 2,
            "pending_devices": 0,
            "average_score": 82.3
        }
    
    Example Response (no devices completed):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "total_devices": 2,
            "completed_devices": 0,
            "pending_devices": 2,
            "average_score": null
        }
    """
    try:
        # Retrieve run session safely
        async with run_lock:
            if run_id not in run_sessions:
                logger.warning(f"Run ID not found for summary: {run_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Run session '{run_id}' not found"
                )
            
            run_data = run_sessions[run_id]
            devices_dict = run_data.get("devices", {})
            
            # Calculate statistics
            total_devices = len(devices_dict)
            completed_devices = 0
            pending_devices = 0
            total_score = 0.0
            
            for hostname, device_info in devices_dict.items():
                status = device_info.get("status", "pending")
                
                if status == "completed":
                    completed_devices += 1
                    raw_report = device_info.get("report")
                    
                    # Accumulate score from completed devices
                    if raw_report and hasattr(raw_report, "total_score"):
                        total_score += raw_report.total_score
                else:
                    pending_devices += 1
            
            # Calculate average score
            average_score = None
            if completed_devices > 0:
                average_score = total_score / completed_devices
            
            logger.debug(
                f"Run {run_id} summary: {total_devices} total, "
                f"{completed_devices} completed, {pending_devices} pending, "
                f"avg_score={average_score}"
            )
            
            return RunSummaryDetail(
                run_id=run_id,
                total_devices=total_devices,
                completed_devices=completed_devices,
                pending_devices=pending_devices,
                average_score=average_score
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving run summary: {str(e)}"
        )


@app.get(
    "/runs/{run_id}/progress",
    response_model=RunProgress,
    summary="Get Run Session Progress",
    tags=["Run Sessions"]
)
async def get_run_progress(run_id: str):
    """
    Retrieve real-time progress aggregation for a run session.
    
    Returns completion metrics showing how many devices have submitted reports
    and the overall progress percentage for the run.
    
    Args:
        run_id: The unique run session identifier (UUID4)
    
    Returns:
        RunProgress containing:
            - run_id: The session identifier
            - total_devices: Total devices targeted in this run
            - completed: Count of devices that submitted reports
            - pending: Count of devices still awaiting reports
            - completion_percent: Progress percentage (0-100)
    
    Raises:
        HTTPException(404): If the run session does not exist
        HTTPException(500): If retrieval fails
    
    Example Request:
        GET /runs/550e8400-e29b-41d4-a716-446655440000/progress
    
    Example Response (in progress):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "total_devices": 10,
            "completed": 3,
            "pending": 7,
            "completion_percent": 30.0
        }
    
    Example Response (all complete):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "total_devices": 10,
            "completed": 10,
            "pending": 0,
            "completion_percent": 100.0
        }
    
    Example Response (no reports yet):
        {
            "run_id": "550e8400-e29b-41d4-a716-446655440000",
            "total_devices": 10,
            "completed": 0,
            "pending": 10,
            "completion_percent": 0.0
        }
    """
    try:
        # Retrieve run session safely
        async with run_lock:
            if run_id not in run_sessions:
                logger.warning(f"Run ID not found for progress: {run_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Run session '{run_id}' not found"
                )
            
            run_data = run_sessions[run_id]
            devices_dict = run_data.get("devices", {})
            
            # Calculate progress metrics
            total_devices = len(devices_dict)
            completed = 0
            pending = 0
            
            for hostname, device_info in devices_dict.items():
                status = device_info.get("status", "pending")
                if status == "completed":
                    completed += 1
                else:
                    pending += 1
            
            # Calculate completion percentage
            completion_percent = 0.0
            if total_devices > 0:
                completion_percent = (completed / total_devices) * 100.0
            
            logger.debug(
                f"Run {run_id} progress: {completed}/{total_devices} devices "
                f"({completion_percent:.1f}% complete)"
            )
            
            return RunProgress(
                run_id=run_id,
                total_devices=total_devices,
                completed=completed,
                pending=pending,
                completion_percent=completion_percent
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving run progress: {str(e)}"
        )

# ============================================================================
# Phase 3: Auth / Register / Dashboard API Routes
# ============================================================================

class _RegisterPayload(BaseModel):
    hostname: str
    ip: str
    username: str
    password: str


@app.post(
    "/api/register",
    summary="Register a Device",
    tags=["Auth"],
)
async def api_register(payload: _RegisterPayload, request: Request):
    """
    Authenticate with username/password and register the device.
    Returns device_type (SERVER or CLIENT) on success, 401 on failure.
    """
    ok, role = verify_register_credentials(payload.username, payload.password)
    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials or registration not permitted.")
    source_ip = request.client.host if request.client else payload.ip
    upsert_device(payload.hostname, payload.ip, role, source_ip=source_ip)
    return {"ok": True, "device_type": role, "hostname": payload.hostname}


@app.get(
    "/api/devices",
    summary="List All Devices (DB)",
    tags=["Dashboard"],
)
async def api_devices_list():
    """Return all registered devices with latest score and improvement_total."""
    return get_devices_list()


@app.get(
    "/api/devices/{hostname}/history",
    summary="Device Score History",
    tags=["Dashboard"],
)
async def api_device_history(hostname: str, limit: int = 100):
    """Return the last *limit* score history points for a device (ascending)."""
    try:
        return get_device_history(hostname, limit)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get(
    "/api/fleet/history",
    summary="Fleet History (bucketed by minute)",
    tags=["Dashboard"],
)
async def api_fleet_history(limit: int = 200):
    """Return fleet-wide score history bucketed by minute."""
    return get_fleet_history(limit)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time snapshot updates.
    On connect: add to ws_clients. On disconnect: remove from ws_clients.
    """
    await ws_manager.connect(websocket)
    ws_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)
        ws_clients.discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
