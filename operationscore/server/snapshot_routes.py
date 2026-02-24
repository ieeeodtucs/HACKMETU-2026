"""
Snapshot API routes.

Endpoints for reading, rebuilding, and resetting the snapshot.
"""

from fastapi import APIRouter

from . import state
from .snapshot_store import (
    atomic_write_snapshot,
    build_snapshot,
    empty_snapshot,
    read_or_create_snapshot,
)

router = APIRouter()


@router.get("/latest")
async def get_snapshot_latest():
    """Return the latest snapshot from disk, or create an empty one if missing."""
    return read_or_create_snapshot()


@router.post("/rebuild")
async def post_snapshot_rebuild():
    """Rebuild snapshot from caches and write atomically."""
    snapshot = build_snapshot(
        state.device_metrics_cache,
        state.device_reports_cache,
        state.registered_devices,
    )
    atomic_write_snapshot(snapshot)
    return {
        "ok": True,
        "generated_at": snapshot["generated_at"],
        "device_count": snapshot["device_count"],
    }


@router.post("/reset")
async def post_snapshot_reset():
    """Clear caches and write empty snapshot."""
    state.device_metrics_cache.clear()
    state.device_reports_cache.clear()
    state.registered_devices.clear()
    snap = empty_snapshot()
    atomic_write_snapshot(snap)
    return {"ok": True}
