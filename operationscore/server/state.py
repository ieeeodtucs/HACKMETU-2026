"""
Shared in-memory state for the server.

Centralizes caches and registries used across endpoints and subsystems.
"""

from typing import Any
from datetime import datetime

# Store latest metrics for each device by hostname
# Format: {hostname: DeviceMetrics}
device_metrics_cache: dict[str, Any] = {}

# Store latest scoring reports for each device by hostname
# Format: {hostname: {"report": ScoreReport, "timestamp": datetime}} or similar
device_reports_cache: dict[str, Any] = {}

# Device registry: tracks registered devices and their last seen timestamp
# Format: {hostname: datetime}
registered_devices: dict[str, datetime] = {}

# Active WebSocket client connections (for future use)
ws_clients: set[Any] = set()
