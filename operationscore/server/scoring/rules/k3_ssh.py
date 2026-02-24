"""
Rule K3: SSH Root Login

Evaluates whether SSH root login is allowed. Allowing direct root login via SSH
is a critical security vulnerability that enables brute force attacks directly
against the root account without requiring privilege escalation.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_ssh_root_login_disabled(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K3: Check if SSH root login is disabled.
    
    Allowing SSH root login is a critical security risk. It enables attackers
    to attempt brute force attacks directly against the root account without
    needing to escalate privileges from a regular user account. This significantly
    increases the attack surface and potential for unauthorized system access.
    
    Penalty structure:
    - 0 penalty if ssh_root_login_allowed is False (passing)
    - 20 penalty if ssh_root_login_allowed is True (critical failure)
    
    Args:
        metrics: Device metrics containing ssh_root_login_allowed boolean.
        
    Returns:
        ScoreIssue with penalty of 20 if root login is allowed, or None if disabled.
    """
    # SSH root login is disabled - rule passes
    if not metrics.ssh_root_login_allowed:
        return None
    
    # SSH root login is allowed - apply penalty
    return ScoreIssue(
        rule_id="K3",
        penalty=20.0,
        message="SSH root login is enabled. This allows direct brute force attacks against the root account without needing privilege escalation.",
        recommendation="Disable root SSH login by setting 'PermitRootLogin no' in /etc/ssh/sshd_config, then restart SSH: sudo systemctl restart ssh"
    )
