"""
agent/security_notify.py — shared security-alert helper (stdlib only).

Provides functions to:
  - Filter and sort issues to find security-relevant ones (K1/K2/K3/K4/K5/K7)
  - Build a compact JSON payload for OPERATIONSCORE_SECURITY_ALERT output
  - Print the alert line to stdout (guaranteed; survives redirects/cron)
  - Attempt a desktop popup via notify-send (swallows all exceptions)

No third-party dependencies; uses only json / shutil / subprocess / sys.
"""

import json
import shutil
import subprocess
import sys
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Security rule IDs that trigger the alert path
# ---------------------------------------------------------------------------
SECURITY_RULE_IDS = {"K1", "K2", "K3", "K4", "K5", "K7"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def truncate(s: str, n: int) -> str:
    """Return s truncated to n chars, appending '...' if truncated."""
    if len(s) > n:
        return s[:n] + "..."
    return s


def extract_security_issues(issues: List[Dict], limit: int = 3) -> List[Dict]:
    """
    Filter issues to those with rule_id in SECURITY_RULE_IDS,
    sort by penalty descending, and return the top *limit*.

    Args:
        issues: List of issue dicts from /report response
                (each has rule_id, penalty, message, recommendation).
        limit:  Maximum number of issues to return (default 3).

    Returns:
        Filtered and sorted list (at most *limit* entries).
    """
    security = [i for i in issues if i.get("rule_id", "") in SECURITY_RULE_IDS]
    security.sort(key=lambda i: i.get("penalty", 0.0), reverse=True)
    return security[:limit]


def build_security_alert_payload(
    hostname: str,
    risk_level: str,
    issues: List[Dict],
) -> Dict:
    """
    Build the compact payload for OPERATIONSCORE_SECURITY_ALERT.

    Args:
        hostname:   Device hostname.
        risk_level: Risk string (EXCELLENT/LOW/MEDIUM/HIGH/CRITICAL).
        issues:     Already-filtered and sorted security issues list.

    Returns:
        Dict with keys: hostname, count, issues (list[str]), actions (list[str]), risk_level.
    """
    issue_strings: List[str] = []
    action_strings: List[str] = []

    for iss in issues:
        rule_id = iss.get("rule_id", "")
        message = iss.get("message", "")
        entry = f"{rule_id} {message}".strip()
        issue_strings.append(truncate(entry, 140))

        rec = iss.get("recommendation") or iss.get("action") or ""
        action_strings.append(truncate(rec, 120))

    return {
        "hostname": hostname,
        "count": len(issues),
        "issues": issue_strings,
        "actions": action_strings,
        "risk_level": risk_level,
    }


# ---------------------------------------------------------------------------
# Output functions
# ---------------------------------------------------------------------------

def print_security_alert(payload: Dict) -> None:
    """Print OPERATIONSCORE_SECURITY_ALERT: <compact JSON> to stdout."""
    print(
        "OPERATIONSCORE_SECURITY_ALERT: "
        + json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    )
    sys.stdout.flush()


def try_notify_send(payload: Dict) -> None:
    """
    Attempt a desktop popup via notify-send.

    Silently does nothing if notify-send is absent or any error occurs.
    Never raises.
    """
    if not shutil.which("notify-send"):
        return

    try:
        hostname = payload.get("hostname", "")
        risk_level = payload.get("risk_level", "")
        issues = payload.get("issues", [])
        actions = payload.get("actions", [])

        title = "OperationScore Security Alert"

        body_parts = [f"Host: {hostname}", f"Risk: {risk_level}"]
        for i, issue_str in enumerate(issues, 1):
            body_parts.append(f"{i}) {issue_str}")
        if actions:
            body_parts.append("")
            body_parts.append("Todo:")
            for i, action_str in enumerate(actions, 1):
                body_parts.append(f"{i}) {action_str}")

        body = "\n".join(body_parts)

        subprocess.run(
            ["notify-send", title, body],
            timeout=3,
            capture_output=True,
        )
    except Exception:
        pass
