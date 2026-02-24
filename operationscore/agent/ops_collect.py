#!/usr/bin/env python3
"""
ops_collect.py — OperationScore Collection Entrypoint (single official agent entrypoint)

Supports two modes:
  one-shot  (default): collect metrics, POST /report, write status, notify, print evidence lines.
  polling   (--poll): register once (if --register), then loop polling /tasks/<hostname>
                      and executing "run_scan" scans on demand.

Exit codes:
  0   — success (or --dry-run)
  1   — HTTP error, network failure, or registration failure (wrong creds)
  2   — invalid CLI argument (e.g. bad --ip)
  130 — user cancelled with Ctrl+C during registration prompt
"""

import argparse
import getpass
import ipaddress
import json
import os
import shutil
import socket
import subprocess
import sys
import time
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Path injection — ensure collector.py is importable regardless of CWD.
# ---------------------------------------------------------------------------
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from collector import MetricsCollector  # noqa: E402
from security_notify import (  # noqa: E402
    extract_security_issues,
    build_security_alert_payload,
    print_security_alert,
    try_notify_send,
)


# ---------------------------------------------------------------------------
# Risk level mapping
# ---------------------------------------------------------------------------
def _risk_level(score: float) -> str:
    if score >= 90:
        return "EXCELLENT"
    if score >= 75:
        return "LOW"
    if score >= 60:
        return "MEDIUM"
    if score >= 40:
        return "HIGH"
    return "CRITICAL"


# ---------------------------------------------------------------------------
# Parse CLI arguments
# ---------------------------------------------------------------------------
def _build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="ops_collect",
        description=(
            "Collect system metrics and report to OperationScore API. "
            "The single official agent entrypoint."
        ),
    )
    p.add_argument(
        "--api-url",
        default=None,
        help=(
            "API report endpoint URL (default: http://127.0.0.1:8000/report). "
            "When --register or --poll is used without --api-url, derived "
            "automatically from --center as <center>/report."
        ),
    )
    p.add_argument(
        "--token",
        default="",
        help="Optional bearer/API token sent as X-OPS-TOKEN header",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Collect metrics and print JSON evidence only; skip POST",
    )
    p.add_argument(
        "--write-status",
        default=str(Path.home() / ".local" / "share" / "operationscore" / "status.txt"),
        metavar="PATH",
        help="Path to status file (default: ~/.local/share/operationscore/status.txt)",
    )
    p.add_argument(
        "--no-status",
        action="store_true",
        default=False,
        help="Do not write status.txt",
    )
    p.add_argument(
        "--notify",
        action="store_true",
        default=False,
        help="Send desktop notification when score is below --critical-threshold",
    )
    p.add_argument(
        "--critical-threshold",
        type=int,
        default=60,
        metavar="N",
        help="Score threshold below which a notification is sent (default: 60)",
    )
    p.add_argument(
        "--timeout",
        type=int,
        default=5,
        help="HTTP request timeout in seconds (default: 5)",
    )
    p.add_argument(
        "--print-pretty",
        action="store_true",
        default=False,
        help="Print extra debug JSON before the required output lines",
    )

    # -----------------------------------------------------------------------
    # Registration arguments
    # -----------------------------------------------------------------------
    p.add_argument(
        "--register",
        action="store_true",
        default=False,
        help=(
            "Perform interactive agent self-registration (prompts for username "
            "and password) before sending a report. In --poll mode, registration "
            "happens once at startup."
        ),
    )
    p.add_argument(
        "--center",
        default=None,
        metavar="URL",
        help=(
            "Base URL of the OperationScore server, e.g. http://127.0.0.1:8000. "
            "Derives register URL (<center>/api/register), report URL (<center>/report), "
            "and task URL (<center>/tasks/<hostname>)."
        ),
    )
    p.add_argument(
        "--ip",
        default=None,
        metavar="IPv4",
        help=(
            "IPv4 address to register as. If omitted, auto-detected from "
            "the outbound network interface."
        ),
    )

    # -----------------------------------------------------------------------
    # Polling arguments
    # -----------------------------------------------------------------------
    p.add_argument(
        "--poll",
        action="store_true",
        default=False,
        help=(
            "Enable polling mode: continuously poll /tasks/<hostname> and execute "
            "'run_scan' commands. Ctrl+C exits cleanly with code 0."
        ),
    )
    p.add_argument(
        "--poll-interval",
        type=int,
        default=10,
        metavar="SECONDS",
        help="Seconds between task polls in polling mode (default: 10)",
    )
    return p


def _pad(lst: List[str], idx: int) -> str:
    return lst[idx] if idx < len(lst) else ""


# ---------------------------------------------------------------------------
# IP auto-detection
# ---------------------------------------------------------------------------
def _detect_local_ipv4() -> Optional[str]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            detected = s.getsockname()[0]
        finally:
            s.close()
        addr = ipaddress.ip_address(detected)
        if addr.version == 4 and not addr.is_loopback:
            return detected
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Status file writer
# ---------------------------------------------------------------------------
def _write_status(path: str, score: float, risk: str, reasons: List[str], actions: List[str]) -> None:
    try:
        status_path = Path(path)
        os.makedirs(status_path.parent, exist_ok=True)
        timestamp = datetime.now(timezone.utc).isoformat()
        content = (
            f"OperationScore: {score}/100 ({risk})\n"
            f"Top: {_pad(reasons,0)}; {_pad(reasons,1)}; {_pad(reasons,2)}\n"
            f"Todo: {_pad(actions,0)} | {_pad(actions,1)} | {_pad(actions,2)}\n"
            f"Last: {timestamp}\n"
        )
        status_path.write_text(content, encoding="utf-8")
    except Exception as exc:
        print(f"[ops_collect] WARNING: could not write status file {path!r}: {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Notification helper
# ---------------------------------------------------------------------------
def _notify(score: float, risk: str, actions: List[str]) -> None:
    a1, a2, a3 = _pad(actions, 0), _pad(actions, 1), _pad(actions, 2)
    score_int = int(round(score))
    print(f"OPERATIONSCORE_ALERT: Score {score_int} {risk} | Todo: {a1} ; {a2} ; {a3}")
    if shutil.which("notify-send"):
        try:
            body = f"Skor: {score}/100 ({risk})"
            for i, a in enumerate([a1, a2, a3], 1):
                if a:
                    body += f"\n{i}) {a}"
            subprocess.run(
                ["notify-send", "OperationScore Uyarısı", body],
                timeout=3,
                capture_output=True,
            )
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Interactive registration
# ---------------------------------------------------------------------------
def _do_interactive_register(
    register_url: str,
    hostname: str,
    ip: str,
    timeout: int,
    max_attempts: int = 3,
) -> None:
    """
    Prompt for username/password and POST to register_url.
    Returns normally on success.
    Exits with code 1 on auth failure or network error.
    Exits with code 130 on Ctrl+C.
    """
    import requests

    for attempt in range(1, max_attempts + 1):
        try:
            username = input("Username: ")
            password = getpass.getpass("Password: ")
        except KeyboardInterrupt:
            print()
            out = {"ok": False, "error": "CANCELLED"}
            print(f"OPERATIONSCORE_REGISTER: {json.dumps(out, separators=(',', ':'))}")
            sys.exit(130)

        try:
            response = requests.post(
                register_url,
                json={
                    "hostname": hostname,
                    "ip": ip,
                    "username": username,
                    "password": password,
                },
                headers={"Content-Type": "application/json"},
                timeout=(5, 10),
            )
        except Exception as exc:
            out = {"ok": False, "error": "REQUEST_FAILED", "detail": str(exc)}
            print(f"OPERATIONSCORE_REGISTER: {json.dumps(out, separators=(',', ':'))}")
            sys.exit(1)

        if response.status_code == 200:
            try:
                body = response.json()
            except Exception:
                body = {}
            device_type = body.get("device_type", "UNKNOWN")
            out = {"ok": True, "hostname": hostname, "device_type": device_type}
            print(f"OPERATIONSCORE_REGISTER: {json.dumps(out, separators=(',', ':'))}")
            return

        if response.status_code == 401:
            print(f"[ops_collect] Invalid credentials (attempt {attempt}/{max_attempts})")
            if attempt == max_attempts:
                out = {"ok": False, "error": "UNAUTHORIZED", "detail": "Invalid credentials"}
                print(f"OPERATIONSCORE_REGISTER: {json.dumps(out, separators=(',', ':'))}")
                sys.exit(1)
            continue

        # Non-200, non-401
        short_body = response.text[:200].replace("\n", " ").replace("\r", "")
        out = {"ok": False, "error": f"HTTP_{response.status_code}", "detail": short_body}
        print(f"OPERATIONSCORE_REGISTER: {json.dumps(out, separators=(',', ':'))}")
        sys.exit(1)


def _attempt_auto_register(register_url: str, hostname: str, ip: str, username: str, password: str, timeout: int, max_attempts: int = 5) -> bool:
    """Attempt non-interactive registration with exponential backoff. Returns True on success."""
    try:
        import requests
    except Exception:
        print(f"REGISTER failed: requests not installed", file=sys.stderr)
        return False

    attempt = 0
    while attempt < max_attempts:
        attempt += 1
        try:
            resp = requests.post(
                register_url,
                json={
                    "hostname": hostname,
                    "ip": ip,
                    "username": username,
                    "password": password,
                },
                headers={"Content-Type": "application/json"},
                timeout=(5, 10),
            )
        except Exception as exc:
            short = str(exc)[:200]
            print(f"REGISTER failed attempt={attempt} error={short}", file=sys.stderr)
            sleep = min(60, 2 ** attempt) + random.random()
            time.sleep(sleep)
            continue

        if resp.status_code == 200:
            try:
                body = resp.json()
            except Exception:
                body = {}
            device_type = body.get("device_type", "UNKNOWN")
            print(f"REGISTER ok hostname={hostname} device_type={device_type}")
            return True

        if resp.status_code == 401:
            print(f"REGISTER failed 401 invalid creds username={username}")
            return False

        short_body = resp.text[:200].replace('\n', ' ').replace('\r', '')
        print(f"REGISTER failed status={resp.status_code} body={short_body}")
        sleep = min(60, 2 ** attempt) + random.random()
        time.sleep(sleep)

    return False


# ---------------------------------------------------------------------------
# One-shot report: collect metrics -> POST /report -> status/notify -> print lines
# Returns exit code (0 or 1). Does NOT call sys.exit() itself.
# ---------------------------------------------------------------------------
def run_once(args, collector: MetricsCollector, report_url: str) -> int:
    """
    Collect metrics, POST to report_url, handle status/notify, print OPERATIONSCORE lines.
    Returns 0 on success, 1 on error.
    """
    # Collect metrics with a fresh timestamp
    collector.timestamp = datetime.now(timezone.utc).isoformat()
    metrics = collector.collect_metrics()
    metrics["timestamp"] = collector.timestamp

    json_line = json.dumps(metrics, separators=(",", ":"))

    try:
        import requests

        headers = {"Content-Type": "application/json"}
        if args.token:
            headers["X-OPS-TOKEN"] = args.token

        response = requests.post(
            report_url,
            json=metrics,
            headers=headers,
            timeout=(5, 10),
        )

        # Auto-register handling: if server rejects because device not registered
        if response.status_code == 403 and "Device not registered" in (response.text or ""):
            hostname = metrics.get("hostname")
            print(f"REPORT 403 not registered, attempting auto-register hostname={hostname} server={report_url}", file=sys.stderr)

            # Gather registration params from environment
            reg_url = os.environ.get("OPS_REGISTER_URL")
            reg_user = os.environ.get("OPS_REGISTER_USER")
            reg_pass = os.environ.get("OPS_REGISTER_PASS")
            reg_ip = os.environ.get("OPS_REGISTER_IP") or metrics.get("ip") or _detect_local_ipv4() or "127.0.0.1"

            if not (reg_url and reg_user and reg_pass):
                print("REGISTER failed: missing OPS_REGISTER_URL/USER/PASS environment variables", file=sys.stderr)
                short_body = response.text[:300].replace("\n", " ").replace("\r", "")
                error_obj = {"error": f"HTTP {response.status_code}", "status_code": response.status_code, "body": short_body}
                print(f"OPERATIONSCORE_RESULT: {json.dumps(error_obj, separators=(',', ':'))}")
                print(f"OPERATIONSCORE_JSON: {json_line}")
                return 1

            ok = _attempt_auto_register(reg_url, hostname, reg_ip, reg_user, reg_pass, timeout=args.timeout)
            if not ok:
                short_body = response.text[:300].replace("\n", " ").replace("\r", "")
                error_obj = {"error": f"HTTP {response.status_code}", "status_code": response.status_code, "body": short_body}
                print(f"OPERATIONSCORE_RESULT: {json.dumps(error_obj, separators=(',', ':'))}")
                print(f"OPERATIONSCORE_JSON: {json_line}")
                return 1

            # Retry report once after successful registration
            try:
                response = requests.post(report_url, json=metrics, headers=headers, timeout=(5, 10))
            except Exception as exc:
                error_obj = {"error": "REQUEST_FAILED", "detail": str(exc)}
                print(f"OPERATIONSCORE_RESULT: {json.dumps(error_obj, separators=(',', ':'))}")
                print(f"OPERATIONSCORE_JSON: {json_line}")
                return 1

        if response.status_code != 200:
            short_body = response.text[:300].replace("\n", " ").replace("\r", "")
            error_obj = {
                "error": f"HTTP {response.status_code}",
                "status_code": response.status_code,
                "body": short_body,
            }
            print(f"OPERATIONSCORE_RESULT: {json.dumps(error_obj, separators=(',', ':'))}")
            print(f"OPERATIONSCORE_JSON: {json_line}")
            return 1

    except Exception as exc:
        error_obj = {"error": "REQUEST_FAILED", "detail": str(exc)}
        print(f"OPERATIONSCORE_RESULT: {json.dumps(error_obj, separators=(',', ':'))}")
        print(f"OPERATIONSCORE_JSON: {json_line}")
        return 1

    # Parse 200 response
    try:
        report = response.json()
    except Exception:
        report = {}

    score = report.get("total_score", 0)
    issues = report.get("issues", [])
    risk = _risk_level(float(score))

    sorted_issues = sorted(issues, key=lambda i: i.get("penalty", 0), reverse=True)[:3]
    top_reasons: List[str] = []
    actions: List[str] = []
    for issue in sorted_issues:
        rule_id = issue.get("rule_id", "")
        message = issue.get("message", "")
        top_reasons.append(f"{rule_id} {message}".strip())
        rec = issue.get("recommendation") or issue.get("action") or ""
        if len(rec) > 120:
            rec = rec[:120] + "..."
        actions.append(rec)

    # Write status file
    if not args.no_status:
        _write_status(args.write_status, score, risk, top_reasons, actions)

    # Security-issues alert (B1) — fires BEFORE score-threshold alert and BEFORE RESULT/JSON
    if args.notify:
        _sec_issues = extract_security_issues(issues)
        if _sec_issues:
            _sec_payload = build_security_alert_payload(
                hostname=metrics["hostname"],
                risk_level=risk,
                issues=_sec_issues,
            )
            print_security_alert(_sec_payload)   # OPERATIONSCORE_SECURITY_ALERT
            try_notify_send(_sec_payload)

    # Score-threshold alert (existing behavior — unchanged)
    if args.notify and score < args.critical_threshold:
        _notify(score, risk, actions)

    result_obj = {
        "score": score,
        "risk_level": risk,
        "top_reasons": top_reasons,
        "actions": actions,
    }

    if args.print_pretty:
        print("--- DEBUG REPORT ---")
        print(json.dumps(report, indent=2))
        print("--- DEBUG RESULT ---")
        print(json.dumps(result_obj, indent=2))
        print("--- END DEBUG ---")

    print(f"OPERATIONSCORE_RESULT: {json.dumps(result_obj, separators=(',', ':'))}")
    print(f"OPERATIONSCORE_JSON: {json_line}")
    return 0


# ---------------------------------------------------------------------------
# Polling loop
# ---------------------------------------------------------------------------
def _run_polling(args, collector: MetricsCollector, center: str, report_url: str) -> None:
    """
    Poll /tasks/<hostname> in a loop.
    On "run_scan" command: call run_once().
    Ctrl+C: exit 0 cleanly.
    """
    import requests

    hostname = collector.hostname
    task_url = center.rstrip("/") + "/tasks/" + hostname

    print(f"[ops_collect] polling {task_url} every {args.poll_interval}s — Ctrl+C to stop",
          file=sys.stderr)

    while True:
        try:
            try:
                resp = requests.get(task_url, timeout=args.timeout)
            except Exception as exc:
                print(f"[ops_collect] task poll error: {exc}", file=sys.stderr)
                time.sleep(args.poll_interval)
                continue

            if resp.status_code == 204:
                # No pending tasks
                time.sleep(args.poll_interval)
                continue

            if resp.status_code == 200:
                try:
                    task = resp.json()
                except Exception:
                    task = {}
                command = task.get("command", "")
                if command == "run_scan":
                    print(f"[ops_collect] run_scan received (task_id={task.get('task_id','')})",
                          file=sys.stderr)
                    run_once(args, collector, report_url)
                else:
                    print(f"[ops_collect] WARNING: unknown task command {command!r}, skipping",
                          file=sys.stderr)
                time.sleep(args.poll_interval)
                continue

            # Unexpected status
            print(f"[ops_collect] unexpected task poll status {resp.status_code}", file=sys.stderr)
            time.sleep(args.poll_interval)

        except KeyboardInterrupt:
            print("\n[ops_collect] polling stopped", file=sys.stderr)
            sys.exit(0)


# ---------------------------------------------------------------------------
# Main logic
# ---------------------------------------------------------------------------
def main() -> None:
    parser = _build_arg_parser()
    args = parser.parse_args()

    # ------------------------------------------------------------------
    # Validate --ip if supplied (exit 2 on bad value, before any network)
    # ------------------------------------------------------------------
    if args.ip is not None:
        try:
            addr = ipaddress.ip_address(args.ip)
            if addr.version != 4:
                raise ValueError("not IPv4")
        except ValueError:
            parser.error(f"--ip {args.ip!r} is not a valid IPv4 address")

    # ------------------------------------------------------------------
    # Resolve center URL and derive report/register/task URLs
    # ------------------------------------------------------------------
    if args.center:
        center = args.center.rstrip("/")
    elif args.api_url:
        parsed = urlparse(args.api_url)
        port_part = f":{parsed.port}" if parsed.port else ""
        center = f"{parsed.scheme}://{parsed.hostname}{port_part}"
    else:
        center = "http://127.0.0.1:8000"

    # Allow environment variables to specify endpoints and settings
    env_report = os.environ.get("OPS_REPORT_URL")
    env_register = os.environ.get("OPS_REGISTER_URL")

    report_url = args.api_url or env_report or (center + "/report")
    register_url = env_register or (center + "/api/register")

    # Allow poll interval override from environment
    env_poll = os.environ.get("OPS_POLL_INTERVAL_SECONDS")
    if env_poll and env_poll.isdigit():
        args.poll_interval = int(env_poll)

    # ------------------------------------------------------------------
    # 1. Collect metrics (hostname needed for registration and polling)
    # ------------------------------------------------------------------
    collector = MetricsCollector(api_url=report_url)
    collector.timestamp = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # 2. --dry-run: emit JSON only, exit 0 (no prompts, no network)
    # ------------------------------------------------------------------
    if args.dry_run:
        if args.register:
            print("[ops_collect] NOTE: --register ignored in --dry-run mode", file=sys.stderr)
        if args.poll:
            print("[ops_collect] NOTE: --poll ignored in --dry-run mode", file=sys.stderr)
        metrics = collector.collect_metrics()
        metrics["timestamp"] = collector.timestamp
        json_line = json.dumps(metrics, separators=(",", ":"))
        print(f"OPERATIONSCORE_JSON: {json_line}")
        sys.exit(0)

    # ------------------------------------------------------------------
    # 3. Interactive registration (if requested) — once, before any loop
    # ------------------------------------------------------------------
    if args.register:
        # Collect metrics first to get the real hostname
        metrics_for_hostname = collector.collect_metrics()
        reg_hostname = metrics_for_hostname["hostname"]

        if args.ip:
            reg_ip = args.ip
        else:
            reg_ip = _detect_local_ipv4()
            if reg_ip is None:
                print("[ops_collect] WARNING: could not detect IPv4, using 127.0.0.1", file=sys.stderr)
                reg_ip = "127.0.0.1"

        _do_interactive_register(
            register_url=register_url,
            hostname=reg_hostname,
            ip=reg_ip,
            timeout=args.timeout,
        )

    # ------------------------------------------------------------------
    # 4. Polling mode
    # ------------------------------------------------------------------
    if args.poll:
        _run_polling(args, collector, center, report_url)
        # _run_polling only returns if it falls through (shouldn't happen);
        # Ctrl+C exits inside the loop.
        sys.exit(0)

    # ------------------------------------------------------------------
    # 5. One-shot mode
    # ------------------------------------------------------------------
    exit_code = run_once(args, collector, report_url)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
