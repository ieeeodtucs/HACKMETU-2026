"""
tests/test_ops_collect_polling.py

Unit tests for the --poll loop in ops_collect.py.
All network calls and time.sleep are mocked — no real server.

Scenarios:
  - 204, 204, then run_scan 200 → exactly one report POST
  - unknown command → no report POST, no crash
  - Ctrl+C during poll → sys.exit(0)
  - network error during poll → loop continues (no crash)
"""

import argparse
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

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


def _make_args(poll_interval: int = 1):
    """Build a minimal Namespace compatible with run_once() and _run_polling()."""
    return argparse.Namespace(
        token="",
        timeout=5,
        no_status=True,
        notify=False,
        critical_threshold=60,
        print_pretty=False,
        write_status="/tmp/test_poll_status.txt",
        poll_interval=poll_interval,
    )


def _make_collector(hostname: str = "poll-host"):
    """Return a MagicMock MetricsCollector with a sensible collect_metrics() result."""
    from collector import MetricsCollector
    c = MagicMock(spec=MetricsCollector)
    c.hostname = hostname
    c.collect_metrics.return_value = {
        "hostname": hostname,
        "timestamp": "2026-01-01T00:00:00+00:00",
        "update_count": 0,
        "firewall_enabled": True,
        "ssh_root_login_allowed": False,
        "sudo_users_count": 1,
        "unnecessary_services": [],
        "disk_usage_percent": 10.0,
        "password_policy_ok": True,
        "last_seen_minutes": 0,
    }
    return c


# ---------------------------------------------------------------------------
# Test: 204 × 2 then run_scan → exactly one /report POST, correct output
# ---------------------------------------------------------------------------

class TestPollRunScan:

    def test_run_scan_triggers_exactly_one_report_post(self, capsys):
        """
        GET sequence: 204, 204, 200(run_scan) → then KeyboardInterrupt on next sleep.
        Exactly one POST to /report must happen.
        """
        task_resp = _fake_resp(200, {"command": "run_scan", "task_id": "abc123"})
        report_resp = _fake_resp(200, {"total_score": 95.0, "issues": []})

        get_side_effects = [
            _fake_resp(204, {}),
            _fake_resp(204, {}),
            task_resp,
        ]

        # After run_scan executes (1 report POST), next sleep raises KeyboardInterrupt
        sleep_side_effects = [None, None, None, KeyboardInterrupt("stop")]

        args = _make_args(poll_interval=1)
        collector = _make_collector()

        with patch("requests.get", side_effect=get_side_effects) as mock_get, \
             patch("requests.post", return_value=report_resp) as mock_post, \
             patch("time.sleep", side_effect=sleep_side_effects):
            with pytest.raises(SystemExit) as exc_info:
                mod._run_polling(args, collector, "http://x", "http://x/report")

        assert exc_info.value.code == 0
        mock_post.assert_called_once()
        captured = capsys.readouterr()
        assert "OPERATIONSCORE_RESULT:" in captured.out
        assert "OPERATIONSCORE_JSON:" in captured.out

    def test_run_scan_result_score_in_output(self, capsys):
        """Ensure the score from the server appears in OPERATIONSCORE_RESULT."""
        task_resp = _fake_resp(200, {"command": "run_scan", "task_id": "t1"})
        report_resp = _fake_resp(200, {"total_score": 77.5, "issues": []})

        get_effects = [task_resp]
        sleep_effects = [KeyboardInterrupt("stop")]

        args = _make_args()
        collector = _make_collector()

        with patch("requests.get", side_effect=get_effects), \
             patch("requests.post", return_value=report_resp), \
             patch("time.sleep", side_effect=sleep_effects):
            with pytest.raises(SystemExit):
                mod._run_polling(args, collector, "http://x", "http://x/report")

        captured = capsys.readouterr()
        assert "77.5" in captured.out


# ---------------------------------------------------------------------------
# Test: unknown command → no /report POST
# ---------------------------------------------------------------------------

class TestPollUnknownCommand:

    def test_unknown_command_no_report_posted(self):
        task_resp = _fake_resp(200, {"command": "mystery_op", "task_id": "xyz"})
        get_effects = [task_resp]
        sleep_effects = [KeyboardInterrupt("stop")]

        args = _make_args()
        collector = _make_collector()

        with patch("requests.get", side_effect=get_effects), \
             patch("requests.post") as mock_post, \
             patch("time.sleep", side_effect=sleep_effects):
            with pytest.raises(SystemExit):
                mod._run_polling(args, collector, "http://x", "http://x/report")

        mock_post.assert_not_called()

    def test_unknown_command_warning_logged(self, capsys):
        task_resp = _fake_resp(200, {"command": "mystery_op", "task_id": "xyz"})
        get_effects = [task_resp]
        sleep_effects = [KeyboardInterrupt("stop")]

        args = _make_args()
        collector = _make_collector()

        with patch("requests.get", side_effect=get_effects), \
             patch("requests.post"), \
             patch("time.sleep", side_effect=sleep_effects):
            with pytest.raises(SystemExit):
                mod._run_polling(args, collector, "http://x", "http://x/report")

        # Warning goes to stderr
        captured = capsys.readouterr()
        assert "mystery_op" in captured.err or "WARNING" in captured.err


# ---------------------------------------------------------------------------
# Test: KeyboardInterrupt during GET → exit 0
# ---------------------------------------------------------------------------

class TestPollKeyboardInterruptOnGet:

    def test_keyboard_interrupt_on_first_get_exits_0(self):
        args = _make_args()
        collector = _make_collector()

        with patch("requests.get", side_effect=KeyboardInterrupt("stop")):
            with pytest.raises(SystemExit) as exc_info:
                mod._run_polling(args, collector, "http://x", "http://x/report")

        assert exc_info.value.code == 0

    def test_keyboard_interrupt_does_not_post(self):
        args = _make_args()
        collector = _make_collector()

        with patch("requests.get", side_effect=KeyboardInterrupt("stop")), \
             patch("requests.post") as mock_post:
            with pytest.raises(SystemExit):
                mod._run_polling(args, collector, "http://x", "http://x/report")

        mock_post.assert_not_called()


# ---------------------------------------------------------------------------
# Test: network error during GET → loop continues (no crash)
# ---------------------------------------------------------------------------

class TestPollNetworkError:

    def test_connection_error_continues_loop(self):
        """GET raises ConnectionError, next iteration raises KeyboardInterrupt → exits 0."""
        import requests as req_mod

        get_effects = [req_mod.exceptions.ConnectionError("down"), KeyboardInterrupt("stop")]
        sleep_effects = [None]  # one sleep after the connection error

        args = _make_args()
        collector = _make_collector()

        with patch("requests.get", side_effect=get_effects), \
             patch("time.sleep", side_effect=sleep_effects):
            with pytest.raises(SystemExit) as exc_info:
                mod._run_polling(args, collector, "http://x", "http://x/report")

        assert exc_info.value.code == 0

    def test_connection_error_no_report_posted(self):
        import requests as req_mod

        get_effects = [req_mod.exceptions.ConnectionError("down"), KeyboardInterrupt("stop")]
        sleep_effects = [None]

        args = _make_args()
        collector = _make_collector()

        with patch("requests.get", side_effect=get_effects), \
             patch("requests.post") as mock_post, \
             patch("time.sleep", side_effect=sleep_effects):
            with pytest.raises(SystemExit):
                mod._run_polling(args, collector, "http://x", "http://x/report")

        mock_post.assert_not_called()


# ---------------------------------------------------------------------------
# Test: task URL is correctly formed from center + hostname
# ---------------------------------------------------------------------------

class TestPollTaskUrl:

    def test_task_url_uses_center_and_hostname(self):
        """Verify GET is called at <center>/tasks/<hostname>."""
        args = _make_args()
        collector = _make_collector(hostname="my-machine")

        get_effects = [KeyboardInterrupt("stop")]

        with patch("requests.get", side_effect=get_effects) as mock_get:
            with pytest.raises(SystemExit):
                mod._run_polling(args, collector, "http://server:8000", "http://server:8000/report")

        call_url = mock_get.call_args[0][0]
        assert call_url == "http://server:8000/tasks/my-machine"

    def test_center_trailing_slash_stripped(self):
        args = _make_args()
        collector = _make_collector(hostname="h")

        with patch("requests.get", side_effect=KeyboardInterrupt("stop")) as mock_get:
            with pytest.raises(SystemExit):
                mod._run_polling(args, collector, "http://s:8000/", "http://s:8000/report")

        call_url = mock_get.call_args[0][0]
        assert call_url == "http://s:8000/tasks/h"
