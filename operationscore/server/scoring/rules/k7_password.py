"""
Rule K7: Password Policy Compliance

Evaluates whether the system enforces a strong password policy. Weak password
policies allow users to choose weak, easily guessed passwords that are vulnerable
to credential-based attacks and password spray attacks.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_password_policy(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K7: Check if password policy meets compliance requirements.
    
    Strong password policies are essential for protecting user accounts from
    compromise. A compliant password policy enforces minimum length, complexity
    requirements, password expiration, and prevents password reuse. Without
    these controls, users can choose weak passwords vulnerable to attacks.
    
    Penalty structure:
    - 0 penalty if password_policy_ok is True (passing)
    - 20 penalty if password_policy_ok is False (non-compliant policy)
    
    Args:
        metrics: Device metrics containing password_policy_ok boolean.
        
    Returns:
        ScoreIssue with penalty of 20 if policy is not compliant, or None if OK.
    """
    # Password policy meets compliance requirements
    if metrics.password_policy_ok:
        return None
    
    # Password policy does not meet compliance
    return ScoreIssue(
        rule_id="K7",
        penalty=20.0,
        message=(
            "System password policy does not meet compliance requirements. "
            "Weak password policies allow users to choose easily guessed passwords, "
            "increasing vulnerability to credential-based and password spray attacks."
        ),
        recommendation=(
            "Enforce strong password policies requiring: minimum 12 character length, "
            "uppercase/lowercase/digits/special characters, password expiration (90 days), "
            "and prevention of password reuse (12+ previous passwords). Configure in /etc/login.defs, "
            "/etc/security/pwquality.conf, and /etc/pam.d/ as appropriate for your distribution."
        )
    )
