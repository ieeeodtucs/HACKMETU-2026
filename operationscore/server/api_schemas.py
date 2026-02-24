"""
server/api_schemas.py — Pydantic v2 request/response schemas.

Covers:
  POST /api/register
  GET  /api/devices
  GET  /api/devices/{hostname}/history
  GET  /api/fleet/history
"""

import ipaddress
import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# A) Register
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=255)
    ip: str = Field(..., description="IPv4 address")
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("hostname")
    @classmethod
    def hostname_alnum_dot_hyphen(cls, v: str) -> str:
        if not re.fullmatch(r"^[a-zA-Z0-9.\-]+$", v):
            raise ValueError("Invalid hostname")
        return v

    @field_validator("ip")
    @classmethod
    def ipv4_only(cls, v: str) -> str:
        try:
            addr = ipaddress.ip_address(v)
        except ValueError:
            raise ValueError("Invalid IPv4 address")
        if addr.version != 4:
            raise ValueError("Invalid IPv4 address")
        return v


class RegisterResponse(BaseModel):
    ok: bool
    device_type: str
    message: str


# ---------------------------------------------------------------------------
# B/C/D) Device list
# ---------------------------------------------------------------------------


class DeviceListItem(BaseModel):
    hostname: str
    device_type: str
    registered_ip: str
    last_seen_ip: Optional[str] = None
    last_seen_at: Optional[str] = None   # ISO string
    latest_score: Optional[float] = None
    risk_level: Optional[str] = None
    improvement_total: Optional[float] = None
    top_reasons_json: Optional[str] = None   # JSON array string of top issue reasons
    actions_json: Optional[str] = None       # JSON array string of recommended actions


class DevicesListResponse(BaseModel):
    device_count: int
    devices: list[DeviceListItem]


# ---------------------------------------------------------------------------
# E/F) Device history
# ---------------------------------------------------------------------------


class DeviceHistoryPoint(BaseModel):
    timestamp: str   # ISO
    score: float


class DeviceHistoryResponse(BaseModel):
    hostname: str
    points: list[DeviceHistoryPoint]


# ---------------------------------------------------------------------------
# G/H) Fleet history
# ---------------------------------------------------------------------------


class FleetHistoryPoint(BaseModel):
    timestamp: str   # ISO
    fleet_avg: float
    server_avg: Optional[float] = None
    client_avg: Optional[float] = None
    critical_count: int


class FleetHistoryResponse(BaseModel):
    points: list[FleetHistoryPoint]
