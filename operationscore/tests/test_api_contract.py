"""
tests/test_api_contract.py

End-to-end API contract tests via FastAPI TestClient.

Each test gets an isolated temporary SQLite database — never touches
server/data/operationscore.db.

Default seeded credentials (from auth_seed.py defaults / env):
  ops-client / client123!  -> role CLIENT
  ops-server / server123!  -> role SERVER
"""

import os
import tempfile
import pytest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

METRICS_CLEAN = {
    "hostname": "PC-A",
    "timestamp": "2026-02-21T10:00:00+00:00",
    "update_count": 0,
    "firewall_enabled": True,
    "ssh_root_login_allowed": False,
    "sudo_users_count": 1,
    "unnecessary_services": [],
    "disk_usage_percent": 50,
    "password_policy_ok": True,
    "last_seen_minutes": 0,
}


def _post_register(client: TestClient, hostname: str, ip: str,
                   username: str, password: str):
    return client.post("/api/register", json={
        "hostname": hostname,
        "ip": ip,
        "username": username,
        "password": password,
    })


def _post_report(client: TestClient, hostname: str = "PC-A") -> dict:
    payload = dict(METRICS_CLEAN)
    payload["hostname"] = hostname
    r = client.post("/report", json=payload)
    return r


# ---------------------------------------------------------------------------
# Fixture: isolated DB per test
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(monkeypatch, tmp_path):
    """
    Provision a fresh temporary SQLite DB per test, patch
    server.db.engine + server.db.SessionLocal + server.repository.SessionLocal
    so the app uses that DB (not the production file), then yield a
    TestClient.
    """
    db_file = tmp_path / "test_api.db"
    db_url = f"sqlite:///{db_file}"

    test_engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
        future=True,
    )
    TestSession = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
        future=True,
    )

    import server.db as db_module
    import server.repository as repo_module

    monkeypatch.setattr(db_module, "engine", test_engine)
    monkeypatch.setattr(db_module, "SessionLocal", TestSession)
    monkeypatch.setattr(repo_module, "SessionLocal", TestSession)

    # Create tables and seed accounts using the patched engine
    from server.db import Base
    import server.db_models  # noqa: F401 — registers ORM models
    Base.metadata.create_all(bind=test_engine)

    from server.auth_seed import seed_auth_accounts
    db = TestSession()
    try:
        seed_auth_accounts(db)
        # idempotency check: call twice
        seed_auth_accounts(db)
    finally:
        db.close()

    # Verify seed idempotency (exactly 2 accounts)
    from server.db_models import AuthAccount
    db = TestSession()
    try:
        count = db.query(AuthAccount).count()
        assert count == 2, f"Expected 2 seeded accounts, got {count}"
    finally:
        db.close()

    # Import app AFTER monkeypatching so startup event uses patched DB
    from server.main import app
    with TestClient(app, raise_server_exceptions=True) as tc:
        yield tc

    # Teardown
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


# ---------------------------------------------------------------------------
# P5.2.1 — Schema validation (unit, no HTTP)
# ---------------------------------------------------------------------------

class TestRegisterRequestValidation:
    """Pydantic v2 field validators for RegisterRequest."""

    def test_invalid_hostname_space(self):
        from server.api_schemas import RegisterRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            RegisterRequest(
                hostname="PC A",  # space not allowed
                ip="1.1.1.1",
                username="ops-client",
                password="client123!",
            )
        errors = exc_info.value.errors()
        messages = [e["msg"] for e in errors]
        assert any("Invalid hostname" in m for m in messages)

    def test_invalid_hostname_special_chars(self):
        from server.api_schemas import RegisterRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            RegisterRequest(
                hostname="bad!host",
                ip="1.1.1.1",
                username="ops-client",
                password="client123!",
            )
        errors = exc_info.value.errors()
        messages = [e["msg"] for e in errors]
        assert any("Invalid hostname" in m for m in messages)

    def test_valid_hostname_accepted(self):
        from server.api_schemas import RegisterRequest
        req = RegisterRequest(
            hostname="PC-A.domain-01",
            ip="1.1.1.1",
            username="ops-client",
            password="client123!",
        )
        assert req.hostname == "PC-A.domain-01"

    def test_invalid_ip_out_of_range(self):
        from server.api_schemas import RegisterRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            RegisterRequest(
                hostname="PC-A",
                ip="999.1.1.1",
                username="ops-client",
                password="client123!",
            )
        errors = exc_info.value.errors()
        messages = [e["msg"] for e in errors]
        assert any("Invalid IPv4 address" in m for m in messages)

    def test_invalid_ip_ipv6_rejected(self):
        from server.api_schemas import RegisterRequest
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            RegisterRequest(
                hostname="PC-A",
                ip="::1",
                username="ops-client",
                password="client123!",
            )
        errors = exc_info.value.errors()
        messages = [e["msg"] for e in errors]
        assert any("Invalid IPv4 address" in m for m in messages)

    def test_valid_ip_accepted(self):
        from server.api_schemas import RegisterRequest
        req = RegisterRequest(
            hostname="PC-A",
            ip="10.0.0.1",
            username="ops-client",
            password="client123!",
        )
        assert req.ip == "10.0.0.1"


# ---------------------------------------------------------------------------
# P5.2.2 — /api/register bad creds -> 401
# ---------------------------------------------------------------------------

class TestRegisterEndpoint:

    def test_bad_creds_returns_401(self, client):
        r = _post_register(client, "PC-A", "1.1.1.1", "ops-client", "WRONG")
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid credentials"

    def test_good_creds_client_returns_200(self, client):
        r = _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["device_type"] == "CLIENT"

    def test_good_creds_server_returns_200(self, client):
        r = _post_register(client, "PC-S", "2.2.2.2", "ops-server", "server123!")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["device_type"] == "SERVER"

    def test_register_message_present(self, client):
        r = _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        assert "message" in r.json()

    def test_nonexistent_user_returns_401(self, client):
        r = _post_register(client, "PC-A", "1.1.1.1", "nobody", "nothing")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# P5.2.3 — /report gating
# ---------------------------------------------------------------------------

class TestReportGating:

    def test_unregistered_returns_403(self, client):
        r = _post_report(client, hostname="UNREG")
        assert r.status_code == 403
        assert r.json()["detail"] == "Device not registered"

    def test_registered_returns_200(self, client):
        # Register first
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = _post_report(client, hostname="PC-A")
        assert r.status_code == 200

    def test_registered_response_has_total_score(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = _post_report(client, hostname="PC-A")
        body = r.json()
        assert "total_score" in body
        assert isinstance(body["total_score"], float)

    def test_registered_response_has_ok_true(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = _post_report(client, hostname="PC-A")
        assert r.json()["ok"] is True

    def test_registered_response_has_risk_level(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = _post_report(client, hostname="PC-A")
        body = r.json()
        assert "risk_level" in body
        assert isinstance(body["risk_level"], str)

    def test_clean_metrics_score_100(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = _post_report(client, hostname="PC-A")
        assert r.json()["total_score"] == pytest.approx(100.0)

    def test_degraded_metrics_lower_score(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        payload = dict(METRICS_CLEAN)
        payload["firewall_enabled"] = False
        payload["disk_usage_percent"] = 96
        payload["password_policy_ok"] = False
        r = client.post("/report", json=payload)
        assert r.status_code == 200
        assert r.json()["total_score"] < 100.0


# ---------------------------------------------------------------------------
# P5.2.4 — DB persistence side effects
# ---------------------------------------------------------------------------

class TestReportPersistence:

    def test_device_reports_row_inserted(self, client, monkeypatch):
        import server.db as db_module
        import server.repository as repo_module

        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")

        # Capture current session factory from the monkeypatched state
        TestSession = db_module.SessionLocal

        # Count before
        db = TestSession()
        try:
            from server.db_models import DeviceReport
            before = db.query(DeviceReport).count()
        finally:
            db.close()

        _post_report(client, hostname="PC-A")

        # Count after
        db = TestSession()
        try:
            after = db.query(DeviceReport).count()
        finally:
            db.close()

        assert after == before + 1

    def test_device_last_seen_at_not_null(self, client, monkeypatch):
        import server.db as db_module
        TestSession = db_module.SessionLocal

        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        _post_report(client, hostname="PC-A")

        db = TestSession()
        try:
            from server.db_models import Device
            device = db.query(Device).filter(Device.hostname == "PC-A").first()
            assert device is not None
            assert device.last_seen_at is not None
        finally:
            db.close()


# ---------------------------------------------------------------------------
# P5.2.5 — GET /api/devices shape
# ---------------------------------------------------------------------------

class TestDevicesEndpoint:

    def test_returns_200(self, client):
        r = client.get("/api/devices")
        assert r.status_code == 200

    def test_has_device_count_and_devices(self, client):
        r = client.get("/api/devices")
        body = r.json()
        assert "device_count" in body
        assert "devices" in body
        assert isinstance(body["device_count"], int)
        assert isinstance(body["devices"], list)

    def test_device_count_matches_list_length(self, client):
        r = client.get("/api/devices")
        body = r.json()
        assert body["device_count"] == len(body["devices"])

    def test_registered_device_appears(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = client.get("/api/devices")
        body = r.json()
        assert body["device_count"] >= 1
        hostnames = [d["hostname"] for d in body["devices"]]
        assert "PC-A" in hostnames

    def test_device_item_required_keys(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = client.get("/api/devices")
        device = r.json()["devices"][0]
        required = {
            "hostname", "device_type", "registered_ip",
            "last_seen_ip", "last_seen_at",
            "latest_score", "risk_level", "improvement_total",
        }
        assert required <= device.keys(), f"Missing keys: {required - device.keys()}"

    def test_nullable_fields_allowed_null(self, client):
        """A registered device with no reports may have null latest_score."""
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = client.get("/api/devices")
        device = next(d for d in r.json()["devices"] if d["hostname"] == "PC-A")
        # latest_score may be None before any report submitted
        assert "latest_score" in device  # key present even if null


# ---------------------------------------------------------------------------
# P5.2.6 — GET /api/devices/{hostname}/history
# ---------------------------------------------------------------------------

class TestDeviceHistoryEndpoint:

    def _send_two_reports(self, client):
        """Register PC-A and send two reports with distinct timestamps."""
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        for ts in ["2026-02-21T10:00:00+00:00", "2026-02-21T10:01:00+00:00"]:
            payload = dict(METRICS_CLEAN)
            payload["timestamp"] = ts
            client.post("/report", json=payload)

    def test_known_host_returns_200(self, client):
        self._send_two_reports(client)
        r = client.get("/api/devices/PC-A/history?limit=100")
        assert r.status_code == 200

    def test_returns_hostname_and_points(self, client):
        self._send_two_reports(client)
        r = client.get("/api/devices/PC-A/history?limit=100")
        body = r.json()
        assert body["hostname"] == "PC-A"
        assert isinstance(body["points"], list)

    def test_points_count_matches_reports(self, client):
        self._send_two_reports(client)
        r = client.get("/api/devices/PC-A/history?limit=100")
        assert len(r.json()["points"]) == 2

    def test_points_ascending_by_timestamp(self, client):
        self._send_two_reports(client)
        r = client.get("/api/devices/PC-A/history?limit=100")
        timestamps = [p["timestamp"] for p in r.json()["points"]]
        assert timestamps == sorted(timestamps), "Points not in ascending order"

    def test_points_have_timestamp_and_score(self, client):
        self._send_two_reports(client)
        r = client.get("/api/devices/PC-A/history?limit=100")
        for point in r.json()["points"]:
            assert "timestamp" in point
            assert "score" in point
            assert isinstance(point["score"], float)

    def test_unknown_host_returns_404(self, client):
        r = client.get("/api/devices/NOPE/history?limit=100")
        assert r.status_code == 404

    def test_limit_0_returns_400(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = client.get("/api/devices/PC-A/history?limit=0")
        assert r.status_code == 400
        assert r.json()["detail"] == "Invalid limit"

    def test_limit_exceeding_max_returns_400(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = client.get("/api/devices/PC-A/history?limit=999999")
        assert r.status_code == 400
        assert r.json()["detail"] == "Invalid limit"


# ---------------------------------------------------------------------------
# P5.2.7 — GET /api/fleet/history
# ---------------------------------------------------------------------------

class TestFleetHistoryEndpoint:

    def _seed_fleet(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        _post_register(client, "PC-S", "2.2.2.2", "ops-server", "server123!")
        for ts in ["2026-02-21T10:00:00+00:00", "2026-02-21T10:01:00+00:00"]:
            for hostname, role in [("PC-A", "ops-client"), ("PC-S", "ops-server")]:
                payload = dict(METRICS_CLEAN)
                payload["hostname"] = hostname
                payload["timestamp"] = ts
                client.post("/report", json=payload)

    def test_returns_200(self, client):
        r = client.get("/api/fleet/history?limit=200")
        assert r.status_code == 200

    def test_has_points_list(self, client):
        r = client.get("/api/fleet/history?limit=200")
        body = r.json()
        assert "points" in body
        assert isinstance(body["points"], list)

    def test_points_required_keys(self, client):
        self._seed_fleet(client)
        r = client.get("/api/fleet/history?limit=200")
        for point in r.json()["points"]:
            assert "timestamp" in point
            assert "fleet_avg" in point
            assert "server_avg" in point
            assert "client_avg" in point
            assert "critical_count" in point

    def test_server_avg_client_avg_nullable(self, client):
        """server_avg / client_avg may be null for buckets with only one type."""
        self._seed_fleet(client)
        r = client.get("/api/fleet/history?limit=200")
        for point in r.json()["points"]:
            # Values may be float or None — both are valid
            assert isinstance(point["server_avg"], (float, type(None)))
            assert isinstance(point["client_avg"], (float, type(None)))

    def test_fleet_avg_is_float(self, client):
        self._seed_fleet(client)
        r = client.get("/api/fleet/history?limit=200")
        for point in r.json()["points"]:
            assert isinstance(point["fleet_avg"], float)

    def test_limit_too_large_returns_400(self, client):
        r = client.get("/api/fleet/history?limit=999999")
        assert r.status_code == 400
        assert r.json()["detail"] == "Invalid limit"

    def test_limit_0_returns_400(self, client):
        r = client.get("/api/fleet/history?limit=0")
        assert r.status_code == 400
        assert r.json()["detail"] == "Invalid limit"


# ---------------------------------------------------------------------------
# P5.2.8 — Limit validation (explicit grouping)
# ---------------------------------------------------------------------------

class TestLimitValidation:

    def test_device_history_limit_zero(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = client.get("/api/devices/PC-A/history?limit=0")
        assert r.status_code == 400

    def test_device_history_limit_negative(self, client):
        _post_register(client, "PC-A", "1.1.1.1", "ops-client", "client123!")
        r = client.get("/api/devices/PC-A/history?limit=-1")
        assert r.status_code == 400

    def test_fleet_history_limit_zero(self, client):
        r = client.get("/api/fleet/history?limit=0")
        assert r.status_code == 400

    def test_fleet_history_limit_over_max(self, client):
        r = client.get("/api/fleet/history?limit=999999")
        assert r.status_code == 400
