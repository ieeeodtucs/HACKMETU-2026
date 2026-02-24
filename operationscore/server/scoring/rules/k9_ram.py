"""
Rule K9: RAM Usage

Evaluates current RAM utilization. High memory pressure degrades system
performance and increases the risk of out-of-memory crashes.

Penalty structure (as per spec):
  - ram_usage_percent <= 70   → no issue
  - 70 < ram <= 85            → penalty 5
  - 85 < ram <= 95            → penalty 10
  - ram > 95                  → penalty 20
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue

_RECOMMENDATION = (
    "Identify top memory consumers (e.g., `top`, `htop`) and restart/optimize "
    "heavy services. Consider adding swap or upgrading RAM."
)


def rule_ram_usage(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K9: Check for high RAM utilization.

    Args:
        metrics: Device metrics containing ram_usage_percent.

    Returns:
        ScoreIssue with penalty if RAM is high, None otherwise.
    """
    ram = metrics.ram_usage_percent

    # No issue when RAM is within acceptable limits
    if ram <= 70.0:
        return None

    # Determine penalty tier
    if ram > 95.0:
        penalty = 20.0
    elif ram > 85.0:
        penalty = 10.0
    else:
        penalty = 5.0

    message = (
        f"High RAM usage detected: {ram:.1f}%. "
        "Memory pressure can degrade performance and increase crash risk."
    )

    return ScoreIssue(
        rule_id="K9",
        penalty=penalty,
        message=message,
        recommendation=_RECOMMENDATION,
    )
