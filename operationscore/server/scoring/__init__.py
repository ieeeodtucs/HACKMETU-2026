"""Operational health scoring engine module."""

from .engine import (
    calculate_score,
    get_rules,
    register_rule,
    unregister_rule,
    RULES,
)
from .rules import (
    rule_pending_updates,
    rule_firewall_enabled,
    rule_ssh_root_login_disabled,
    rule_sudo_users_limit,
    rule_unnecessary_services,
    rule_disk_usage,
    rule_password_policy,
    rule_zombie_detection,
)

__all__ = [
    "calculate_score",
    "get_rules",
    "register_rule",
    "unregister_rule",
    "RULES",
    "rule_pending_updates",
    "rule_firewall_enabled",
    "rule_ssh_root_login_disabled",
    "rule_sudo_users_limit",
    "rule_unnecessary_services",
    "rule_disk_usage",
    "rule_password_policy",
    "rule_zombie_detection",
]
