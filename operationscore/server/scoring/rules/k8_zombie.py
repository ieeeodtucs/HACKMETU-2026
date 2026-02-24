"""
Rule K8: Zombie Device Detection

Evaluates whether a device has reported health metrics recently. Devices that
have not reported for extended periods may be offline, abandoned, or compromised.
Proper monitoring and inventory management ensures all devices remain secure
and operational.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_zombie_detection(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K8: Check for stale/zombie devices not reporting regularly.
    
    A "zombie device" is one that is no longer actively maintained or monitored.
    Devices that haven't reported in extended periods may be:
    - Offline or unplugged but still considered part of inventory
    - Abandoned without decommissioning
    - Compromised and isolated from the network
    - Running outdated software without updates
    
    Regular reporting ensures devices remain in the managed inventory and
    security posture is continuously assessed.
    
    Penalty structure:
    - 0 penalty if last_seen_minutes <= 60 (device recently active)
    - 10 penalty if last_seen_minutes > 60 (potential zombie device)
    
    Args:
        metrics: Device metrics containing last_seen_minutes.
        
    Returns:
        ScoreIssue with penalty of 10 if device is stale, or None if recently seen.
    """
    minutes_ago = metrics.last_seen_minutes
    
    # Device reported within the last hour - no issue
    if minutes_ago <= 60:
        return None
    
    # Calculate human-readable time period
    hours = minutes_ago // 60
    days = minutes_ago // 1440
    
    if minutes_ago < 1440:  # Less than 1 day
        time_str = f"{hours} hour{'s' if hours > 1 else ''}"
    else:  # 1 day or more
        time_str = f"{days} day{'s' if days > 1 else ''}"
    
    # Device is stale - potential zombie device
    return ScoreIssue(
        rule_id="K8",
        penalty=10.0,
        message=(
            f"Zombie device detected: Last reported {time_str} ago ({minutes_ago} minutes). "
            "Device is not actively reporting health metrics. May be offline, abandoned, or compromised."
        ),
        recommendation=(
            "Verify the device is operational and properly connected to the network. "
            "Check network connectivity and agent/monitoring service status. "
            "If device is no longer in use, decommission it and remove from inventory. "
            "If still in use, restore connectivity and resume health reporting."
        )
    )
