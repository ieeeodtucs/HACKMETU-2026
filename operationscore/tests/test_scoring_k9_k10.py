"""
tests/test_scoring_k9_k10.py

Unit tests for K9 (RAM usage) and K10 (CPU usage) scoring rules.
Also includes an /report API compatibility test for old agents (gpu field ignored).

K9 (RAM) penalty table:
  ram <= 70     → no issue
  70 < ram <= 85 → penalty 5
  85 < ram <= 95 → penalty 10
  ram > 95       → penalty 20

K10 (CPU) penalty table:
  cpu <= 70      → no issue
  70 < cpu <= 85 → penalty 10
  85 < cpu <= 95 → penalty 20
  cpu > 95       → penalty 30
"""

import pytest
from datetime import datetime, timezone
from server.models import DeviceMetrics
from server.scoring.engine import calculate_score

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIXED_TS = datetime(2026, 2, 22, 0, 0, 0, tzinfo=timezone.utc)


def make_metrics(**overrides) -> DeviceMetrics:
    """Fully-valid clean DeviceMetrics with K9/K10 fields included."""
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
        ram_usage_percent=0.0,
        cpu_usage_percent=0.0,
    )
    defaults.update(overrides)
    return DeviceMetrics(**defaults)


def issue_for(report, rule_id):
    for i in report.issues:
        if i.rule_id == rule_id:
            return i
    return None


# ---------------------------------------------------------------------------
# K9 — RAM usage
# ---------------------------------------------------------------------------

class TestK9RamUsage:

    def test_no_issue_when_ram_at_zero(self):
        r = calculate_score(make_metrics(ram_usage_percent=0.0))
        assert issue_for(r, "K9") is None

    def test_no_issue_when_ram_at_50(self):
        r = calculate_score(make_metrics(ram_usage_percent=50.0))
        assert issue_for(r, "K9") is None

    def test_no_issue_at_exactly_70(self):
        """Boundary: 70% is still within acceptable range."""
        r = calculate_score(make_metrics(ram_usage_percent=70.0))
        assert issue_for(r, "K9") is None

    def test_penalty_5_at_71(self):
        r = calculate_score(make_metrics(ram_usage_percent=71.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 5.0

    def test_penalty_5_at_80(self):
        r = calculate_score(make_metrics(ram_usage_percent=80.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 5.0

    def test_penalty_5_at_exactly_85(self):
        """Boundary: 85% is still tier-1 (not > 85)."""
        r = calculate_score(make_metrics(ram_usage_percent=85.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 5.0

    def test_penalty_10_at_86(self):
        r = calculate_score(make_metrics(ram_usage_percent=86.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_penalty_10_at_90(self):
        r = calculate_score(make_metrics(ram_usage_percent=90.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_penalty_10_at_exactly_95(self):
        """Boundary: 95% is still tier-2 (not > 95)."""
        r = calculate_score(make_metrics(ram_usage_percent=95.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_penalty_20_at_96(self):
        r = calculate_score(make_metrics(ram_usage_percent=96.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 20.0

    def test_penalty_20_at_100(self):
        r = calculate_score(make_metrics(ram_usage_percent=100.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert issue.penalty == 20.0

    def test_message_mentions_ram(self):
        r = calculate_score(make_metrics(ram_usage_percent=80.0))
        issue = issue_for(r, "K9")
        assert issue is not None
        assert "RAM" in issue.message

    def test_rule_id_is_K9(self):
        r = calculate_score(make_metrics(ram_usage_percent=80.0))
        assert issue_for(r, "K9").rule_id == "K9"

    def test_score_reduced_by_penalty(self):
        r = calculate_score(make_metrics(ram_usage_percent=80.0))
        assert r.total_score == pytest.approx(100.0 - 5.0)

    def test_score_reduced_by_20_at_97(self):
        r = calculate_score(make_metrics(ram_usage_percent=97.0))
        assert r.total_score == pytest.approx(100.0 - 20.0)


# ---------------------------------------------------------------------------
# K10 — CPU usage
# ---------------------------------------------------------------------------

class TestK10CpuUsage:

    def test_no_issue_when_cpu_at_zero(self):
        r = calculate_score(make_metrics(cpu_usage_percent=0.0))
        assert issue_for(r, "K10") is None

    def test_no_issue_when_cpu_at_50(self):
        r = calculate_score(make_metrics(cpu_usage_percent=50.0))
        assert issue_for(r, "K10") is None

    def test_no_issue_at_exactly_70(self):
        """Boundary: 70% is still acceptable."""
        r = calculate_score(make_metrics(cpu_usage_percent=70.0))
        assert issue_for(r, "K10") is None

    def test_penalty_10_at_71(self):
        """Just above lower threshold → tier-1 penalty."""
        r = calculate_score(make_metrics(cpu_usage_percent=71.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_penalty_10_at_82(self):
        r = calculate_score(make_metrics(cpu_usage_percent=82.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_penalty_10_at_exactly_85(self):
        """Boundary: 85% is still tier-1 (not > 85)."""
        r = calculate_score(make_metrics(cpu_usage_percent=85.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 10.0

    def test_penalty_20_at_86(self):
        """Just above mid-threshold → tier-2 penalty."""
        r = calculate_score(make_metrics(cpu_usage_percent=86.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 20.0

    def test_penalty_20_at_90(self):
        r = calculate_score(make_metrics(cpu_usage_percent=90.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 20.0

    def test_penalty_20_at_exactly_95(self):
        """Boundary: 95% is still tier-2 (not > 95)."""
        r = calculate_score(make_metrics(cpu_usage_percent=95.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 20.0

    def test_penalty_30_at_96(self):
        """Just above critical threshold → tier-3 penalty."""
        r = calculate_score(make_metrics(cpu_usage_percent=96.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 30.0

    def test_penalty_30_at_97(self):
        r = calculate_score(make_metrics(cpu_usage_percent=97.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 30.0

    def test_penalty_30_at_100(self):
        r = calculate_score(make_metrics(cpu_usage_percent=100.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert issue.penalty == 30.0

    def test_message_contains_cpu(self):
        r = calculate_score(make_metrics(cpu_usage_percent=82.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert "CPU" in issue.message

    def test_message_contains_percent_value(self):
        r = calculate_score(make_metrics(cpu_usage_percent=82.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert "82" in issue.message

    def test_critical_message_at_97(self):
        r = calculate_score(make_metrics(cpu_usage_percent=97.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert any(kw in issue.message.lower() for kw in ("critical", "unresponsive"))

    def test_recommendation_mentions_top_or_htop(self):
        r = calculate_score(make_metrics(cpu_usage_percent=82.0))
        issue = issue_for(r, "K10")
        assert issue is not None
        assert any(kw in issue.recommendation for kw in ("top", "htop", "CPU"))

    def test_rule_id_is_K10(self):
        r = calculate_score(make_metrics(cpu_usage_percent=82.0))
        assert issue_for(r, "K10").rule_id == "K10"

    def test_score_reduced_by_10_at_82(self):
        r = calculate_score(make_metrics(cpu_usage_percent=82.0))
        assert r.total_score == pytest.approx(100.0 - 10.0)

    def test_score_reduced_by_30_at_97(self):
        r = calculate_score(make_metrics(cpu_usage_percent=97.0))
        assert r.total_score == pytest.approx(100.0 - 30.0)


# ---------------------------------------------------------------------------
# Combined K9 + K10 triggered together
# ---------------------------------------------------------------------------

class TestK9K10Combined:

    def test_both_penalties_stack(self):
        """ram=97 (pen 20) + cpu=97 (pen 30) → score 50."""
        r = calculate_score(make_metrics(ram_usage_percent=97.0, cpu_usage_percent=97.0))
        k9 = issue_for(r, "K9")
        k10 = issue_for(r, "K10")
        assert k9 is not None and k10 is not None
        assert k9.penalty == 20.0
        assert k10.penalty == 30.0
        assert r.total_score == pytest.approx(100.0 - 50.0)

    def test_clean_ram_and_cpu_scores_100(self):
        r = calculate_score(make_metrics(ram_usage_percent=0.0, cpu_usage_percent=0.0))
        assert r.total_score == 100.0


# ---------------------------------------------------------------------------
# API backward-compatibility: old agents with gpu_usage_percent ignored
# ---------------------------------------------------------------------------

class TestBackwardCompatibility:

    def test_device_metrics_defaults_when_cpu_absent(self):
        """DeviceMetrics assigns safe default when cpu_usage_percent is not provided."""
        m = DeviceMetrics(
            hostname="old-agent",
            timestamp=FIXED_TS,
            update_count=0,
            firewall_enabled=True,
            ssh_root_login_allowed=False,
            sudo_users_count=1,
            unnecessary_services=[],
            disk_usage_percent=50,
            password_policy_ok=True,
            last_seen_minutes=0,
            # cpu_usage_percent intentionally absent → default 0.0
        )
        assert m.cpu_usage_percent == 0.0

    def test_metrics_model_ignores_extra_gpu_field(self):
        """Legacy payload with gpu_usage_percent must parse without error (extra=ignore)."""
        m = DeviceMetrics(
            hostname="legacy-agent",
            timestamp=FIXED_TS,
            update_count=0,
            firewall_enabled=True,
            ssh_root_login_allowed=False,
            sudo_users_count=1,
            unnecessary_services=[],
            disk_usage_percent=50,
            password_policy_ok=True,
            last_seen_minutes=0,
            gpu_usage_percent=99,   # legacy field — must be silently ignored
        )
        assert m.cpu_usage_percent == 0.0
        assert not hasattr(m, "gpu_usage_percent")

    def test_old_agent_payload_scores_100_when_otherwise_clean(self):
        """Old agent with defaults → no K10 CPU penalty → score 100."""
        m = DeviceMetrics(
            hostname="old-agent",
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
        r = calculate_score(m)
        assert r.total_score == 100.0
        assert issue_for(r, "K10") is None

    # Required tests as named in spec
    def test_cpu_rule_penalty_none_when_under_70(self):
        r = calculate_score(make_metrics(cpu_usage_percent=69.0))
        assert issue_for(r, "K10") is None

    def test_cpu_rule_penalty_10_when_82(self):
        r = calculate_score(make_metrics(cpu_usage_percent=82.0))
        assert issue_for(r, "K10").penalty == 10.0

    def test_cpu_rule_penalty_20_when_90(self):
        r = calculate_score(make_metrics(cpu_usage_percent=90.0))
        assert issue_for(r, "K10").penalty == 20.0

    def test_cpu_rule_penalty_30_when_97(self):
        r = calculate_score(make_metrics(cpu_usage_percent=97.0))
        assert issue_for(r, "K10").penalty == 30.0
