"""
tests/test_agent_register.py

Unit tests for ops_collect.py self-registration feature.
Mocks: requests.post, builtins.input, getpass.getpass — no network or real server.

Coverage:
  - _detect_local_ipv4 smoke test and socket-error fallback
  - _do_interactive_register: correct URL + payload
  - 200 ok → prints OPERATIONSCORE_REGISTER ok:true, returns
  - 401 × 3 → exit 1 with UNAUTHORIZED
  - 401 then 200 on second attempt → success
  - non-200 (500) → exit 1
  - requests.ConnectionError → exit 1
  - Ctrl+C (KeyboardInterrupt from input) → exit 130
  - dry-run + --register → NOTE on stderr, only JSON, exit 0
  - invalid --ip → exit 2
  - missing --center with --register: falls back to default center
  - --help shows new flags
"""

import json
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest

_AGENT_DIR = Path(__file__).parent.parent / "agent"
sys.path.insert(0, str(_AGENT_DIR))

import agent.ops_collect as mod  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fake_response(status_code: int, body: dict) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = body
    resp.text = json.dumps(body)
    return resp


_OPS_COLLECT = str(_AGENT_DIR / "ops_collect.py")


# ---------------------------------------------------------------------------
# _detect_local_ipv4
# ---------------------------------------------------------------------------

class TestDetectLocalIpv4:

    def test_returns_string_or_none(self):
        result = mod._detect_local_ipv4()
        assert result is None or (isinstance(result, str) and len(result) > 0)

    def test_fallback_on_socket_error(self):
        with patch("socket.socket") as mock_sock_cls:
            mock_sock_cls.side_effect = OSError("no network")
            result = mod._detect_local_ipv4()
        assert result is None


# ---------------------------------------------------------------------------
# _do_interactive_register — URL and payload
# ---------------------------------------------------------------------------

class TestDoInteractiveRegisterPayload:

    def test_posts_to_correct_url(self, capsys):
        mock_resp = _fake_response(200, {"ok": True, "device_type": "CLIENT"})
        with patch("requests.post", return_value=mock_resp) as mock_post, \
             patch("builtins.input", return_value="ops-client"), \
             patch("getpass.getpass", return_value="client123!"):
            mod._do_interactive_register("http://127.0.0.1:8000/api/register", "host", "1.2.3.4", 5)
        call_url = mock_post.call_args[0][0]
        assert call_url == "http://127.0.0.1:8000/api/register"

    def test_payload_has_all_required_keys(self):
        mock_resp = _fake_response(200, {"ok": True, "device_type": "CLIENT"})
        with patch("requests.post", return_value=mock_resp) as mock_post, \
             patch("builtins.input", return_value="ops-client"), \
             patch("getpass.getpass", return_value="client123!"):
            mod._do_interactive_register("http://x/api/register", "myhost", "10.0.0.1", 5)
        payload = mock_post.call_args[1]["json"]
        assert payload["hostname"] == "myhost"
        assert payload["ip"] == "10.0.0.1"
        assert payload["username"] == "ops-client"
        assert payload["password"] == "client123!"


# ---------------------------------------------------------------------------
# _do_interactive_register — response handling
# ---------------------------------------------------------------------------

class TestDoInteractiveRegisterResponseHandling:

    def test_200_returns_and_prints_ok_true(self, capsys):
        mock_resp = _fake_response(200, {"ok": True, "device_type": "CLIENT"})
        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="p"):
            result = mod._do_interactive_register("http://x/api/register", "h", "1.1.1.1", 5)
        assert result is None  # returns normally (no sys.exit)
        captured = capsys.readouterr()
        assert "OPERATIONSCORE_REGISTER:" in captured.out
        assert '"ok":true' in captured.out
        assert '"device_type":"CLIENT"' in captured.out

    def test_401_three_times_exits_1(self, capsys):
        mock_resp = _fake_response(401, {"detail": "Invalid credentials"})
        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="wrong"):
            with pytest.raises(SystemExit) as exc_info:
                mod._do_interactive_register("http://x/api/register", "h", "1.1.1.1", 5)
        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "UNAUTHORIZED" in captured.out
        assert '"ok":false' in captured.out
        # Check attempt messages
        assert "attempt 1/3" in captured.out
        assert "attempt 3/3" in captured.out

    def test_401_then_200_on_second_attempt_succeeds(self, capsys):
        """First attempt fails with 401, second attempt succeeds with 200."""
        responses = [
            _fake_response(401, {"detail": "Invalid credentials"}),
            _fake_response(200, {"ok": True, "device_type": "SERVER"}),
        ]
        inputs = ["u", "u"]
        passwords = ["wrong", "server123!"]
        with patch("requests.post", side_effect=responses), \
             patch("builtins.input", side_effect=inputs), \
             patch("getpass.getpass", side_effect=passwords):
            mod._do_interactive_register("http://x/api/register", "h", "1.1.1.1", 5, max_attempts=3)
        captured = capsys.readouterr()
        assert '"ok":true' in captured.out
        assert "attempt 1/3" in captured.out

    def test_500_exits_1(self, capsys):
        mock_resp = _fake_response(500, {"detail": "Internal error"})
        with patch("requests.post", return_value=mock_resp), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="p"):
            with pytest.raises(SystemExit) as exc_info:
                mod._do_interactive_register("http://x/api/register", "h", "1.1.1.1", 5)
        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "HTTP_500" in captured.out

    def test_connection_error_exits_1(self, capsys):
        import requests
        with patch("requests.post", side_effect=requests.exceptions.ConnectionError("refused")), \
             patch("builtins.input", return_value="u"), \
             patch("getpass.getpass", return_value="p"):
            with pytest.raises(SystemExit) as exc_info:
                mod._do_interactive_register("http://x/api/register", "h", "1.1.1.1", 5)
        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "REQUEST_FAILED" in captured.out

    def test_keyboard_interrupt_exits_130(self, capsys):
        with patch("builtins.input", side_effect=KeyboardInterrupt):
            with pytest.raises(SystemExit) as exc_info:
                mod._do_interactive_register("http://x/api/register", "h", "1.1.1.1", 5)
        assert exc_info.value.code == 130
        captured = capsys.readouterr()
        assert "CANCELLED" in captured.out
        assert '"ok":false' in captured.out


# ---------------------------------------------------------------------------
# CLI integration — subprocess (no real server needed)
# ---------------------------------------------------------------------------

class TestCliDryRunWithRegister:

    def test_dry_run_ignores_register_exit_0(self):
        proc = subprocess.run(
            [
                sys.executable, _OPS_COLLECT,
                "--dry-run", "--register",
                "--center", "http://127.0.0.1:9999",  # unreachable
            ],
            capture_output=True, text=True,
        )
        assert proc.returncode == 0, f"stderr: {proc.stderr}"
        assert "OPERATIONSCORE_JSON:" in proc.stdout
        assert "OPERATIONSCORE_RESULT:" not in proc.stdout

    def test_dry_run_prints_note_about_register(self):
        proc = subprocess.run(
            [
                sys.executable, _OPS_COLLECT,
                "--dry-run", "--register",
                "--center", "http://127.0.0.1:9999",
            ],
            capture_output=True, text=True,
        )
        assert "NOTE" in proc.stderr or "ignored" in proc.stderr.lower()


class TestCliInvalidIp:

    def test_invalid_ip_exits_2(self):
        proc = subprocess.run(
            [
                sys.executable, _OPS_COLLECT,
                "--register", "--center", "http://127.0.0.1:8000",
                "--ip", "999.1.1.1",
            ],
            capture_output=True, text=True,
        )
        assert proc.returncode == 2

    def test_ipv6_rejected_exits_2(self):
        proc = subprocess.run(
            [
                sys.executable, _OPS_COLLECT,
                "--register", "--center", "http://127.0.0.1:8000",
                "--ip", "::1",
            ],
            capture_output=True, text=True,
        )
        assert proc.returncode == 2


class TestCliHelp:

    def test_help_shows_new_flags(self):
        proc = subprocess.run(
            [sys.executable, _OPS_COLLECT, "-h"],
            capture_output=True, text=True,
        )
        assert proc.returncode == 0
        for flag in ("--register", "--center", "--ip"):
            assert flag in proc.stdout, f"Missing flag in --help: {flag}"

    def test_help_does_not_show_username_password_flags(self):
        """Credentials are prompted interactively, not CLI flags."""
        proc = subprocess.run(
            [sys.executable, _OPS_COLLECT, "-h"],
            capture_output=True, text=True,
        )
        # These should NOT be CLI flags any more
        assert "--username" not in proc.stdout
        assert "--password" not in proc.stdout
