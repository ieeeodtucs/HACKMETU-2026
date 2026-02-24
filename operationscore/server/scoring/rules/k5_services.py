"""
Rule K5: Unnecessary Services

Evaluates whether unnecessary or resource-wasting services are running on
the system. Unnecessary services waste system resources, increase the attack
surface, complicate maintenance, and consume memory and CPU unnecessarily.
"""

from typing import Optional
from ...models import DeviceMetrics, ScoreIssue


def rule_unnecessary_services(metrics: DeviceMetrics) -> Optional[ScoreIssue]:
    """
    Rule K5: Check for unnecessary or resource-wasting background services.
    
    Running unnecessary services increases attack surface, wastes system resources
    (CPU, memory, disk), complicates security maintenance, and creates additional
    points of potential vulnerability. Only essential services should be enabled.
    
    Penalty structure (proportional to number of services):
    - 0 penalty if unnecessary_services is empty (passing)
    - 8 penalty for 1 unnecessary service
    - 12 penalty for 2 unnecessary services
    - 16 penalty for 3 unnecessary services
    - 20+ penalty for 4 or more unnecessary services
    
    Args:
        metrics: Device metrics containing unnecessary_services list.
        
    Returns:
        ScoreIssue with penalty proportional to service count, or None if clean.
    """
    services = metrics.unnecessary_services
    
    # No unnecessary services - rule passes
    if not services:
        return None
    
    service_count = len(services)
    service_list = ", ".join(services)
    
    # Calculate penalty proportional to number of services
    # Base penalty of 4 per service + 4 minimum
    penalty = min(25.0, 4.0 + (4.0 * service_count))
    
    # Construct message with grammar appropriate to count
    if service_count == 1:
        message = (
            f"Unnecessary service detected: {service_list}. "
            "Running unused services wastes system resources and increases the attack surface."
        )
    else:
        message = (
            f"{service_count} unnecessary services detected: {service_list}. "
            "Running multiple unused services wastes CPU, memory, and disk resources, "
            "and unnecessarily increases the application attack surface."
        )
    
    return ScoreIssue(
        rule_id="K5",
        penalty=penalty,
        message=message,
        recommendation=(
            "Disable unnecessary services to reduce resource consumption and attack surface. "
            "Use: sudo systemctl disable <service-name> && sudo systemctl stop <service-name>. "
            "Review system startup processes regularly to ensure only needed services are enabled."
        )
    )
