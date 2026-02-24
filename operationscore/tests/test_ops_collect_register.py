"""
tests/test_ops_collect_register.py

Unit tests for the interactive registration flow in ops_collect.py.
All network calls are mocked — no real server required.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

_AGENT_DIR = Path(__file__).parent.parent / "agent"
sys.path.insert(0, str(_AGENT_DIR))

import agent.ops_collect as mod


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_resp(status: int, body: dict) -> MagicMock:
    r = MagicMock()
    r.status_code = status
    r.json.return_value = body
    r.text = json.dumps(body)
    return r


# ---------------------------------------------------------------------------
# Registration: 401 twice then 200 → success on 3rd attempt
# ---------------------------------------------------------------------------

class TestRegister401ThenSuccess:

    def test_succeeds_on_third_attempt(self, capsys):
        """401, 401, 200 — registers on the 3rd attempt."""
        responses = [
            _fake_resp(401, {}),
            _fake_resp(401, {}),
            _fake_resp(200, {"ok": True, "device_type": "CLIENT"}),
        ]
        inputs = iter(["u", "u", "u"])
        passwords = iter(["bad1", "bad2", "client123!"])

        with patch("requests.post", side_effect=responses), \
             patch("builtins.input", side_effect=inputs), \
             patch("getpass.getpass", side_effect=passwords):
            # Should return normally (no sys.exit)
            mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)

        captured = capsys.readouterr()
        assert '"ok":true' in captured.out
        assert '"device_type":"CLIENT"' in captured.out
        assert "attempt 1/3" in captured.out
        assert "attempt 2/3" in captured.out
        # 3rd attempt succeeded — no "attempt 3/3" failure message
        assert "attempt 3/3" not in captured.out

    def test_401_twice_then_200_does_not_exit(self):
        """_do_interactive_register must return (not raise SystemExit) on success."""
        responses = [
            _fake_resp(401, {}),
            _fake_resp(401, {}),
            _fake_resp(200, {"ok": True, "device_type": "SERVER"}),
        ]
        with patch("requests.post", side_effect=responses), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", side_effect=["w1", "w2", "server123!"]):
            # No exception expected
            result = mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        assert result is None  # returns normally


# ---------------------------------------------------------------------------
# Registration: all 3 attempts fail → exit 1
# ---------------------------------------------------------------------------

class TestRegisterAllAttemptsExhausted:

    def test_exits_1_after_three_failures(self):
        mock_resp = _fake_resp(401, {})
        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="wrong"):
            with pytest.raises(SystemExit) as exc_info:
                mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        assert exc_info.value.code == 1

    def test_prints_unauthorized_message(self, capsys):
        mock_resp = _fake_resp(401, {})
        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="wrong"):
            with pytest.raises(SystemExit):
                mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        captured = capsys.readouterr()
        assert "UNAUTHORIZED" in captured.out
        assert '"ok":false' in captured.out

    def test_prints_attempt_counter_for_each_failure(self, capsys):
        mock_resp = _fake_resp(401, {})
        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="wrong"):
            with pytest.raises(SystemExit):
                mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        captured = capsys.readouterr()
        assert "attempt 1/3" in captured.out
        assert "attempt 2/3" in captured.out
        assert "attempt 3/3" in captured.out

    def test_posts_exactly_three_times(self):
        mock_resp = _fake_resp(401, {})
        with patch("requests.post", return_value=mock_resp) as mock_post, \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="wrong"):
            with pytest.raises(SystemExit):
                mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        assert mock_post.call_count == 3


# ---------------------------------------------------------------------------
# Registration: Ctrl+C → exit 130
# ---------------------------------------------------------------------------

class TestRegisterKeyboardInterrupt:

    def test_exits_130(self):
        with patch("builtins.input", side_effect=KeyboardInterrupt):
            with pytest.raises(SystemExit) as exc_info:
                mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        assert exc_info.value.code == 130

    def test_prints_cancelled(self, capsys):
        with patch("builtins.input", side_effect=KeyboardInterrupt):
            with pytest.raises(SystemExit):
                mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        captured = capsys.readouterr()
        assert "CANCELLED" in captured.out
        assert '"ok":false' in captured.out

    def test_no_network_call_on_cancel(self):
        with patch("builtins.input", side_effect=KeyboardInterrupt), \
             patch("requests.post") as mock_post:
            with pytest.raises(SystemExit):
                mod._do_interactive_register("http://x/api/register", "host", "1.1.1.1", 5)
        mock_post.assert_not_called()


# ---------------------------------------------------------------------------
# run_once: POST /report returns 200 → OPERATIONSCORE_RESULT + OPERATIONSCORE_JSON
# ---------------------------------------------------------------------------

class TestRunOnce:

    def _make_args(self):
        import argparse
        args = argparse.Namespace(
            token="",
            timeout=5,
            no_status=True,
            notify=False,
            critical_threshold=60,
            print_pretty=False,
            write_status="/tmp/test_status.txt",
        )
        return args

    def test_returns_0_on_200(self):
        from collector import MetricsCollector
        collector = MagicMock(spec=MetricsCollector)
        collector.hostname = "test-host"
        collector.collect_metrics.return_value = {
            "hostname": "test-host", "timestamp": "2026-01-01T00:00:00+00:00",
            "update_count": 0, "firewall_enabled": True,
            "ssh_root_login_allowed": False, "sudo_users_count": 1,
            "unnecessary_services": [], "disk_usage_percent": 10.0,
            "password_policy_ok": True, "last_seen_minutes": 0,
        }
        mock_resp = _fake_resp(200, {"total_score": 100.0, "issues": []})
        with patch("requests.post", return_value=mock_resp):
            result = mod.run_once(self._make_args(), collector, "http://x/report")
        assert result == 0

    def test_prints_operationscore_result(self, capsys):
        from collector import MetricsCollector
        collector = MagicMock(spec=MetricsCollector)
        collector.hostname = "test-host"
        collector.collect_metrics.return_value = {
            "hostname": "test-host", "timestamp": "2026-01-01T00:00:00+00:00",
            "update_count": 0, "firewall_enabled": True,
            "ssh_root_login_allowed": False, "sudo_users_count": 1,
            "unnecessary_services": [], "disk_usage_percent": 10.0,
            "password_policy_ok": True, "last_seen_minutes": 0,
        }
        mock_resp = _fake_resp(200, {"total_score": 100.0, "issues": []})
        with patch("requests.post", return_value=mock_resp):
            mod.run_once(self._make_args(), collector, "http://x/report")
        captured = capsys.readouterr()
        assert "OPERATIONSCORE_RESULT:" in captured.out
        assert "OPERATIONSCORE_JSON:" in captured.out

    def test_returns_1_on_non_200(self, capsys):
        from collector import MetricsCollector
        collector = MagicMock(spec=MetricsCollector)
        collector.hostname = "test-host"
        collector.collect_metrics.return_value = {
            "hostname": "test-host", "timestamp": "2026-01-01T00:00:00+00:00",
            "update_count": 0, "firewall_enabled": True,
            "ssh_root_login_allowed": False, "sudo_users_count": 1,
            "unnecessary_services": [], "disk_usage_percent": 10.0,
            "password_policy_ok": True, "last_seen_minutes": 0,
        }
        mock_resp = _fake_resp(403, {"detail": "Device not registered"})
        with patch("requests.post", return_value=mock_resp):
            result = mod.run_once(self._make_args(), collector, "http://x/report")
        assert result == 1
        captured = capsys.readouterr()
        assert "OPERATIONSCORE_RESULT:" in captured.out
        assert "OPERATIONSCORE_JSON:" in captured.out
