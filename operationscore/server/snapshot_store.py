"""
Snapshot storage utilities: atomic write and snapshot builder.

Manages the single JSON snapshot file and builds snapshot payloads from
in-memory caches.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SNAPSHOT_DIR = Path(__file__).resolve().parent / "snapshot"
LATEST_PATH = SNAPSHOT_DIR / "latest_snapshot.json"
TMP_PATH = SNAPSHOT_DIR / "latest_snapshot.json.tmp"


def risk_level(score: float) -> str:
    """
    Classify risk level based on operational health score (0-100).
    0-39 CRITICAL, 40-59 HIGH, 60-74 MEDIUM, 75-89 LOW, 90-100 EXCELLENT
    """
    s = max(0.0, min(100.0, float(score)))
    if s < 40:
        return "CRITICAL"
    if s < 60:
        return "HIGH"
    if s < 75:
        return "MEDIUM"
    if s < 90:
        return "LOW"
    return "EXCELLENT"


def iso_now() -> str:
    """Return ISO datetime string (timezone-aware UTC)."""
    return datetime.now(timezone.utc).isoformat()


def empty_snapshot(now_iso: str | None = None) -> dict:
    """Return an empty snapshot structure."""
    return {
        "generated_at": now_iso or iso_now(),
        "device_count": 0,
        "devices": [],
    }


def _get_score(report: Any) -> float | None:
    """Extract score from report (dict or object)."""
    if report is None:
        return None
    if isinstance(report, dict):
        return report.get("total_score") or report.get("score")
    return getattr(report, "total_score", None) or getattr(report, "score", None)


def _get_issues(report: Any) -> list[dict]:
    """Extract and normalize issues to list of dicts."""
    if report is None:
        return []
    raw = None
    if isinstance(report, dict):
        raw = report.get("issues", [])
    else:
        raw = getattr(report, "issues", []) or []
    out: list[dict] = []
    for item in raw or []:
        if isinstance(item, dict):
            out.append({
                "rule_id": item.get("rule_id", ""),
                "penalty": float(item.get("penalty", 0)),
                "message": item.get("message", ""),
                "recommendation": item.get("recommendation", ""),
            })
        else:
            out.append({
                "rule_id": getattr(item, "rule_id", ""),
                "penalty": float(getattr(item, "penalty", 0)),
                "message": getattr(item, "message", ""),
                "recommendation": getattr(item, "recommendation", ""),
            })
    return out


def _to_datetime_iso(val: Any, fallback: str) -> str:
    """Convert value to ISO datetime string."""
    if val is None:
        return fallback
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return val.isoformat()
    if isinstance(val, str):
        return val
    return fallback


def build_snapshot(
    device_metrics_cache: dict[str, Any],
    device_reports_cache: dict[str, Any],
    registered_devices: dict[str, datetime],
    now_iso: str | None = None,
) -> dict:
    """
    Build snapshot from caches.

    Iterates devices from device_reports_cache keys (stable sort by hostname).
    Handles both dict and pydantic report shapes.
    """
    now = now_iso or iso_now()
    devices: list[dict] = []
    hostnames = sorted(device_reports_cache.keys())

    for hostname in hostnames:
        report_data = device_reports_cache.get(hostname)
        report = report_data.get("report", report_data) if isinstance(report_data, dict) else report_data

        score = _get_score(report)
        if score is None:
            score = 0.0
        score = max(0.0, min(100.0, float(score)))

        issues = _get_issues(report)
        last_seen = registered_devices.get(hostname)
        if last_seen is None and isinstance(report_data, dict):
            last_seen = report_data.get("scored_at")
        last_seen_iso = _to_datetime_iso(last_seen, now)

        # Sort issues by penalty desc, take first 3
        sorted_issues = sorted(issues, key=lambda x: float(x.get("penalty", 0)), reverse=True)[:3]
        top_reasons = [str(x.get("rule_id", "")) + " " + str(x.get("message", "")) for x in sorted_issues]
        actions = []
        for x in sorted_issues:
            rec = str(x.get("recommendation", ""))
            if len(rec) > 120:
                rec = rec[:117].rstrip() + "…"
            actions.append(rec)

        devices.append({
            "hostname": hostname,
            "last_seen": last_seen_iso,
            "score": score,
            "risk_level": risk_level(score),
            "top_reasons": top_reasons,
            "actions": actions,
            "issues": issues,
        })

    return {
        "generated_at": now,
        "device_count": len(devices),
        "devices": devices,
    }


def atomic_write_snapshot(snapshot: dict) -> None:
    """Write snapshot to TMP_PATH then atomically replace LATEST_PATH."""
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    with open(TMP_PATH, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
    os.replace(TMP_PATH, LATEST_PATH)


def read_or_create_snapshot() -> dict:
    """
    Read LATEST_PATH if it exists; otherwise create empty_snapshot(),
    write it atomically, and return it.
    """
    if not LATEST_PATH.exists():
        snap = empty_snapshot()
        atomic_write_snapshot(snap)
        return snap
    try:
        with open(LATEST_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("Invalid snapshot: not a dict")
        return data
    except (json.JSONDecodeError, OSError, ValueError):
        snap = empty_snapshot()
        atomic_write_snapshot(snap)
        return snap
