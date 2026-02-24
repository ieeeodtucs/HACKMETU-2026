"""
Rule K10: CPU Usage High

Evaluates current CPU utilization using the 1-minute load average
normalized by the number of CPU cores. This is a no-dependency, no-sleep
estimate suitable for lightweight agents.

Penalty structure:
  - cpu_usage_percent <= 70          → no issue
  - 70 < cpu_usage_percent <= 85     → penalty 10
  - 85 < cpu_usage_percent <= 95     → penalty 20
  - cpu_usage_percent > 95           → penalty 30
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue

_RECOMMENDATION = (
    "Identify top CPU processes (top/htop), stop unnecessary services, "
    "and scale resources if needed."
)


def rule_cpu_usage(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K10: Check for high CPU utilization.

    Args:
        metrics: Device metrics containing cpu_usage_percent.

    Returns:
        ScoreIssue with penalty if CPU is high, None otherwise.
    """
    cpu = metrics.cpu_usage_percent

    if cpu <= 70.0:
        return None

    # Determine penalty tier
    if cpu > 95.0:
        penalty = 30.0
        message = (
            f"CPU usage is critical at {cpu:.0f}%. "
            "System may become unresponsive under load."
        )
    elif cpu > 85.0:
        penalty = 20.0
        message = (
            f"CPU usage is elevated at {cpu:.0f}%. "
            "High CPU can degrade performance and increase latency."
        )
    else:
        penalty = 10.0
        message = (
            f"CPU usage is elevated at {cpu:.0f}%. "
            "High CPU can degrade performance and increase latency."
        )

    return ScoreIssue(
        rule_id="K10",
        penalty=penalty,
        message=message,
        recommendation=_RECOMMENDATION,
    )
