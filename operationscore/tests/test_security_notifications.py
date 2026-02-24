"""
tests/test_security_notifications.py

Unit tests for the security-notification helper module (Phase B1).
Covers:
  1. extract_security_issues filtering and sorting
  2. build_security_alert_payload truncation
  3. try_notify_send when notify-send is absent (no crash)
  4. try_notify_send calls subprocess when available
  5. collector.py spam-control (fingerprint deduplication)
"""

import json
import sys
import os
import types
from unittest.mock import MagicMock, call, patch

import pytest

# ---------------------------------------------------------------------------
# Make the agent/ directory importable regardless of test runner CWD
# ---------------------------------------------------------------------------
_AGENT_DIR = os.path.join(
    os.path.dirname(__file__), "..", "agent"
)
if _AGENT_DIR not in sys.path:
    sys.path.insert(0, _AGENT_DIR)

from security_notify import (
    SECURITY_RULE_IDS,
    extract_security_issues,
    build_security_alert_payload,
    print_security_alert,
    truncate,
    try_notify_send,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_issue(rule_id: str, penalty: float, message: str = "msg", rec: str = "rec") -> dict:
    return {"rule_id": rule_id, "penalty": penalty, "message": message, "recommendation": rec}


# ---------------------------------------------------------------------------
# 1) extract_security_issues — filtering and sorting
# ---------------------------------------------------------------------------

class TestExtractSecurityIssues:

    def test_filters_out_non_security_rules(self):
        issues = [
            _make_issue("K1", 30.0),
            _make_issue("K6", 15.0),   # NOT security
            _make_issue("K8", 10.0),   # NOT security
            _make_issue("K2", 25.0),
        ]
        result = extract_security_issues(issues)
        rule_ids = {i["rule_id"] for i in result}
        assert rule_ids <= SECURITY_RULE_IDS, f"Non-security rule in result: {rule_ids}"

    def test_keeps_all_security_rule_ids(self):
        issues = [_make_issue(r, float(i) * 5) for i, r in enumerate(SECURITY_RULE_IDS)]
        result = extract_security_issues(issues)
        result_ids = {i["rule_id"] for i in result}
        # 6 rules but limit=3, so at most 3
        assert len(result) == 3
        assert result_ids <= SECURITY_RULE_IDS

    def test_sorted_by_penalty_descending(self):
        issues = [
            _make_issue("K1", 10.0),
            _make_issue("K2", 25.0),
            _make_issue("K3", 5.0),
        ]
        result = extract_security_issues(issues)
        penalties = [i["penalty"] for i in result]
        assert penalties == sorted(penalties, reverse=True)

    def test_limited_to_3_by_default(self):
        issues = [_make_issue(r, float(i) * 5) for i, r in enumerate(SECURITY_RULE_IDS)]
        result = extract_security_issues(issues)
        assert len(result) <= 3

    def test_custom_limit(self):
        issues = [_make_issue("K1", 10.0), _make_issue("K2", 20.0)]
        assert len(extract_security_issues(issues, limit=1)) == 1

    def test_empty_input_returns_empty(self):
        assert extract_security_issues([]) == []

    def test_no_security_rules_returns_empty(self):
        issues = [_make_issue("K6", 15.0), _make_issue("K8", 10.0)]
        assert extract_security_issues(issues) == []

    def test_returns_top_3_by_penalty(self):
        """K2 (pen 25) > K1 (pen 30) > K3 (pen 20) > K4 (pen 5) → top3 = K1, K2, K3"""
        issues = [
            _make_issue("K1", 30.0),
            _make_issue("K2", 25.0),
            _make_issue("K3", 20.0),
            _make_issue("K4", 5.0),
        ]
        result = extract_security_issues(issues)
        assert len(result) == 3
        assert result[0]["rule_id"] == "K1"
        assert result[1]["rule_id"] == "K2"
        assert result[2]["rule_id"] == "K3"


# ---------------------------------------------------------------------------
# 2) build_security_alert_payload — structure and truncation
# ---------------------------------------------------------------------------

class TestBuildSecurityAlertPayload:

    BASE_ISSUE = _make_issue("K1", 30.0, "some message", "some recommendation")

    def test_returns_required_keys(self):
        payload = build_security_alert_payload("myhost", "HIGH", [self.BASE_ISSUE])
        for key in ("hostname", "count", "issues", "actions", "risk_level"):
            assert key in payload, f"Missing key: {key}"

    def test_hostname_and_risk_level_preserved(self):
        payload = build_security_alert_payload("srv01", "CRITICAL", [self.BASE_ISSUE])
        assert payload["hostname"] == "srv01"
        assert payload["risk_level"] == "CRITICAL"

    def test_count_matches_issues_list(self):
        issues = [self.BASE_ISSUE, _make_issue("K2", 25.0)]
        payload = build_security_alert_payload("h", "LOW", issues)
        assert payload["count"] == 2
        assert len(payload["issues"]) == 2
        assert len(payload["actions"]) == 2

    def test_issues_entries_truncated_at_140(self):
        long_msg = "X" * 200
        iss = _make_issue("K1", 30.0, long_msg)
        payload = build_security_alert_payload("h", "HIGH", [iss])
        entry = payload["issues"][0]
        # "K1 " prefix + 140 chars trucated string = ≤ "K1 " + 140 + "..."
        assert len(entry) <= 143, f"Issue entry too long: {len(entry)}"
        assert entry.endswith("...")

    def test_actions_entries_truncated_at_120(self):
        long_rec = "R" * 200
        iss = _make_issue("K1", 30.0, "msg", long_rec)
        payload = build_security_alert_payload("h", "HIGH", [iss])
        action = payload["actions"][0]
        assert len(action) <= 123, f"Action too long: {len(action)}"
        assert action.endswith("...")

    def test_short_entries_not_truncated(self):
        iss = _make_issue("K2", 25.0, "firewall off", "Enable UFW")
        payload = build_security_alert_payload("h", "MEDIUM", [iss])
        assert "..." not in payload["issues"][0]
        assert "..." not in payload["actions"][0]

    def test_issue_entry_includes_rule_id(self):
        iss = _make_issue("K3", 20.0, "ssh root enabled")
        payload = build_security_alert_payload("h", "HIGH", [iss])
        assert "K3" in payload["issues"][0]


# ---------------------------------------------------------------------------
# 3) try_notify_send — no binary → no crash
# ---------------------------------------------------------------------------

class TestTryNotifySendNoBinary:

    def test_no_crash_when_notify_send_absent(self, monkeypatch):
        import security_notify
        monkeypatch.setattr(security_notify.shutil, "which", lambda _: None)
        payload = {
            "hostname": "h", "count": 1, "risk_level": "HIGH",
            "issues": ["K2 firewall off"], "actions": ["Enable UFW"],
        }
        # Must not raise
        try_notify_send(payload)

    def test_subprocess_not_called_when_absent(self, monkeypatch):
        import security_notify
        monkeypatch.setattr(security_notify.shutil, "which", lambda _: None)
        with patch("security_notify.subprocess.run") as mock_run:
            try_notify_send({"hostname": "h", "count": 1, "risk_level": "M",
                             "issues": [], "actions": []})
            mock_run.assert_not_called()


# ---------------------------------------------------------------------------
# 4) try_notify_send — binary available → subprocess called correctly
# ---------------------------------------------------------------------------

class TestTryNotifySendWithBinary:

    PAYLOAD = {
        "hostname": "host123",
        "count": 2,
        "risk_level": "CRITICAL",
        "issues": ["K1 updates pending", "K2 firewall off"],
        "actions": ["Apply updates", "Enable UFW"],
    }

    def test_subprocess_called_with_notify_send(self, monkeypatch):
        import security_notify
        monkeypatch.setattr(security_notify.shutil, "which", lambda _: "/usr/bin/notify-send")
        with patch("security_notify.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            try_notify_send(self.PAYLOAD)
            mock_run.assert_called_once()
            args = mock_run.call_args[0][0]
            assert args[0] == "notify-send"
            assert args[1] == "OperationScore Security Alert"

    def test_body_includes_hostname(self, monkeypatch):
        import security_notify
        monkeypatch.setattr(security_notify.shutil, "which", lambda _: "/usr/bin/notify-send")
        with patch("security_notify.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            try_notify_send(self.PAYLOAD)
            body = mock_run.call_args[0][0][2]
            assert "host123" in body

    def test_body_includes_numbered_issues(self, monkeypatch):
        import security_notify
        monkeypatch.setattr(security_notify.shutil, "which", lambda _: "/usr/bin/notify-send")
        with patch("security_notify.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            try_notify_send(self.PAYLOAD)
            body = mock_run.call_args[0][0][2]
            assert "1)" in body
            assert "2)" in body

    def test_body_includes_risk_level(self, monkeypatch):
        import security_notify
        monkeypatch.setattr(security_notify.shutil, "which", lambda _: "/usr/bin/notify-send")
        with patch("security_notify.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0)
            try_notify_send(self.PAYLOAD)
            body = mock_run.call_args[0][0][2]
            assert "CRITICAL" in body

    def test_exception_swallowed(self, monkeypatch):
        import security_notify
        monkeypatch.setattr(security_notify.shutil, "which", lambda _: "/usr/bin/notify-send")
        with patch("security_notify.subprocess.run", side_effect=RuntimeError("boom")):
            # Must not raise
            try_notify_send(self.PAYLOAD)


# ---------------------------------------------------------------------------
# 5) collector.py spam-control (fingerprint deduplication)
# ---------------------------------------------------------------------------

class TestCollectorSpamControl:

    def _make_response(self, issues):
        """Build a mock requests.Response that returns 200 with the given issues."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "total_score": 70.0,
            "risk_level": "MEDIUM",
            "issues": issues,
        }
        return mock_resp

    def _make_security_issue(self, rule_id="K2", penalty=25.0, msg="firewall off"):
        return {"rule_id": rule_id, "penalty": penalty, "message": msg,
                "recommendation": "Enable UFW firewall immediately."}

    def test_alert_printed_only_once_for_same_fingerprint(self, monkeypatch):
        """
        Call send_metrics twice with same issue set → OPERATIONSCORE_SECURITY_ALERT
        should only be printed once (spam filter).
        """
        import collector as collector_mod

        issues = [self._make_security_issue()]
        responses = [self._make_response(issues), self._make_response(issues)]

        mock_requests = MagicMock()
        mock_requests.post.side_effect = responses
        mock_requests.exceptions.ConnectionError = ConnectionError
        mock_requests.exceptions.Timeout = TimeoutError
        mock_requests.exceptions.RequestException = Exception

        c = collector_mod.MetricsCollector(api_url="http://fake:9999/report")
        c.notify_enabled = True

        metrics = {
            "hostname": "testhost", "timestamp": "2026-01-01T00:00:00Z",
            "update_count": 0, "firewall_enabled": True,
            "ssh_root_login_allowed": False, "sudo_users_count": 1,
            "unnecessary_services": [], "disk_usage_percent": 50,
            "password_policy_ok": True, "last_seen_minutes": 0,
            "ram_usage_percent": 0.0, "gpu_usage_percent": None,
        }

        with patch.dict(sys.modules, {"requests": mock_requests}):
            with patch("security_notify.subprocess.run") as mock_run:
                with patch("security_notify.shutil.which", return_value="/usr/bin/notify-send"):
                    c.send_metrics(metrics)   # 1st call → should alert
                    c.send_metrics(metrics)   # 2nd call → same fingerprint → skip

        # subprocess.run for notify-send should be called exactly once
        assert mock_run.call_count == 1, (
            f"Expected 1 notify-send call, got {mock_run.call_count}"
        )

    def test_alert_fires_again_when_issues_change(self, monkeypatch):
        """
        Second send_metrics with different issues → fingerprint changes → alert fires again.
        """
        import collector as collector_mod

        issues_set1 = [self._make_security_issue("K2", 25.0, "firewall off")]
        issues_set2 = [self._make_security_issue("K1", 30.0, "486 updates pending")]
        responses = [self._make_response(issues_set1), self._make_response(issues_set2)]

        mock_requests = MagicMock()
        mock_requests.post.side_effect = responses
        mock_requests.exceptions.ConnectionError = ConnectionError
        mock_requests.exceptions.Timeout = TimeoutError
        mock_requests.exceptions.RequestException = Exception

        c = collector_mod.MetricsCollector(api_url="http://fake:9999/report")
        c.notify_enabled = True

        metrics = {
            "hostname": "testhost", "timestamp": "2026-01-01T00:00:00Z",
            "update_count": 0, "firewall_enabled": True,
            "ssh_root_login_allowed": False, "sudo_users_count": 1,
            "unnecessary_services": [], "disk_usage_percent": 50,
            "password_policy_ok": True, "last_seen_minutes": 0,
            "ram_usage_percent": 0.0, "gpu_usage_percent": None,
        }

        with patch.dict(sys.modules, {"requests": mock_requests}):
            with patch("security_notify.subprocess.run") as mock_run:
                with patch("security_notify.shutil.which", return_value="/usr/bin/notify-send"):
                    c.send_metrics(metrics)   # 1st call → alert with K2
                    c.send_metrics(metrics)   # 2nd call → different issue K1 → alert again

        assert mock_run.call_count == 2, (
            f"Expected 2 notify-send calls (issue changed), got {mock_run.call_count}"
        )


# ---------------------------------------------------------------------------
# 6) print_security_alert — output format
# ---------------------------------------------------------------------------

class TestPrintSecurityAlert:

    def test_output_starts_with_prefix(self, capsys):
        payload = {"hostname": "h", "count": 1, "risk_level": "HIGH",
                   "issues": ["K2 firewall"], "actions": ["Enable UFW"]}
        print_security_alert(payload)
        out = capsys.readouterr().out
        assert out.startswith("OPERATIONSCORE_SECURITY_ALERT: ")

    def test_output_is_valid_json(self, capsys):
        payload = {"hostname": "h", "count": 1, "risk_level": "MEDIUM",
                   "issues": ["K1 updates"], "actions": ["Apply updates"]}
        print_security_alert(payload)
        out = capsys.readouterr().out.strip()
        prefix = "OPERATIONSCORE_SECURITY_ALERT: "
        raw_json = out[len(prefix):]
        parsed = json.loads(raw_json)
        assert parsed["hostname"] == "h"
        assert parsed["count"] == 1
