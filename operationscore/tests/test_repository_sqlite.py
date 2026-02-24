"""
tests/test_repository_sqlite.py

Repository integration tests using an isolated in-memory SQLite database.
Each test patches server.db.engine/SessionLocal so no production DB is touched.
"""

import json
import os
import pytest
from datetime import datetime, timezone
from unittest.mock import patch

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Isolated test engine / session (in-memory SQLite)
# ---------------------------------------------------------------------------

TEST_DB_URL = "sqlite:///:memory:"


def _make_test_engine():
    eng = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        future=True,
    )
    return eng


def _setup_db(engine):
    """Create tables in the given engine using the ORM Base."""
    from server.db import Base
    import server.db_models  # noqa: F401 — registers models
    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch):
    """
    For every test: create a fresh in-memory SQLite engine, patch
    server.db.engine and server.db.SessionLocal so all repository
    functions use it transparently.
    """
    test_engine = _make_test_engine()
    _setup_db(test_engine)

    TestSession = sessionmaker(
        bind=test_engine,
        autoflush=False,
        autocommit=False,
        future=True,
    )

    # Patch the module-level objects that repository.py imports
    import server.db as db_module
    import server.repository as repo_module

    monkeypatch.setattr(db_module, "engine", test_engine)
    monkeypatch.setattr(db_module, "SessionLocal", TestSession)
    monkeypatch.setattr(repo_module, "SessionLocal", TestSession)

    yield TestSession

    # Tear down
    from server.db import Base
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seed(TestSession):
    """Run auth seed against the isolated DB."""
    from server.auth_seed import seed_auth_accounts
    db = TestSession()
    try:
        seed_auth_accounts(db)
    finally:
        db.close()


def _register_device(hostname="test-host", ip="1.2.3.4", device_type="SERVER"):
    from server.repository import upsert_device
    upsert_device(hostname=hostname, registered_ip=ip, device_type=device_type, source_ip=ip)


class _FakeMetrics:
    def __init__(self, hostname="test-host", timestamp="2026-02-21T10:00:00+00:00", **kw):
        self.hostname = hostname
        self.timestamp = timestamp
        for k, v in kw.items():
            setattr(self, k, v)

    def model_dump(self):
        return self.__dict__


class _FakeReport:
    def __init__(self, score=90.0, issues=None):
        self.total_score = score
        self.issues = issues or []

    def model_dump(self):
        return {"total_score": self.total_score, "issues": []}


# ---------------------------------------------------------------------------
# Test 1: init_db creates tables + seed inserts 2 accounts idempotently
# ---------------------------------------------------------------------------

def test_init_db_and_seed_idempotent(isolated_db):
    _seed(isolated_db)
    _seed(isolated_db)  # second call must be idempotent (no duplicate rows)

    db = isolated_db()
    try:
        from server.db_models import AuthAccount
        count = db.query(AuthAccount).count()
        assert count == 2, f"Expected 2 accounts, got {count}"

        usernames = {a.username for a in db.query(AuthAccount).all()}
        assert "ops-server" in usernames
        assert "ops-client" in usernames
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Test 2: verify_register_credentials works with seeded defaults
# ---------------------------------------------------------------------------

def test_verify_register_credentials(isolated_db):
    _seed(isolated_db)

    from server.repository import verify_register_credentials

    ok, role = verify_register_credentials("ops-client", "client123!")
    assert ok is True
    assert role == "CLIENT"

    ok2, role2 = verify_register_credentials("ops-client", "WRONGPASSWORD")
    assert ok2 is False
    assert role2 is None

    ok3, role3 = verify_register_credentials("nonexistent", "x")
    assert ok3 is False
    assert role3 is None


# ---------------------------------------------------------------------------
# Test 3: upsert_device creates device; is_registered returns True
# ---------------------------------------------------------------------------

def test_upsert_device_and_is_registered(isolated_db):
    from server.repository import upsert_device, is_registered

    assert is_registered("new-host") is False

    upsert_device(
        hostname="new-host",
        registered_ip="10.0.0.1",
        device_type="CLIENT",
        source_ip="10.0.0.1",
    )

    assert is_registered("new-host") is True

    # Calling again updates last_seen_at but must not duplicate the device
    upsert_device(
        hostname="new-host",
        registered_ip="10.0.0.2",
        device_type="CLIENT",
        source_ip="10.0.0.2",
    )
    db = isolated_db()
    try:
        from server.db_models import Device
        count = db.query(Device).filter(Device.hostname == "new-host").count()
        assert count == 1
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Test 4: save_report inserts device_reports and updates last_seen
# ---------------------------------------------------------------------------

def test_save_report_inserts_row_and_updates_device(isolated_db):
    from server.repository import upsert_device, save_report

    _register_device(hostname="srv-1", ip="192.168.1.1")

    metrics = _FakeMetrics(hostname="srv-1", timestamp="2026-02-21T10:00:00+00:00")
    report  = _FakeReport(score=85.0)

    save_report(hostname="srv-1", metrics=metrics, report=report, source_ip="192.168.1.1")

    db = isolated_db()
    try:
        from server.db_models import Device, DeviceReport
        device = db.query(Device).filter(Device.hostname == "srv-1").first()
        assert device is not None
        assert device.last_seen_ip == "192.168.1.1"

        count = db.query(DeviceReport).filter(DeviceReport.device_id == device.id).count()
        assert count == 1

        row = db.query(DeviceReport).filter(DeviceReport.device_id == device.id).first()
        assert row.total_score == 85.0
        assert row.risk_level == "LOW"
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Test 5: get_devices_list returns correct improvement_total after 2 reports
# ---------------------------------------------------------------------------

def test_get_devices_list_improvement_total(isolated_db):
    from server.repository import save_report, get_devices_list

    _register_device(hostname="host-a", ip="1.1.1.1")

    # First report: score 60
    save_report("host-a", _FakeMetrics(hostname="host-a", timestamp="2026-02-21T09:00:00+00:00"),
                _FakeReport(score=60.0), "1.1.1.1")
    # Second report: score 80
    save_report("host-a", _FakeMetrics(hostname="host-a", timestamp="2026-02-21T10:00:00+00:00"),
                _FakeReport(score=80.0), "1.1.1.1")

    devices = get_devices_list()
    assert len(devices) == 1
    d = devices[0]
    assert d["hostname"] == "host-a"
    assert d["latest_score"] == 80.0
    assert d["improvement_total"] == pytest.approx(20.0)
    assert "last_seen_at" in d
    assert d["device_type"] == "SERVER"
    assert d["risk_level"] is not None


# ---------------------------------------------------------------------------
# Test 6: get_device_history returns ascending points
# ---------------------------------------------------------------------------

def test_get_device_history_ascending(isolated_db):
    from server.repository import save_report, get_device_history

    _register_device(hostname="hist-host", ip="2.2.2.2")

    timestamps = [
        "2026-02-21T08:00:00+00:00",
        "2026-02-21T09:00:00+00:00",
        "2026-02-21T10:00:00+00:00",
    ]
    scores = [50.0, 70.0, 90.0]
    for ts, sc in zip(timestamps, scores):
        save_report("hist-host", _FakeMetrics(hostname="hist-host", timestamp=ts),
                    _FakeReport(score=sc), "2.2.2.2")

    history = get_device_history("hist-host", limit=10)
    assert len(history) == 3

    # Must be ascending by timestamp
    ts_list = [h["timestamp"] for h in history]
    assert ts_list == sorted(ts_list)

    score_values = [h["score"] for h in history]
    assert score_values == [50.0, 70.0, 90.0]

    # Missing device raises KeyError
    with pytest.raises(KeyError):
        get_device_history("no-such-host", limit=10)


# ---------------------------------------------------------------------------
# Test 7: get_fleet_history buckets by minute with required keys
# ---------------------------------------------------------------------------

def test_get_fleet_history_required_keys_and_buckets(isolated_db):
    from server.repository import save_report, get_fleet_history

    _register_device(hostname="fleet-a", ip="3.3.3.1", device_type="SERVER")
    _register_device(hostname="fleet-b", ip="3.3.3.2", device_type="CLIENT")

    # Both at the same minute → one bucket
    same_min = "2026-02-21T10:00:30+00:00"
    save_report("fleet-a", _FakeMetrics(hostname="fleet-a", timestamp=same_min), _FakeReport(score=80.0), "3.3.3.1")
    save_report("fleet-b", _FakeMetrics(hostname="fleet-b", timestamp=same_min), _FakeReport(score=60.0), "3.3.3.2")

    # One at a different minute → second bucket
    diff_min = "2026-02-21T10:01:00+00:00"
    save_report("fleet-a", _FakeMetrics(hostname="fleet-a", timestamp=diff_min), _FakeReport(score=90.0), "3.3.3.1")

    history = get_fleet_history(limit=50)
    assert len(history) == 2, f"Expected 2 buckets, got {len(history)}: {history}"

    required_keys = {"timestamp", "fleet_avg", "server_avg", "client_avg", "critical_count"}
    for bucket in history:
        assert required_keys <= bucket.keys(), f"Missing keys in {bucket}"

    # First bucket should have both server and client averages
    b0 = history[0]
    assert b0["fleet_avg"] == pytest.approx(70.0)   # (80+60)/2
    assert b0["server_avg"] == pytest.approx(80.0)
    assert b0["client_avg"] == pytest.approx(60.0)
    assert b0["critical_count"] == 0

    # Timestamps must be ascending
    ts_list = [b["timestamp"] for b in history]
    assert ts_list == sorted(ts_list)
