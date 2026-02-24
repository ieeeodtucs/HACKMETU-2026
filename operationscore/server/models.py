from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import List, Optional


class DeviceMetrics(BaseModel):
    """
    Pydantic model representing an operational health report for a Linux system.
    
    This model validates and stores health metrics from a Linux device,
    including security status, resource utilization, and maintenance information.
    """
    
    hostname: str = Field(
        ..., 
        min_length=1, 
        max_length=255,
        description="The hostname of the Linux device (K0). Must be between 1 and 255 characters."
    )
    """The hostname of the Linux device."""
    
    timestamp: datetime = Field(
        ...,
        description="The ISO 8601 timestamp when the metrics were collected."
    )
    """The timestamp when the metrics were collected."""
    
    update_count: int = Field(
        ...,
        ge=0,
        description="K1: Number of package updates pending on the system."
    )
    """K1: Number of package updates pending."""
    
    firewall_enabled: bool = Field(
        ...,
        description="K2: Whether UFW (Uncomplicated Firewall) is enabled."
    )
    """K2: UFW firewall status."""
    
    ssh_root_login_allowed: bool = Field(
        ...,
        description="K3: Whether SSH root login is allowed (security risk if True)."
    )
    """K3: SSH root login permission status."""
    
    sudo_users_count: int = Field(
        ...,
        ge=0,
        description="K4: Number of users with sudo privileges."
    )
    """K4: Count of users with sudo privileges."""
    
    unnecessary_services: List[str] = Field(
        default_factory=list,
        description="K5: List of unnecessary/resource-wasting services running on the system."
    )
    """K5: List of unnecessary services that waste resources."""
    
    disk_usage_percent: int = Field(
        ...,
        ge=0,
        le=100,
        description="K6: Disk usage percentage (0-100)."
    )
    """K6: Disk capacity usage as percentage."""
    
    password_policy_ok: bool = Field(
        ...,
        description="K7: Whether the system password policy meets compliance requirements."
    )
    """K7: Password policy compliance status."""
    
    last_seen_minutes: int = Field(
        ...,
        ge=0,
        description="K8: Minutes since device was last seen (zombie device detection)."
    )
    """K8: Minutes since last activity (detects zombie devices)."""

    ram_usage_percent: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="K9: Current RAM utilization as percentage (0-100). Defaults to 0.0 if not provided."
    )
    """K9: RAM usage percentage. 0.0 means unknown/not collected."""

    cpu_usage_percent: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="K10: CPU utilization estimate (load1/cores*100, clamped 0-100). Defaults to 0.0."
    )
    """K10: CPU usage percentage derived from 1-min load average normalized by core count."""

    @field_validator('hostname')
    @classmethod
    def validate_hostname(cls, v: str) -> str:
        """Validate hostname contains only valid characters."""
        if not all(c.isalnum() or c in '.-' for c in v):
            raise ValueError('Hostname can only contain alphanumeric characters, dots, and hyphens')
        return v

    class Config:
        """Pydantic model configuration."""
        extra = "ignore"   # silently ignore unknown fields (e.g. legacy gpu_usage_percent)
        json_schema_extra = {
            "example": {
                "hostname": "prod-server-01",
                "timestamp": "2026-02-16T10:30:00Z",
                "update_count": 3,
                "firewall_enabled": True,
                "ssh_root_login_allowed": False,
                "sudo_users_count": 2,
                "unnecessary_services": [],
                "disk_usage_percent": 75,
                "password_policy_ok": True,
                "last_seen_minutes": 5,
                "ram_usage_percent": 62.5,
                "cpu_usage_percent": 45.0
            }
        }


class ScoreIssue(BaseModel):
    """
    Represents a single issue found during health scoring evaluation.
    
    Contains details about a rule violation including the penalty applied,
    descriptive message, and recommended remediation action.
    """
    
    rule_id: str = Field(
        ...,
        min_length=1,
        description="The unique identifier for the rule that detected this issue."
    )
    """The rule ID that identified this issue."""
    
    penalty: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="The penalty score deducted from the total score (0-100)."
    )
    """The penalty score applied for this issue (0-100)."""
    
    message: str = Field(
        ...,
        min_length=1,
        description="Human-readable description of the issue."
    )
    """Description of what issue was detected."""
    
    recommendation: str = Field(
        ...,
        min_length=1,
        description="Recommended action to remediate this issue."
    )
    """Recommended action to resolve this issue."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "rule_id": "K1",
                "penalty": 5.0,
                "message": "3 security updates are pending",
                "recommendation": "Run 'sudo apt update && sudo apt upgrade' to apply updates"
            }
        }


class ScoreReport(BaseModel):
    """
    Comprehensive operational health scoring report for a device.
    
    Combines results from all health rules into an aggregate score and list of issues.
    """
    
    total_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Final operational health score (0-100). Higher scores indicate better health."
    )
    """Final operational health score from 0-100. Higher is better."""
    
    issues: List[ScoreIssue] = Field(
        default_factory=list,
        description="List of all health/security issues detected during scoring."
    )
    """List of issues found during the health assessment."""
    
    class Config:
        """Pydantic model configuration."""
        json_schema_extra = {
            "example": {
                "total_score": 75.5,
                "issues": [
                    {
                        "rule_id": "K1",
                        "penalty": 5.0,
                        "message": "3 security updates are pending",
                        "recommendation": "Run 'sudo apt update && sudo apt upgrade' to apply updates"
                    },
                    {
                        "rule_id": "K5",
                        "penalty": 10.0,
                        "message": "Unnecessary service 'apache2' is running",
                        "recommendation": "Run 'sudo systemctl disable apache2' if not needed"
                    }
                ]
            }
        }