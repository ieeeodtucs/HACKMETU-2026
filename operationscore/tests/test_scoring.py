"""
Tests for the security scoring engine.

Aligned with the real production API:
  - calculate_score(metrics) -> ScoreReport  (server.scoring.engine)
  - ScoreReport: total_score (float 0-100), issues (List[ScoreIssue])
  - ScoreIssue:  rule_id (str), penalty (float), message (str), recommendation (str)
  - DeviceMetrics fields: hostname, timestamp, update_count, firewall_enabled,
      ssh_root_login_allowed, sudo_users_count, unnecessary_services (list[str]),
      disk_usage_percent (int 0-100), password_policy_ok, last_seen_minutes

Penalty table (from production rules):
  K1 updates  : 0 if <=10 | 15 if 11-30 | 30 if >30
  K2 firewall : 25 if disabled
  K3 ssh root : 20 if root login enabled
  K4 sudo     : 15 if >3 sudo users (flat)
  K5 services : min(25, 4 + 4*count) per running unnecessary service
  K6 disk     : 0 if <=85% | 15 if 86-95% | 30 if >95%
  K7 password : 20 if policy not OK
  K8 zombie   : 10 if last_seen_minutes > 60
"""

import pytest
from datetime import datetime, timezone
from server.models import DeviceMetrics, ScoreIssue, ScoreReport
from server.scoring.engine import calculate_score, RULES, register_rule, unregister_rule


# ============================================================
# Helpers
# ============================================================

FIXED_TS = datetime(2026, 2, 21, 10, 0, 0, tzinfo=timezone.utc)


def make_metrics(**overrides) -> DeviceMetrics:
    """
    Build a fully-valid DeviceMetrics with safe defaults from a clean system.
    Override individual fields for targeted tests.
    """
    defaults = dict(
        hostname="test-host",
        timestamp=FIXED_TS,
        update_count=0,
        firewall_enabled=True,
        ssh_root_login_allowed=False,
        sudo_users_count=1,
        unnecessary_services=[],
        disk_usage_percent=50,
        password_policy_ok=True,
        last_seen_minutes=0,
    )
    defaults.update(overrides)
    return DeviceMetrics(**defaults)


def issue_for_rule(report: ScoreReport, rule_id: str):
    """Return the ScoreIssue for a given rule_id, or None."""
    for issue in report.issues:
        if issue.rule_id == rule_id:
            return issue
    return None


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def clean_metrics():
    """Metrics representing a fully-clean (no issues) system."""
    return make_metrics()


@pytest.fixture
def all_bad_metrics():
    """Metrics representing a system that fails every rule."""
    return make_metrics(
        update_count=31,           # K1: 30 penalty
        firewall_enabled=False,    # K2: 25 penalty
        ssh_root_login_allowed=True,  # K3: 20 penalty
        sudo_users_count=6,        # K4: 15 penalty
        unnecessary_services=["vsftpd", "telnet"],  # K5: min(25, 4+8)=12 penalty
        disk_usage_percent=96,     # K6: 30 penalty
        password_policy_ok=False,  # K7: 20 penalty
        last_seen_minutes=120,     # K8: 10 penalty
    )


# ============================================================
# Basic API contract
# ============================================================

class TestCalculateScoreContract:
    """Verify what calculate_score returns regardless of values."""

    def test_returns_score_report(self, clean_metrics):
        report = calculate_score(clean_metrics)
        assert isinstance(report, ScoreReport)

    def test_total_score_in_range(self, clean_metrics):
        report = calculate_score(clean_metrics)
        assert 0.0 <= report.total_score <= 100.0

    def test_issues_is_list(self, clean_metrics):
        report = calculate_score(clean_metrics)
        assert isinstance(report.issues, list)

    def test_score_issues_are_score_issue_instances(self, all_bad_metrics):
        report = calculate_score(all_bad_metrics)
        for issue in report.issues:
            assert isinstance(issue, ScoreIssue)

    def test_each_issue_has_required_fields(self, all_bad_metrics):
        report = calculate_score(all_bad_metrics)
        for issue in report.issues:
            assert isinstance(issue.rule_id, str) and len(issue.rule_id) > 0
            assert isinstance(issue.penalty, (int, float)) and issue.penalty >= 0
            assert isinstance(issue.message, str) and len(issue.message) > 0
            assert isinstance(issue.recommendation, str) and len(issue.recommendation) > 0

    def test_clean_system_scores_100(self, clean_metrics):
        report = calculate_score(clean_metrics)
        assert report.total_score == 100.0
        assert report.issues == []

    def test_score_never_below_zero(self, all_bad_metrics):
        report = calculate_score(all_bad_metrics)
        assert report.total_score >= 0.0

    def test_penalty_sum_capped_at_100(self, all_bad_metrics):
        report = calculate_score(all_bad_metrics)
        raw_sum = sum(i.penalty for i in report.issues)
        # Penalties may exceed 100 but score must not go below 0
        if raw_sum > 100:
            assert report.total_score == 0.0
        else:
            assert report.total_score == pytest.approx(100.0 - raw_sum)


# ============================================================
# K1 — Pending Updates
# ============================================================

class TestK1PendingUpdates:

    def test_no_penalty_for_zero_updates(self):
        report = calculate_score(make_metrics(update_count=0))
        assert issue_for_rule(report, "K1") is None

    def test_no_penalty_for_ten_updates(self):
        """≤10 updates: rule passes."""
        report = calculate_score(make_metrics(update_count=10))
        assert issue_for_rule(report, "K1") is None

    def test_moderate_penalty_for_11_to_30_updates(self):
        """11-30 updates → 15 penalty."""
        report = calculate_score(make_metrics(update_count=20))
        issue = issue_for_rule(report, "K1")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_moderate_penalty_boundary_11(self):
        report = calculate_score(make_metrics(update_count=11))
        issue = issue_for_rule(report, "K1")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_moderate_penalty_boundary_30(self):
        report = calculate_score(make_metrics(update_count=30))
        issue = issue_for_rule(report, "K1")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_critical_penalty_for_over_30_updates(self):
        """31+ updates → 30 penalty."""
        report = calculate_score(make_metrics(update_count=50))
        issue = issue_for_rule(report, "K1")
        assert issue is not None
        assert issue.penalty == 30.0

    def test_critical_penalty_boundary_31(self):
        report = calculate_score(make_metrics(update_count=31))
        issue = issue_for_rule(report, "K1")
        assert issue is not None
        assert issue.penalty == 30.0
        assert "backlog" in issue.message.lower()

    def test_recommendation_exists(self):
        report = calculate_score(make_metrics(update_count=20))
        issue = issue_for_rule(report, "K1")
        assert issue is not None
        assert len(issue.recommendation) > 0


# ============================================================
# K2 — Firewall Status
# ============================================================

class TestK2FirewallStatus:

    def test_no_penalty_when_enabled(self):
        report = calculate_score(make_metrics(firewall_enabled=True))
        assert issue_for_rule(report, "K2") is None

    def test_penalty_25_when_disabled(self):
        report = calculate_score(make_metrics(firewall_enabled=False))
        issue = issue_for_rule(report, "K2")
        assert issue is not None
        assert issue.penalty == 25.0

    def test_disabled_message_mentions_firewall(self):
        report = calculate_score(make_metrics(firewall_enabled=False))
        issue = issue_for_rule(report, "K2")
        assert issue is not None
        # Message should mention disabled / exposed state
        assert any(kw in issue.message.lower() for kw in ("disabled", "firewall", "exposed", "ufw"))

    def test_recommendation_mentions_enable(self):
        report = calculate_score(make_metrics(firewall_enabled=False))
        issue = issue_for_rule(report, "K2")
        assert issue is not None
        assert "enable" in issue.recommendation.lower()


# ============================================================
# K3 — SSH Root Login
# ============================================================

class TestK3SSHRootLogin:

    def test_no_penalty_when_root_login_disabled(self):
        report = calculate_score(make_metrics(ssh_root_login_allowed=False))
        assert issue_for_rule(report, "K3") is None

    def test_penalty_20_when_root_login_enabled(self):
        report = calculate_score(make_metrics(ssh_root_login_allowed=True))
        issue = issue_for_rule(report, "K3")
        assert issue is not None
        assert issue.penalty == 20.0

    def test_message_mentions_root_login(self):
        report = calculate_score(make_metrics(ssh_root_login_allowed=True))
        issue = issue_for_rule(report, "K3")
        assert issue is not None
        assert "root login" in issue.message.lower()

    def test_recommendation_mentions_sshd_config(self):
        report = calculate_score(make_metrics(ssh_root_login_allowed=True))
        issue = issue_for_rule(report, "K3")
        assert issue is not None
        assert "sshd_config" in issue.recommendation.lower()


# ============================================================
# K4 — Sudo Users
# ============================================================

class TestK4SudoUsers:

    def test_no_penalty_for_1_sudo_user(self):
        report = calculate_score(make_metrics(sudo_users_count=1))
        assert issue_for_rule(report, "K4") is None

    def test_no_penalty_for_3_sudo_users(self):
        """Boundary: ≤3 is acceptable."""
        report = calculate_score(make_metrics(sudo_users_count=3))
        assert issue_for_rule(report, "K4") is None

    def test_penalty_15_for_4_sudo_users(self):
        """Any count > 3 → 15 penalty (flat)."""
        report = calculate_score(make_metrics(sudo_users_count=4))
        issue = issue_for_rule(report, "K4")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_penalty_15_for_many_sudo_users(self):
        """Penalty stays flat at 15 regardless of how many users above 3."""
        report = calculate_score(make_metrics(sudo_users_count=20))
        issue = issue_for_rule(report, "K4")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_message_mentions_sudo_or_privilege(self):
        report = calculate_score(make_metrics(sudo_users_count=5))
        issue = issue_for_rule(report, "K4")
        assert issue is not None
        assert any(kw in issue.message.lower() for kw in ("sudo", "privilege", "privileged"))


# ============================================================
# K5 — Unnecessary Services
# ============================================================

class TestK5UnnecessaryServices:

    def test_no_penalty_for_empty_services(self):
        report = calculate_score(make_metrics(unnecessary_services=[]))
        assert issue_for_rule(report, "K5") is None

    def test_penalty_for_one_service(self):
        """1 service → min(25, 4+4) = 8."""
        report = calculate_score(make_metrics(unnecessary_services=["vsftpd"]))
        issue = issue_for_rule(report, "K5")
        assert issue is not None
        assert issue.penalty == 8.0

    def test_penalty_for_two_services(self):
        """2 services → min(25, 4+8) = 12."""
        report = calculate_score(make_metrics(unnecessary_services=["vsftpd", "telnet"]))
        issue = issue_for_rule(report, "K5")
        assert issue is not None
        assert issue.penalty == 12.0

    def test_penalty_for_three_services(self):
        """3 services → min(25, 4+12) = 16."""
        report = calculate_score(make_metrics(unnecessary_services=["vsftpd", "telnet", "proftpd"]))
        issue = issue_for_rule(report, "K5")
        assert issue is not None
        assert issue.penalty == 16.0

    def test_penalty_capped_at_25(self):
        """Many services → capped at 25."""
        many = ["svc1", "svc2", "svc3", "svc4", "svc5", "svc6"]
        report = calculate_score(make_metrics(unnecessary_services=many))
        issue = issue_for_rule(report, "K5")
        assert issue is not None
        assert issue.penalty == 25.0

    def test_service_names_appear_in_message(self):
        report = calculate_score(make_metrics(unnecessary_services=["vsftpd"]))
        issue = issue_for_rule(report, "K5")
        assert issue is not None
        assert "vsftpd" in issue.message


# ============================================================
# K6 — Disk Usage
# ============================================================

class TestK6DiskUsage:

    def test_no_penalty_at_85_percent(self):
        """≤85% → no issue."""
        report = calculate_score(make_metrics(disk_usage_percent=85))
        assert issue_for_rule(report, "K6") is None

    def test_no_penalty_at_50_percent(self):
        report = calculate_score(make_metrics(disk_usage_percent=50))
        assert issue_for_rule(report, "K6") is None

    def test_elevated_penalty_at_86_percent(self):
        """86-95% → 15 penalty."""
        report = calculate_score(make_metrics(disk_usage_percent=86))
        issue = issue_for_rule(report, "K6")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_elevated_penalty_at_90_percent(self):
        report = calculate_score(make_metrics(disk_usage_percent=90))
        issue = issue_for_rule(report, "K6")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_elevated_penalty_at_95_percent(self):
        """95% is still in the elevated band (not >95)."""
        report = calculate_score(make_metrics(disk_usage_percent=95))
        issue = issue_for_rule(report, "K6")
        assert issue is not None
        assert issue.penalty == 15.0

    def test_critical_penalty_at_96_percent(self):
        """>95% → 30 penalty."""
        report = calculate_score(make_metrics(disk_usage_percent=96))
        issue = issue_for_rule(report, "K6")
        assert issue is not None
        assert issue.penalty == 30.0

    def test_critical_penalty_at_100_percent(self):
        report = calculate_score(make_metrics(disk_usage_percent=100))
        issue = issue_for_rule(report, "K6")
        assert issue is not None
        assert issue.penalty == 30.0

    def test_critical_message_mentions_critical(self):
        report = calculate_score(make_metrics(disk_usage_percent=99))
        issue = issue_for_rule(report, "K6")
        assert issue is not None
        assert "critical" in issue.message.lower()


# ============================================================
# K7 — Password Policy
# ============================================================

class TestK7PasswordPolicy:

    def test_no_penalty_when_policy_ok(self):
        report = calculate_score(make_metrics(password_policy_ok=True))
        assert issue_for_rule(report, "K7") is None

    def test_penalty_20_when_policy_not_ok(self):
        report = calculate_score(make_metrics(password_policy_ok=False))
        issue = issue_for_rule(report, "K7")
        assert issue is not None
        assert issue.penalty == 20.0

    def test_message_mentions_password_policy(self):
        report = calculate_score(make_metrics(password_policy_ok=False))
        issue = issue_for_rule(report, "K7")
        assert issue is not None
        assert any(kw in issue.message.lower() for kw in ("password", "policy", "compliance"))

    def test_recommendation_exists(self):
        report = calculate_score(make_metrics(password_policy_ok=False))
        issue = issue_for_rule(report, "K7")
        assert issue is not None
        assert len(issue.recommendation) > 0


# ============================================================
# K8 — Zombie Device Detection
# ============================================================

class TestK8ZombieDetection:

    def test_no_penalty_for_zero_minutes(self):
        report = calculate_score(make_metrics(last_seen_minutes=0))
        assert issue_for_rule(report, "K8") is None

    def test_no_penalty_at_60_minutes(self):
        """≤60 minutes → still active."""
        report = calculate_score(make_metrics(last_seen_minutes=60))
        assert issue_for_rule(report, "K8") is None

    def test_penalty_10_at_61_minutes(self):
        """>60 minutes → 10 penalty."""
        report = calculate_score(make_metrics(last_seen_minutes=61))
        issue = issue_for_rule(report, "K8")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_penalty_10_for_long_absence(self):
        report = calculate_score(make_metrics(last_seen_minutes=10000))
        issue = issue_for_rule(report, "K8")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_message_mentions_zombie_or_reporting(self):
        report = calculate_score(make_metrics(last_seen_minutes=200))
        issue = issue_for_rule(report, "K8")
        assert issue is not None
        assert any(kw in issue.message.lower() for kw in ("zombie", "reporting", "reported", "offline"))


# ============================================================
# Integration — score arithmetic
# ============================================================

class TestScoreArithmetic:
    """Verify that total_score = 100 - sum(penalties), capped to [0, 100]."""

    def test_single_penalty_reduces_score(self):
        # Only K2 triggered → penalty 25
        report = calculate_score(make_metrics(firewall_enabled=False))
        k2_issue = issue_for_rule(report, "K2")
        assert k2_issue is not None
        assert report.total_score == pytest.approx(100.0 - k2_issue.penalty)

    def test_multiple_independent_penalties_sum(self):
        # K2 (25) + K3 (20) = 45 → score 55
        report = calculate_score(make_metrics(
            firewall_enabled=False,
            ssh_root_login_allowed=True,
        ))
        k2 = issue_for_rule(report, "K2")
        k3 = issue_for_rule(report, "K3")
        assert k2 is not None and k3 is not None
        total_penalty = k2.penalty + k3.penalty
        assert report.total_score == pytest.approx(100.0 - total_penalty)

    def test_penalty_cap_yields_zero_score(self):
        """When all rules fire, raw penalty exceeds 100 → score must be 0."""
        report = calculate_score(make_metrics(
            update_count=31,            # K1: 30
            firewall_enabled=False,     # K2: 25
            ssh_root_login_allowed=True,  # K3: 20
            sudo_users_count=6,         # K4: 15
            disk_usage_percent=96,      # K6: 30
            password_policy_ok=False,   # K7: 20
            last_seen_minutes=120,      # K8: 10
            # Raw so far: 150+ even before K5
        ))
        assert report.total_score == 0.0

    def test_clean_system_has_no_issues(self, clean_metrics):
        report = calculate_score(clean_metrics)
        assert report.total_score == 100.0
        assert report.issues == []

    def test_score_consistent_across_calls(self, clean_metrics):
        """Same input always produces same output (deterministic)."""
        r1 = calculate_score(clean_metrics)
        r2 = calculate_score(clean_metrics)
        assert r1.total_score == r2.total_score
        assert len(r1.issues) == len(r2.issues)

    def test_worse_system_has_lower_score(self):
        secure = make_metrics()
        insecure = make_metrics(
            firewall_enabled=False,
            ssh_root_login_allowed=True,
            disk_usage_percent=96,
        )
        r_secure = calculate_score(secure)
        r_insecure = calculate_score(insecure)
        assert r_secure.total_score > r_insecure.total_score


# ============================================================
# Rule registry
# ============================================================

class TestRuleRegistry:
    """Test the public register_rule / unregister_rule extension points."""

    def test_register_and_unregister_rule(self):
        from server.models import ScoreIssue

        def custom_rule(metrics) -> ScoreIssue:
            return ScoreIssue(
                rule_id="CUSTOM",
                penalty=5.0,
                message="custom test rule fired",
                recommendation="fix it",
            )

        initial_count = len(RULES)
        register_rule(custom_rule)
        assert len(RULES) == initial_count + 1

        # Run scoring — custom rule should appear in issues
        report = calculate_score(make_metrics())
        custom_issue = issue_for_rule(report, "CUSTOM")
        assert custom_issue is not None
        assert custom_issue.penalty == 5.0

        # Clean up for test isolation
        removed = unregister_rule(custom_rule)
        assert removed is True
        assert len(RULES) == initial_count

    def test_unregister_nonexistent_rule_returns_false(self):
        def ghost_rule(metrics):
            return None
        assert unregister_rule(ghost_rule) is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
