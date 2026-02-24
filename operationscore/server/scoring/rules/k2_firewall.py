"""
Rule K2: Firewall Status

Evaluates whether the system firewall (UFW) is enabled. A disabled firewall
leaves the system exposed to unauthorized network access and external attacks.
This is a critical security baseline requirement.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_firewall_enabled(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K2: Check if the UFW firewall is enabled.
    
    The firewall is a critical defensive layer that protects the system from
    unauthorized network access and external attacks. A disabled firewall
    immediately exposes all open ports and services to the network.
    
    Penalty structure:
    - 0 penalty if firewall_enabled is True (passing)
    - 25 penalty if firewall_enabled is False (critical failure)
    
    Args:
        metrics: Device metrics containing firewall_enabled boolean.
        
    Returns:
        ScoreIssue with penalty of 25 if firewall is disabled, or None if enabled.
    """
    # Firewall is enabled - rule passes
    if metrics.firewall_enabled:
        return None
    
    # Firewall is disabled - apply penalty
    return ScoreIssue(
        rule_id="K2",
        penalty=25.0,
        message="System firewall (UFW) is disabled. The system is exposed to unauthorized network access and external attacks.",
        recommendation="Enable UFW immediately using: sudo ufw enable. Then configure firewall rules to allow only necessary traffic."
    )
