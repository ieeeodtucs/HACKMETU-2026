"""
server/repository.py — All DB logic for OperationScore.

Each function opens its own SessionLocal, does its work, commits, and closes.
No db: Session parameter is passed by the caller.
"""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

import bcrypt
from sqlalchemy import asc, desc

from server.db import SessionLocal
from server.db_models import AuthAccount, Device, DeviceReport

MAX_REPORTS_PER_DEVICE = 500


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: Any) -> datetime:
    """Parse ISO-8601 timestamp → timezone-aware UTC datetime."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            from dateutil.parser import isoparse
            dt = isoparse(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass
        try:
            dt = datetime.fromisoformat(value)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return _utcnow()


def _derive_risk_level(score: float) -> str:
    if score < 40:
        return "CRITICAL"
    if score < 60:
        return "HIGH"
    if score < 75:
        return "MEDIUM"
    if score < 90:
        return "LOW"
    return "EXCELLENT"


def _get_score(report: Any) -> float:
    if hasattr(report, "total_score"):
        return float(report.total_score)
    if isinstance(report, dict):
        return float(report.get("total_score", 0.0))
    return 0.0


def _get_risk_level(report: Any) -> str:
    rl = getattr(report, "risk_level", None) or (
        report.get("risk_level") if isinstance(report, dict) else None
    )
    if rl and isinstance(rl, str):
        return rl
    return _derive_risk_level(_get_score(report))


def _get_issues(report: Any) -> list:
    if hasattr(report, "issues"):
        return report.issues or []
    if isinstance(report, dict):
        return report.get("issues", [])
    return []


def _dump(obj: Any) -> Any:
    if obj is None:
        return None
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    if isinstance(obj, dict):
        return obj
    if isinstance(obj, list):
        return [_dump(i) for i in obj]
    return getattr(obj, "__dict__", str(obj))


# ---------------------------------------------------------------------------
# 1. verify_register_credentials
# ---------------------------------------------------------------------------

def verify_register_credentials(username: str, password: str) -> tuple[bool, Optional[str]]:
    """
    Check username/password against auth_accounts.
    Returns (True, role) on success, (False, None) otherwise.
    """
    db = SessionLocal()
    try:
        account: Optional[AuthAccount] = (
            db.query(AuthAccount)
            .filter(AuthAccount.username == username)
            .first()
        )
        if account is None or not account.can_register:
            return False, None

        match = bcrypt.checkpw(
            password.encode("utf-8"),
            account.password_hash.encode("utf-8"),
        )
        return (True, account.role) if match else (False, None)
    except Exception:
        return False, None
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 2. upsert_device
# ---------------------------------------------------------------------------

def upsert_device(
    hostname: str,
    registered_ip: str,
    device_type: str,
    source_ip: Optional[str] = None,
) -> None:
    """Insert or update a Device row."""
    db = SessionLocal()
    try:
        now = _utcnow()
        device: Optional[Device] = (
            db.query(Device).filter(Device.hostname == hostname).first()
        )
        if device is None:
            db.add(Device(
                hostname=hostname,
                registered_ip=registered_ip,
                last_seen_ip=source_ip or registered_ip,
                device_type=device_type,
                registered_at=now,
                last_seen_at=now,
                is_active=True,
            ))
        else:
            device.registered_ip = registered_ip
            device.device_type = device_type
            device.last_seen_at = now
            if source_ip:
                device.last_seen_ip = source_ip
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 3. is_registered
# ---------------------------------------------------------------------------

def is_registered(hostname: str) -> bool:
    """Return True if a Device row with this hostname exists and is_active."""
    db = SessionLocal()
    try:
        return (
            db.query(Device.id)
            .filter(Device.hostname == hostname, Device.is_active == True)  # noqa: E712
            .first()
        ) is not None
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 4. save_report
# ---------------------------------------------------------------------------

def save_report(
    hostname: str,
    metrics: Any,
    report: Any,
    source_ip: str,
) -> None:
    """
    Persist a DeviceReport row and update Device.last_seen_* fields.
    Raises ValueError if the device is not found.
    """
    db = SessionLocal()
    try:
        device: Optional[Device] = (
            db.query(Device).filter(Device.hostname == hostname).first()
        )
        if device is None:
            raise ValueError(f"Device '{hostname}' not registered — cannot save report.")

        now = _utcnow()
        device.last_seen_at = now
        device.last_seen_ip = source_ip

        # Timestamp
        ts_raw = getattr(metrics, "timestamp", None) or (
            metrics.get("timestamp") if isinstance(metrics, dict) else None
        )
        collected_at = _parse_ts(ts_raw) if ts_raw is not None else now

        # Score / risk
        total_score = _get_score(report)
        risk_level = _get_risk_level(report)

        # Issues
        issues = _get_issues(report)
        issues_sorted = sorted(
            issues,
            key=lambda i: -float(getattr(i, "penalty", 0) or i.get("penalty", 0) if isinstance(i, dict) else getattr(i, "penalty", 0)),
        )

        top_reasons, actions = [], []
        for issue in issues_sorted[:3]:
            rule_id = getattr(issue, "rule_id", None) or (issue.get("rule_id", "K?") if isinstance(issue, dict) else "K?")
            message  = getattr(issue, "message",  None) or (issue.get("message",  "")  if isinstance(issue, dict) else "")
            rec      = getattr(issue, "recommendation", None) or (issue.get("recommendation", "") if isinstance(issue, dict) else "")
            top_reasons.append(f"{rule_id} {message}")
            actions.append(rec[:120] + "..." if len(rec) > 120 else rec)

        metrics_json    = json.dumps(_dump(metrics),              default=str, ensure_ascii=False)
        issues_json     = json.dumps([_dump(i) for i in issues],  default=str, ensure_ascii=False)
        top_reasons_json = json.dumps(top_reasons,                ensure_ascii=False)
        actions_json    = json.dumps(actions,                     ensure_ascii=False)

        db.add(DeviceReport(
            device_id=device.id,
            collected_at=collected_at,
            total_score=total_score,
            risk_level=risk_level,
            metrics_json=metrics_json,
            issues_json=issues_json,
            top_reasons_json=top_reasons_json,
            actions_json=actions_json,
        ))

        # Retention: keep at most MAX_REPORTS_PER_DEVICE per device
        db.flush()
        count: int = (
            db.query(DeviceReport)
            .filter(DeviceReport.device_id == device.id)
            .count()
        )
        if count > MAX_REPORTS_PER_DEVICE:
            excess = count - MAX_REPORTS_PER_DEVICE
            oldest_ids = [
                row[0] for row in (
                    db.query(DeviceReport.id)
                    .filter(DeviceReport.device_id == device.id)
                    .order_by(asc(DeviceReport.collected_at))
                    .limit(excess)
                    .all()
                )
            ]
            db.query(DeviceReport).filter(
                DeviceReport.id.in_(oldest_ids)
            ).delete(synchronize_session=False)

        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 5. get_devices_list
# ---------------------------------------------------------------------------

def get_devices_list() -> list[dict]:
    """
    Summary of all active devices with latest score + improvement_total.
    Sorted: SERVER first, then latest_score ascending (None last).
    """
    db = SessionLocal()
    try:
        devices = db.query(Device).filter(Device.is_active == True).all()  # noqa: E712
        result = []

        for device in devices:
            reports = (
                db.query(DeviceReport)
                .filter(DeviceReport.device_id == device.id)
                .order_by(asc(DeviceReport.collected_at))
                .all()
            )
            latest_score: Optional[float] = None
            risk_level:   Optional[str]   = None
            improvement_total: float      = 0.0

            last_report_top_reasons_json: Optional[str] = None
            last_report_actions_json: Optional[str]   = None

            if reports:
                first_score  = reports[0].total_score
                last_report  = reports[-1]
                latest_score = last_report.total_score
                risk_level   = last_report.risk_level
                improvement_total = round(latest_score - first_score, 2)
                last_report_top_reasons_json = last_report.top_reasons_json
                last_report_actions_json     = last_report.actions_json

            result.append({
                "hostname":           device.hostname,
                "device_type":        device.device_type,
                "registered_ip":      device.registered_ip,
                "last_seen_ip":       device.last_seen_ip,
                "last_seen_at":       device.last_seen_at.isoformat() if device.last_seen_at else None,
                "latest_score":       latest_score,
                "risk_level":         risk_level,
                "improvement_total":  improvement_total,
                "top_reasons_json":   last_report_top_reasons_json,
                "actions_json":       last_report_actions_json,
            })

        def _sort_key(d: dict):
            is_client = 0 if d["device_type"] == "SERVER" else 1
            score = d["latest_score"] if d["latest_score"] is not None else float("inf")
            return (is_client, score)

        result.sort(key=_sort_key)
        return result
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 6. get_device_history
# ---------------------------------------------------------------------------

def get_device_history(hostname: str, limit: int) -> list[dict]:
    """
    Last *limit* score history points for *hostname*, returned ascending.
    Raises KeyError if device not found.
    """
    db = SessionLocal()
    try:
        device: Optional[Device] = (
            db.query(Device).filter(Device.hostname == hostname).first()
        )
        if device is None:
            raise KeyError(f"Device '{hostname}' not found.")

        reports = (
            db.query(DeviceReport)
            .filter(DeviceReport.device_id == device.id)
            .order_by(desc(DeviceReport.collected_at))
            .limit(limit)
            .all()
        )
        return [
            {"timestamp": r.collected_at.isoformat(), "score": r.total_score}
            for r in reversed(reports)
        ]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 7. get_fleet_history
# ---------------------------------------------------------------------------

def get_fleet_history(limit: int) -> list[dict]:
    """
    Fleet-wide history bucketed by minute for the last *limit* reports.
    Returns ascending list with keys: timestamp, fleet_avg, server_avg, client_avg, critical_count.
    """
    db = SessionLocal()
    try:
        rows = (
            db.query(DeviceReport, Device.device_type)
            .join(Device, DeviceReport.device_id == Device.id)
            .order_by(desc(DeviceReport.collected_at))
            .limit(limit)
            .all()
        )

        buckets: dict = defaultdict(lambda: {"fleet": [], "server": [], "client": [], "critical": 0})
        for report, device_type in rows:
            dt = report.collected_at
            key = dt.replace(second=0, microsecond=0)
            score = report.total_score
            buckets[key]["fleet"].append(score)
            if device_type == "SERVER":
                buckets[key]["server"].append(score)
            else:
                buckets[key]["client"].append(score)
            if report.risk_level == "CRITICAL" or score < 40:
                buckets[key]["critical"] += 1

        def _avg(lst: list) -> Optional[float]:
            return round(sum(lst) / len(lst), 2) if lst else None

        return [
            {
                "timestamp":     ts.isoformat(),
                "fleet_avg":     _avg(b["fleet"]),
                "server_avg":    _avg(b["server"]),
                "client_avg":    _avg(b["client"]),
                "critical_count": b["critical"],
            }
            for ts in sorted(buckets)
            for b in [buckets[ts]]
        ]
    finally:
        db.close()
