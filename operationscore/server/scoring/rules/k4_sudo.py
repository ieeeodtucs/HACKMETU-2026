"""
Rule K4: Sudo User Privileges

Evaluates the number of users with sudo (superuser) privileges. Excessive sudo
users increase the risk of unauthorized privileged access and makes it difficult
to maintain accountability and audit trails for administrative actions.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_sudo_users_limit(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K4: Check if sudo user count is within acceptable limits.
    
    The principle of least privilege dictates that only necessary users should
    have sudo access. Excessive sudo users increase the attack surface, make
    accountability tracking difficult, and complicate privilege management.
    A reasonable limit is 3 or fewer users with sudo privileges.
    
    Penalty structure:
    - 0 penalty if sudo_users_count <= 3 (passing)
    - 15 penalty if sudo_users_count > 3 (over-privileging failure)
    
    Args:
        metrics: Device metrics containing sudo_users_count.
        
    Returns:
        ScoreIssue with penalty of 15 if more than 3 sudo users exist, or None.
    """
    sudo_count = metrics.sudo_users_count
    
    # Acceptable number of sudo users
    if sudo_count <= 3:
        return None
    
    # Too many sudo users - apply penalty
    return ScoreIssue(
        rule_id="K4",
        penalty=15.0,
        message=f"Excessive sudo privileges detected: {sudo_count} users have sudo access. This violates the principle of least privilege and complicates accountability.",
        recommendation="Audit all sudo users and remove elevated privileges from accounts that don't require administrative access. Consider using role-based access control or sudo groups for more granular privilege management."
    )
