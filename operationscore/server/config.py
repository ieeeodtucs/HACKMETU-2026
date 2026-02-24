"""
server/config.py — Centralized demo-safe configuration defaults.

Reads from environment variables. Never crashes on missing or malformed values.
Exposes four module-level constants and the get_allow_origins() helper
(called by main.py's CORSMiddleware setup).
"""

import os


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default).strip()


def _env_int(key: str, default: int) -> int:
    """
    Read an env var as int. Falls back to *default* if:
      - var is missing / empty
      - var is not a parseable integer
      - parsed value is <= 0
    """
    raw = os.environ.get(key, "").strip()
    if not raw:
        return default
    try:
        val = int(raw)
    except (ValueError, TypeError):
        return default
    return val if val > 0 else default


def get_allow_origins() -> list[str]:
    """
    Parse API_ALLOW_ORIGINS env var.

    Returns ["*"] if the var is missing, empty, or "*".
    Otherwise splits by comma, strips whitespace, drops empty entries.
    Falls back to ["*"] if the final list is empty.
    """
    raw = _env("API_ALLOW_ORIGINS", "*")
    if not raw or raw == "*":
        return ["*"]
    parsed = [x.strip() for x in raw.split(",") if x.strip()]
    return parsed if parsed else ["*"]


# ---------------------------------------------------------------------------
# Module-level constants (the four required exports)
# ---------------------------------------------------------------------------

API_ALLOW_ORIGINS: list[str] = get_allow_origins()

MAX_HISTORY_LIMIT: int = _env_int("MAX_HISTORY_LIMIT", 200)

_raw_device = _env_int("DEFAULT_DEVICE_HISTORY_LIMIT", 100)
DEFAULT_DEVICE_HISTORY_LIMIT: int = min(_raw_device, MAX_HISTORY_LIMIT)

_raw_fleet = _env_int("DEFAULT_FLEET_HISTORY_LIMIT", 200)
DEFAULT_FLEET_HISTORY_LIMIT: int = min(_raw_fleet, MAX_HISTORY_LIMIT)
