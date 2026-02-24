"""
Rule K6: Disk Usage

Evaluates the disk usage percentage. High disk usage reduces available space for
logging, temporary files, and system operations. Critical disk usage can cause
system instability, failed backups, and inability to write logs.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_disk_usage(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K6: Check disk usage percentage for capacity warnings.
    
    Disk space is critical for system stability. High usage reduces space for
    logs, temporary files, and system operations. When disk is nearly full,
    write operations may fail, logs may not be recorded, and the system
    stability and security posture can be severely compromised.
    
    Penalty structure:
    - 0 penalty if disk_usage_percent <= 85% (passing)
    - 15 penalty if 85% < disk_usage_percent <= 95% (elevated usage)
    - 30 penalty if disk_usage_percent > 95% (critical capacity)
    
    Args:
        metrics: Device metrics containing disk_usage_percent.
        
    Returns:
        ScoreIssue with penalty based on disk usage level, or None if acceptable.
    """
    disk_pct = metrics.disk_usage_percent
    
    # Disk usage is acceptable
    if disk_pct <= 85:
        return None
    
    # Critical disk capacity
    if disk_pct > 95:
        return ScoreIssue(
            rule_id="K6",
            penalty=30.0,
            message=(
                f"Critical disk capacity: {disk_pct}% used. System is nearly full. "
                "Write operations may fail, logging may stop, and system stability is at risk."
            ),
            recommendation=(
                "Immediately free disk space. Identify large files and directories using: du -sh /*. "
                "Remove unnecessary files, archive old logs, and clean temporary directories. "
                "Consider expanding disk capacity if this is a recurring issue."
            )
        )
    
    # Elevated disk usage
    return ScoreIssue(
        rule_id="K6",
        penalty=15.0,
        message=(
            f"Elevated disk usage: {disk_pct}% used. Approaching critical capacity. "
            "System stability and logging may be compromised soon."
        ),
        recommendation=(
            "Free disk space to reduce usage below 85%. Review large files and directories. "
            "Archive old logs and temporary files. Monitor disk usage trends and plan capacity upgrades."
        )
    )
