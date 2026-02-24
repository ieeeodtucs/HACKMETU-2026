"""
Rule K1: Pending Package Updates

Evaluates whether critical and security package updates are being applied
in a timely manner. Outdated packages expose systems to known vulnerabilities
and may lack stability and performance improvements.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_pending_updates(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K1: Check for pending system package updates.
    
    Unpatched and outdated packages are a critical security and stability risk.
    Known vulnerabilities in outdated software can be exploited by attackers,
    and missing stability patches degrade system reliability.
    
    Penalty structure:
    - 0 penalty if update_count <= 10 (passing)
    - 15 penalty if 10 < update_count <= 30 (moderate backlog)
    - 30 penalty if update_count > 30 (critical backlog)
    
    Args:
        metrics: Device metrics containing update_count.
        
    Returns:
        ScoreIssue with appropriate penalty and remediation guidance if
        updates are pending, or None if system is current.
    """
    updates = metrics.update_count
    
    # No penalty if updates are current or minimal (10 or fewer)
    if updates <= 10:
        return None
    
    # Determine penalty and message based on update backlog
    if updates > 30:
        penalty = 30.0
        message = (
            f"Critical: {updates} pending package updates. System has a significant "
            "backlog of security and stability patches. Outdated packages expose the system "
            "to known exploits and may cause stability issues."
        )
        recommendation = (
            "Apply all updates immediately. Review update maintenance schedule to prevent "
            "future backlogs. Consider automated security updates for critical packages."
        )
    else:  # 10 < updates <= 30
        penalty = 15.0
        message = (
            f"{updates} pending package updates detected. System is behind on patches. "
            "Outdated packages threaten stability and expose known security vulnerabilities."
        )
        recommendation = (
            "Apply available updates as soon as possible using: "
            "sudo apt update && sudo apt upgrade (Debian/Ubuntu) or sudo yum update (RHEL/CentOS)"
        )
    
    return ScoreIssue(
        rule_id="K1",
        penalty=penalty,
        message=message,
        recommendation=recommendation
    )
