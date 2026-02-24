"""
Modular rule-based operational health scoring engine.

This module implements a flexible scoring system where each health rule
is a function that evaluates device metrics and returns a ScoreIssue if
a problem is detected, or None if the rule passes. Rules are combined
into a comprehensive operational health score.
"""

from typing import Callable, Dict, Optional, List
from ..models import DeviceMetrics, ScoreIssue, ScoreReport

# Import all rule functions from individual rule modules
from .rules.k1_updates import rule_pending_updates
from .rules.k2_firewall import rule_firewall_enabled
from .rules.k3_ssh import rule_ssh_root_login_disabled
from .rules.k4_sudo import rule_sudo_users_limit
from .rules.k5_services import rule_unnecessary_services
from .rules.k6_disk import rule_disk_usage
from .rules.k7_password import rule_password_policy
from .rules.k8_zombie import rule_zombie_detection
from .rules.k9_ram import rule_ram_usage
from .rules.k10_gpu import rule_cpu_usage


# Type alias for rule functions: takes DeviceMetrics, returns ScoreIssue or None
RuleFunction = Callable[[DeviceMetrics], Optional[ScoreIssue]]

# List of all registered rules in evaluation order
RULES: List[RuleFunction] = [
    rule_pending_updates,           # K1: Package updates
    rule_firewall_enabled,          # K2: Firewall status
    rule_ssh_root_login_disabled,   # K3: SSH root login
    rule_sudo_users_limit,          # K4: Sudo user privileges
    rule_unnecessary_services,      # K5: Unnecessary services
    rule_disk_usage,                # K6: Disk capacity
    rule_password_policy,           # K7: Password policy
    rule_zombie_detection,          # K8: Zombie devices
    rule_ram_usage,                 # K9: RAM utilization
    rule_cpu_usage,                 # K10: CPU utilization
]


def calculate_score(metrics: DeviceMetrics) -> ScoreReport:
    """
    Calculate the operational health score for a device.
    
    Evaluates device metrics against all registered rules, applies penalties,
    and returns a comprehensive ScoreReport.
    
    Algorithm:
    1. Start from base score of 100
    2. Evaluate each rule function against metrics
    3. Collect all triggered rules (those returning ScoreIssue, not None)
    4. Sum penalties from all triggered rules
    5. Clamp total penalty to maximum of 100 (so score doesn't go below 0)
    6. Calculate final score: 100 - total_penalty
    7. Return ScoreReport with final score and list of issues
    
    Args:
        metrics: DeviceMetrics representing the system to evaluate.
        
    Returns:
        ScoreReport containing the final score (0-100) and list of ScoreIssue objects.
    """
    issues: List[ScoreIssue] = []
    total_penalty = 0.0
    
    # Evaluate each rule in the RULES list
    for rule_func in RULES:
        issue = rule_func(metrics)
        if issue is not None:
            issues.append(issue)
            total_penalty += issue.penalty
    
    # Clamp total penalty to 100 (so score cannot go below 0)
    total_penalty = min(total_penalty, 100.0)
    
    # Calculate final score: start from 100, subtract penalties
    final_score = max(0.0, 100.0 - total_penalty)
    
    # Return ScoreReport with final score and all detected issues
    return ScoreReport(
        total_score=final_score,
        issues=issues
    )


def get_rules() -> List[RuleFunction]:
    """
    Get the list of all registered rules.
    
    Returns:
        List of rule functions.
    """
    return RULES.copy()


def register_rule(rule_func: RuleFunction) -> None:
    """
    Register a new rule in the rules list.
    
    Args:
        rule_func: Rule function that takes DeviceMetrics and returns ScoreIssue or None.
    """
    RULES.append(rule_func)


def unregister_rule(rule_func: RuleFunction) -> bool:
    """
    Unregister a rule from the rules list.
    
    Args:
        rule_func: Rule function to remove.
        
    Returns:
        True if rule was removed, False if rule function was not found.
    """
    try:
        RULES.remove(rule_func)
        return True
    except ValueError:
        return False
