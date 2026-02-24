"""
server/db_models.py — SQLAlchemy 2.0 ORM models (Mapped / mapped_column style).

Tables:
  auth_accounts   — bcrypt-hashed credentials for server/client roles
  devices         — registered devices
  device_reports  — per-device health-score history
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from server.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# auth_accounts
# ---------------------------------------------------------------------------
class AuthAccount(Base):
    __tablename__ = "auth_accounts"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    username:      Mapped[str]      = mapped_column(String(64),  unique=True, index=True, nullable=False)
    password_hash: Mapped[str]      = mapped_column(String(255), nullable=False)
    role:          Mapped[str]      = mapped_column(String(16),  nullable=False)        # "SERVER"|"CLIENT"
    can_register:  Mapped[bool]     = mapped_column(Boolean,     default=True, nullable=False)
    created_at:    Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )


# ---------------------------------------------------------------------------
# devices
# ---------------------------------------------------------------------------
class Device(Base):
    __tablename__ = "devices"

    id:            Mapped[int]           = mapped_column(Integer,  primary_key=True, autoincrement=True)
    hostname:      Mapped[str]           = mapped_column(String(255), unique=True, index=True, nullable=False)
    registered_ip: Mapped[str]           = mapped_column(String(64),  nullable=False)
    last_seen_ip:  Mapped[Optional[str]] = mapped_column(String(64),  nullable=True)
    device_type:   Mapped[str]           = mapped_column(String(16),  nullable=False)   # "SERVER"|"CLIENT"
    registered_at: Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    last_seen_at:  Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    is_active:     Mapped[bool]          = mapped_column(Boolean, default=True, nullable=False)

    reports: Mapped[list["DeviceReport"]] = relationship(
        "DeviceReport",
        back_populates="device",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


Index("ix_devices_device_type", Device.device_type)


# ---------------------------------------------------------------------------
# device_reports
# ---------------------------------------------------------------------------
class DeviceReport(Base):
    __tablename__ = "device_reports"

    id:               Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id:        Mapped[int]      = mapped_column(
        Integer, ForeignKey("devices.id", ondelete="CASCADE"), index=True, nullable=False
    )
    collected_at:     Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_score:      Mapped[float]    = mapped_column(Float,      nullable=False)
    risk_level:       Mapped[str]      = mapped_column(String(16), nullable=False)
    metrics_json:     Mapped[str]      = mapped_column(Text,       nullable=False)
    issues_json:      Mapped[str]      = mapped_column(Text,       nullable=False)
    top_reasons_json: Mapped[str]      = mapped_column(Text,       nullable=False)
    actions_json:     Mapped[str]      = mapped_column(Text,       nullable=False)

    device: Mapped["Device"] = relationship("Device", back_populates="reports")


Index(
    "ix_device_reports_device_id_collected_at",
    DeviceReport.device_id,
    DeviceReport.collected_at,
)
