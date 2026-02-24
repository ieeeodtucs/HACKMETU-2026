"""
Demonstration script for the security scoring engine.

Shows how to use the scoring engine with various system metric scenarios
and displays comprehensive security reports.
"""

from datetime import datetime
from server.models import DeviceMetrics
from server.scoring.engine import ScoringEngine


def print_separator(char="=", width=80):
    """Print a formatted separator line."""
    print(char * width)


def print_rule_results(report):
    """Pretty print rule evaluation results."""
    print("\n📋 RULE EVALUATION RESULTS:")
    print("-" * 80)
    print(f"{'Rule Name':<25} {'Status':<15} {'Penalty':<12} {'Action':<15}")
    print("-" * 80)
    
    for result in report.rule_results:
        status = "✓ PASS" if result.passed else "✗ FAIL"
        penalty_str = f"{result.penalty:.1f}"
        action = "Monitor" if result.passed else "Review"
        
        print(f"{result.rule_name:<25} {status:<15} {penalty_str:<12} {action:<15}")
    
    print("-" * 80)
    print(f"{'Total Penalties':<25} {'':<15} {report.total_penalty:.1f}")


def print_recommendations(report):
    """Print actionable recommendations from failed rules."""
    failed_rules = [r for r in report.rule_results if not r.passed]
    
    if not failed_rules:
        print("\n✅ No security recommendations needed - system is secure!")
        return
    
    print(f"\n🔧 RECOMMENDATIONS ({len(failed_rules)} items):")
    print("-" * 80)
    
    for i, result in enumerate(failed_rules, 1):
        print(f"\n{i}. {result.rule_name.upper()}")
        print(f"   Issue: {result.reason}")
        print(f"   Action: {result.recommendation}")


def print_score_report(report):
    """Pretty print the complete security score report."""
    print_separator("=", 80)
    print(f"{'SECURITY SCORE REPORT':^80}")
    print_separator("=", 80)
    
    print(f"\n🖥️  Device: {report.hostname}")
    print(f"🕐 Timestamp: {report.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n" + "=" * 80)
    print(f"{'FINAL SCORE:':<30} {report.final_score:.1f}/100")
    print("=" * 80)
    
    # Risk level with emoji
    risk_emoji = {
        "excellent": "🟢",
        "low": "🟡",
        "medium": "🟠",
        "high": "🔴",
        "critical": "🔴🔴"
    }
    emoji = risk_emoji.get(report.risk_level, "⚪")
    print(f"Risk Level: {emoji} {report.risk_level.upper()}")
    
    print(f"Rules Passed: {report.passed_rules_count}/{len(report.rule_results)}")
    print(f"Rules Failed: {report.failed_rules_count}/{len(report.rule_results)}")
    
    print(f"\n📊 Summary:")
    print(f"{report.summary}")
    
    print_rule_results(report)
    print_recommendations(report)
    
    print_separator("=", 80)


def scenario_secure_system():
    """Scenario 1: Secure, well-maintained system."""
    print("\n\n")
    print_separator("#")
    print(f"{'SCENARIO 1: SECURE SYSTEM':^80}")
    print_separator("#")
    
    metrics = DeviceMetrics(
        hostname="prod-web-01.example.com",
        timestamp=datetime.now(),
        firewall_status="enabled",
        ssh_config={
            "port": 2222,
            "protocol_version": "2",
            "password_authentication": "no",
            "root_login": "no",
            "pubkey_authentication": "yes"
        },
        disk_usage=42.5,
        update_count=0,
        ssh_root_login=False,
        sudo_users_count=2
    )
    
    engine = ScoringEngine()
    report = engine.evaluate(metrics)
    print_score_report(report)


def scenario_poorly_maintained_system():
    """Scenario 2: Poorly maintained system with security gaps."""
    print("\n\n")
    print_separator("#")
    print(f"{'SCENARIO 2: POORLY MAINTAINED SYSTEM':^80}")
    print_separator("#")
    
    metrics = DeviceMetrics(
        hostname="legacy-server.oldnet.local",
        timestamp=datetime.now(),
        firewall_status="disabled",
        ssh_config={
            "port": 22,
            "protocol_version": "2",
            "password_authentication": "yes"
        },
        disk_usage=88.3,
        update_count=12,
        ssh_root_login=True,
        sudo_users_count=4
    )
    
    engine = ScoringEngine()
    report = engine.evaluate(metrics)
    print_score_report(report)


def scenario_critical_system():
    """Scenario 3: System with critical security issues."""
    print("\n\n")
    print_separator("#")
    print(f"{'SCENARIO 3: CRITICAL SECURITY STATE':^80}")
    print_separator("#")
    
    metrics = DeviceMetrics(
        hostname="unpatched-box",
        timestamp=datetime.now(),
        firewall_status="disabled",
        ssh_config={
            "port": 22,
            "protocol_version": "1",
            "password_authentication": "yes"
        },
        disk_usage=97.2,
        update_count=47,
        ssh_root_login=True,
        sudo_users_count=10
    )
    
    engine = ScoringEngine()
    report = engine.evaluate(metrics)
    print_score_report(report)


def scenario_partially_compliant():
    """Scenario 4: System with mixed security posture."""
    print("\n\n")
    print_separator("#")
    print(f"{'SCENARIO 4: PARTIALLY COMPLIANT SYSTEM':^80}")
    print_separator("#")
    
    metrics = DeviceMetrics(
        hostname="staging-db-02",
        timestamp=datetime.now(),
        firewall_status="enabled",
        ssh_config={
            "port": 22,
            "protocol_version": "2",
            "password_authentication": "no",
            "root_login": "no"
        },
        disk_usage=76.8,
        update_count=8,
        ssh_root_login=False,
        sudo_users_count=6
    )
    
    engine = ScoringEngine()
    report = engine.evaluate(metrics)
    print_score_report(report)


def main():
    """Run all demonstration scenarios."""
    print("\n")
    print_separator("=", 80)
    print(f"{'SECURITY SCORING ENGINE DEMONSTRATION':^80}")
    print_separator("=", 80)
    print("\nThis script demonstrates the modular rule-based scoring engine")
    print("with four different system security scenarios.\n")
    
    # Run scenarios
    scenario_secure_system()
    scenario_poorly_maintained_system()
    scenario_critical_system()
    scenario_partially_compliant()
    
    # Summary
    print("\n\n")
    print_separator("=", 80)
    print(f"{'SCORING ENGINE SUMMARY':^80}")
    print_separator("=", 80)
    print("\n✅ The scoring engine evaluates systems across 5 security dimensions:\n")
    print("  1. 🔥 FIREWALL STATUS")
    print("     └─ Penalty: 30 points if disabled")
    print("        Critical for network security and access control\n")
    print("  2. 💾 DISK USAGE")
    print("     └─ Penalties: 10 points (80-89% full), 25 points (≥90% full)")
    print("        Prevents logging and system stability issues\n")
    print("  3. 🔐 SSH ROOT LOGIN")
    print("     └─ Penalty: 35 points if enabled")
    print("        Eliminates unnecessary direct root access vector\n")
    print("  4. 📦 PENDING UPDATES")
    print("     └─ Penalties: 5 (1-5), 15 (6-20), 25 (>20) points")
    print("        Ensures systems are patched against known vulnerabilities\n")
    print("  5. 👤 SUDO USERS")
    print("     └─ Penalties: 10 (4-5 users), 20 (>5 users) points")
    print("        Limits privilege escalation surface area\n")
    print_separator("=", 80)
    print("\n🎯 Risk Levels:")
    print("  • Excellent: 90-100  (Green zone - minimal risk)")
    print("  • Low:       75-89   (Yellow zone - minor improvements)")
    print("  • Medium:    60-74   (Orange zone - review recommendations)")
    print("  • High:      40-59   (Red zone - urgent action needed)")
    print("  • Critical:  0-39    (Red zone - severe vulnerabilities)")
    print_separator("=", 80)


if __name__ == "__main__":
    main()
