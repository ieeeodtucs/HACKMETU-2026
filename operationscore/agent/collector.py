"""
Linux System Health Metrics Collector Agent

Collects operational health metrics from a Linux system and sends them to the
OperationScore API for evaluation. Metrics include package updates, firewall status,
SSH security configuration, user privileges, disk usage, and service status.
"""

import json
import logging
import os
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MetricsCollector:
    """Collects Linux system metrics for operational health scoring."""
    
    def __init__(self, api_url: str = "http://127.0.0.1:8000/report"):
        """
        Initialize the metrics collector.
        
        Args:
            api_url: The endpoint URL for submitting metrics (default: localhost:8000/report)
        """
        self.api_url = api_url
        # Derive the task base URL safely from the configured api_url.
        # We strip the path and append /tasks so the replacement never corrupts
        # hostnames or paths that happen to contain the string "/report".
        parsed = urlparse(api_url)
        self.task_api_url = parsed._replace(path="/tasks").geturl()
        self.hostname = socket.gethostname()
        self.timestamp = datetime.now(timezone.utc).isoformat()
        # Security notification state
        self.notify_enabled: bool = False
        self._last_security_fingerprint: Optional[str] = None
        # Resolve security_notify sibling module lazily
        self._script_dir = os.path.dirname(os.path.abspath(__file__))
    
    def run_command(
        self,
        command: str,
        shell: bool = False,
        timeout: int = 5,
    ) -> Optional[str]:
        """
        Execute a system command and return its stdout.

        Args:
            command: Command string (shell=True) or list (shell=False).
            shell: Whether to execute via the shell.
            timeout: Seconds before the process is killed (default 5).

        Returns:
            Stripped stdout on success, or None on any failure.
        """
        try:
            result = subprocess.run(
                command,
                shell=shell,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            if result.returncode == 0:
                return result.stdout.strip()
            logger.warning("Command failed: %s. stderr: %s", command, result.stderr.strip())
            return None
        except FileNotFoundError:
            logger.warning("Command not found: %s", command)
            return None
        except subprocess.TimeoutExpired:
            logger.warning("Command timed out after %ss: %s", timeout, command)
            return None
        except Exception as exc:  # noqa: BLE001
            logger.warning("Unexpected error running %r: %s", command, exc)
            return None
    
    def count_pending_updates(self) -> int:
        """
        Count pending package updates using apt.
        
        Returns:
            Number of pending updates, or 0 if unable to determine
        """
        try:
            output = self.run_command("apt list --upgradable 2>/dev/null", shell=True)
            if output:
                # Output format: "package/distro version [upgradable from: version]"
                # Count lines minus the header line
                lines = output.split('\n')
                # Filter out empty lines and the "upgradable" line
                update_count = sum(1 for line in lines if line and not line.startswith('Listing'))
                logger.info(f"Pending updates: {update_count}")
                return max(0, update_count)
            return 0
        except Exception as e:
            logger.error(f"Error counting pending updates: {e}")
            return 0
    
    def check_firewall_enabled(self) -> bool:
        """
        Check if a firewall (UFW or firewalld) is active.

        Primary check: ``systemctl is-active --quiet`` for both ``ufw`` and
        ``firewalld``.  If systemctl is absent, broken, or times out for all
        candidates, falls back to reading ``/etc/ufw/ufw.conf`` directly —
        which requires zero privileges and is stable even on WSL.

        Returns:
            True if ufw or firewalld is active (or ufw.conf says ENABLED=yes),
            False otherwise.
        """
        _systemctl_missing = False

        for fw in ("ufw", "firewalld"):
            try:
                result = subprocess.run(
                    ["systemctl", "is-active", "--quiet", fw],
                    timeout=3,
                    capture_output=True,
                )
                if result.returncode == 0:
                    logger.info(f"Firewall enabled via systemctl ({fw})")
                    return True
                # Non-zero exit (inactive / unknown) — try next firewall
            except FileNotFoundError:
                # systemctl binary not found — stop trying it for remaining
                # firewalls but still attempt the file-based fallback below.
                logger.debug("systemctl not found; will try file-based fallback")
                _systemctl_missing = True
                break
            except subprocess.TimeoutExpired:
                # This specific service check timed out; continue to the next.
                logger.warning(f"Timeout checking firewall service: {fw}")
            except Exception as e:
                logger.warning(f"Error checking firewall '{fw}': {e}")

        # ------------------------------------------------------------------
        # File-based fallback: read /etc/ufw/ufw.conf
        # Reliable on systems where systemctl is unreliable (e.g. WSL).
        # The file is world-readable and requires no elevated privileges.
        # ------------------------------------------------------------------
        try:
            with open("/etc/ufw/ufw.conf", "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("#") or "=" not in line:
                        continue
                    key, _, val = line.partition("=")
                    if key.strip().upper() == "ENABLED" and val.strip().lower() == "yes":
                        logger.info("Firewall enabled via /etc/ufw/ufw.conf")
                        return True
        except FileNotFoundError:
            pass  # ufw not installed at all
        except Exception as e:
            logger.warning(f"Error reading /etc/ufw/ufw.conf: {e}")

        logger.info("No active firewall detected (ufw/firewalld both inactive)")
        return False
    
    def check_ssh_root_login(self) -> bool:
        """
        Check if SSH root login is allowed by reading sshd_config.
        
        Returns:
            True if root login is allowed, False if disabled
        """
        try:
            # Read the SSH config file
            with open("/etc/ssh/sshd_config", "r") as f:
                config = f.read()
            
            # Check for PermitRootLogin settings
            for line in config.split('\n'):
                line = line.strip()
                if line.startswith('PermitRootLogin'):
                    # Check if it's not commented out
                    if not line.startswith('#'):
                        # PermitRootLogin can be: yes, no, prohibit-password, forced-commands-only
                        is_allowed = 'yes' in line.lower()
                        logger.info(f"SSH root login allowed: {is_allowed}")
                        return is_allowed
            
            # If PermitRootLogin is not explicitly set, it defaults to 'prohibit-password'
            logger.info("PermitRootLogin not explicitly set, defaulting to disabled")
            return False
        except FileNotFoundError:
            logger.error("SSH config file not found at /etc/ssh/sshd_config")
            return False
        except Exception as e:
            logger.error(f"Error checking SSH root login: {e}")
            return False
    
    def count_sudo_users(self) -> int:
        """
        Count users with sudo privileges.
        
        Returns:
            Number of users in the sudo group
        """
        try:
            # Get sudo group members using /etc/group
            with open("/etc/group", "r") as f:
                for line in f:
                    if line.startswith("sudo:"):
                        # Format: sudo:x:27:user1,user2,user3
                        parts = line.split(':')
                        if len(parts) >= 4 and parts[3].strip():
                            users = [u.strip() for u in parts[3].split(',') if u.strip()]
                            count = len(users)
                            logger.info(f"Sudo users count: {count} ({', '.join(users)})")
                            return count
                        else:
                            logger.info("No sudo users found")
                            return 0
            
            # If sudo group not found, check sudoers file
            logger.warning("Could not find sudo group, attempting to check sudoers file")
            return 0
        except FileNotFoundError:
            logger.error("/etc/group file not found")
            return 0
        except Exception as e:
            logger.error(f"Error counting sudo users: {e}")
            return 0
    
    def get_disk_usage(self) -> float:
        """
        Get root (/) disk usage percentage.
        
        Returns:
            Disk usage as percentage (0-100), or 0.0 if unable to determine
        """
        try:
            result = subprocess.run(
                ["/usr/bin/df", "-h", "/"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                logger.warning(f"df command failed: {result.stderr}")
                return 0.0
            
            # Output format:
            # Filesystem     Size  Used Avail Use% Mounted on
            # /dev/sda1       50G   25G   25G  50% /
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                # Parse the second line (data line)
                parts = lines[1].split()
                if len(parts) >= 5:
                    # Use% is typically the 5th field
                    usage_str = parts[4].rstrip('%')
                    disk_usage_percent = float(usage_str)
                    logger.info(f"Disk usage: {disk_usage_percent}%")
                    return min(100.0, max(0.0, disk_usage_percent))
            
            logger.warning("Could not parse disk usage output")
            return 0.0
            
        except subprocess.TimeoutExpired:
            logger.warning("df command timed out")
            return 0.0
        except Exception as e:
            logger.error(f"Error getting disk usage: {e}")
            return 0.0
    
    def check_password_policy(self) -> bool:
        """
        Check if password policy is configured.
        
        Looks for password policy configuration in /etc/security/pwquality.conf
        or /etc/login.defs. This is a simple check for compliance.
        
        Returns:
            True if password policy appears to be configured, False otherwise
        """
        try:
            # Check for pwquality config (Ubuntu/Debian with libpam-pwquality)
            try:
                with open("/etc/security/pwquality.conf", "r") as f:
                    content = f.read()
                    # Check for minimum requirements
                    has_policy = ("minlen" in content or "dcredit" in content or 
                                 "ucredit" in content or "lcredit" in content)
                    if has_policy:
                        logger.info("Password policy configured via pwquality")
                        return True
            except FileNotFoundError:
                pass
            
            # Check for PAM configuration
            try:
                with open("/etc/pam.d/common-password", "r") as f:
                    content = f.read()
                    has_pam_policy = "pam_pwquality" in content or "pam_cracklib" in content
                    if has_pam_policy:
                        logger.info("Password policy configured via PAM")
                        return True
            except FileNotFoundError:
                pass
            
            logger.info("No explicit password policy configuration found")
            return False
        except Exception as e:
            logger.error(f"Error checking password policy: {e}")
            return False
    
    def get_cpu_usage_percent(self) -> float:
        """
        Estimate CPU usage from the 1-minute load average normalized by core count.

        Formula: clamp((load1 / cores) * 100, 0, 100)
        This is a lightweight, no-sleep, no-dependency estimate.
        Returns 0.0 if os.getloadavg is unavailable (e.g. non-Linux).

        Returns:
            CPU usage estimate as percentage (0.0-100.0)
        """
        try:
            load1 = os.getloadavg()[0]
            cores = os.cpu_count() or 1
            pct = round(min(100.0, max(0.0, (load1 / cores) * 100.0)), 1)
            logger.info(f"CPU usage estimate (load1 normalized): {pct}%")
            return pct
        except (AttributeError, OSError) as e:
            logger.debug(f"os.getloadavg unavailable: {e}; defaulting cpu_usage_percent to 0.0")
            return 0.0
        except Exception as e:
            logger.warning(f"Unexpected error computing CPU usage: {e}")
            return 0.0


    def get_ram_usage(self) -> float:
        """
        Get current RAM utilization as a percentage.

        Reads /proc/meminfo (preferred, no subprocess needed).
        Falls back to parsing 'free -m' if /proc/meminfo is unavailable.
        Returns 0.0 on total failure.

        Returns:
            RAM usage as percentage (0.0-100.0)
        """
        try:
            with open("/proc/meminfo", "r") as f:
                info = {}
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        key = parts[0].rstrip(":")
                        info[key] = int(parts[1])
                total = info.get("MemTotal", 0)
                available = info.get("MemAvailable", 0)
                if total > 0:
                    used_pct = (total - available) / total * 100.0
                    result = round(min(100.0, max(0.0, used_pct)), 1)
                    logger.info(f"RAM usage: {result}%")
                    return result
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.warning(f"Error reading /proc/meminfo: {e}")

        # Fallback: parse 'free -m'
        try:
            result = subprocess.run(
                ["free", "-m"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                if line.startswith("Mem:"):
                    parts = line.split()
                    if len(parts) >= 3:
                        total_mb = float(parts[1])
                        used_mb  = float(parts[2])
                        if total_mb > 0:
                            pct = round(min(100.0, max(0.0, used_mb / total_mb * 100.0)), 1)
                            logger.info(f"RAM usage (free -m fallback): {pct}%")
                            return pct
        except Exception as e:
            logger.warning(f"Error running 'free -m': {e}")

        logger.warning("Could not determine RAM usage; defaulting to 0.0")
        return 0.0

    def get_unnecessary_services(self) -> List[str]:
        """
        Get list of unnecessary/blacklisted services that are actively running.

        Checks each service in the blacklist using ``systemctl is-active --quiet``.
        A service is included in the result only when the exit code is 0 (active).
        If ``systemctl`` is absent or any individual check fails, that service is
        silently skipped so the collector never crashes.

        Returns:
            List of blacklisted service names that are currently active,
            in the same order as the blacklist.
        """
        # Hackathon blacklist – services that must NOT be running
        blacklist = ["telnet", "vsftpd", "proftpd", "transmission-daemon"]
        running_unnecessary = []

        for service in blacklist:
            try:
                result = subprocess.run(
                    ["systemctl", "is-active", "--quiet", service],
                    timeout=2,
                    capture_output=True,
                )
                if result.returncode == 0:
                    running_unnecessary.append(service)
            except FileNotFoundError:
                # systemctl not available on this host – treat as not active
                logger.debug("systemctl not found; skipping unnecessary-service check")
                break
            except subprocess.TimeoutExpired:
                logger.warning(f"Timeout checking service: {service}")
            except Exception as e:
                logger.warning(f"Error checking service '{service}': {e}")

        if running_unnecessary:
            logger.info(f"Unnecessary services running: {running_unnecessary}")
        return running_unnecessary
    
    def collect_metrics(self) -> Dict[str, Any]:
        """
        Collect all system metrics.
        
        Returns:
            Dictionary of collected metrics matching DeviceMetrics schema
        """
        logger.info("Starting metrics collection...")
        
        metrics = {
            "hostname": self.hostname,
            "timestamp": self.timestamp,
            "update_count": self.count_pending_updates(),
            "firewall_enabled": self.check_firewall_enabled(),
            "ssh_root_login_allowed": self.check_ssh_root_login(),
            "sudo_users_count": self.count_sudo_users(),
            "unnecessary_services": self.get_unnecessary_services(),
            "disk_usage_percent": self.get_disk_usage(),
            "password_policy_ok": self.check_password_policy(),
            "last_seen_minutes": 0,  # Freshly collected, so 0 minutes old
            "ram_usage_percent": self.get_ram_usage(),
            "cpu_usage_percent": self.get_cpu_usage_percent(),
        }
        
        logger.info(f"Collected metrics: {json.dumps(metrics, indent=2)}")
        return metrics
    
    def send_metrics(self, metrics: Dict[str, Any]) -> bool:
        """
        Send collected metrics to the API endpoint.

        Lazily imports ``requests`` so the module can be imported on hosts
        where the package is not installed (e.g. during dry-run).

        Args:
            metrics: Dictionary of metrics to send

        Returns:
            True if successful, False otherwise
        """
        try:
            import requests  # lazy — only needed for actual POST

            logger.info(f"Sending metrics to {self.api_url}...")
            response = requests.post(
                self.api_url,
                json=metrics,
                timeout=10,
                headers={"Content-Type": "application/json"},
            )

            if response.status_code == 200:
                logger.info("Metrics sent successfully")
                report = response.json()
                logger.info(f"Operational health score: {report.get('total_score', 'N/A')}")

                # Log any issues detected
                issues = report.get("issues", [])
                if issues:
                    logger.warning(f"Issues detected: {len(issues)}")
                    for issue in issues:
                        logger.warning(f"  - [{issue.get('rule_id')}] {issue.get('message')}")

                # Security-issues alert with spam control (B1.3)
                if self.notify_enabled and issues:
                    # Import lazily so collector.py is usable without security_notify on PATH
                    if self._script_dir not in sys.path:
                        sys.path.insert(0, self._script_dir)
                    try:
                        from security_notify import (
                            extract_security_issues,
                            build_security_alert_payload,
                            print_security_alert,
                            try_notify_send,
                        )
                        risk_level = report.get("risk_level") or "UNKNOWN"
                        sec_issues = extract_security_issues(issues)
                        if sec_issues:
                            payload = build_security_alert_payload(
                                hostname=self.hostname,
                                risk_level=risk_level,
                                issues=sec_issues,
                            )
                            fingerprint = "|".join(payload["issues"])
                            if fingerprint != self._last_security_fingerprint:
                                print_security_alert(payload)
                                logger.warning("SECURITY_ALERT %s", payload)
                                try_notify_send(payload)
                                self._last_security_fingerprint = fingerprint
                            else:
                                logger.debug("Security fingerprint unchanged; skip alert")
                    except Exception as _e:
                        logger.warning("Security alert failed: %s", _e)

                return True

            logger.error(f"API returned status {response.status_code}: {response.text}")
            return False

        except requests.exceptions.ConnectionError:
            logger.error(f"Failed to connect to API at {self.api_url}")
            return False
        except requests.exceptions.Timeout:
            logger.error("Request to API timed out")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
            return False
        except json.JSONDecodeError:
            logger.error("Failed to parse API response as JSON")
            return False
        except Exception as e:
            logger.error(f"Error sending metrics: {e}")
            return False
    
    def get_task(self) -> Optional[Dict[str, Any]]:
        """
        Poll the task server for a pending task for this device.

        Sends a GET request to /tasks/{hostname} and retrieves the oldest
        pending task. The task is automatically removed from the queue upon
        retrieval.

        Returns:
            Dictionary containing task data if available:
                - task_id: UUID identifier for the task
                - command: Command to execute (e.g., "run_scan")
                - created_at: Timestamp when task was created
            None if no tasks are pending (server returns 204 No Content)

        Raises:
            None - all errors are logged and return None gracefully
        """
        try:
            import requests  # lazy — only needed for network calls

            task_url = f"{self.task_api_url}/{self.hostname}"
            logger.debug(f"Polling for tasks at {task_url}...")

            response = requests.get(
                task_url,
                timeout=5,
                headers={"Content-Type": "application/json"},
            )

            # 204 No Content means no tasks available
            if response.status_code == 204:
                logger.debug("No pending tasks")
                return None

            # 200 OK means we have a task
            if response.status_code == 200:
                task = response.json()
                logger.info(f"Task received: {task.get('task_id')} - Command: {task.get('command')}")
                return task

            # Any other status code is an error
            logger.warning(f"Unexpected status {response.status_code} from task server: {response.text}")
            return None

        except requests.exceptions.ConnectionError:
            logger.warning(f"Failed to connect to task server at {self.task_api_url}")
            return None
        except requests.exceptions.Timeout:
            logger.warning("Request to task server timed out")
            return None
        except requests.exceptions.RequestException as e:
            logger.warning(f"Request to task server failed: {e}")
            return None
        except json.JSONDecodeError:
            logger.warning("Failed to parse task server response as JSON")
            return None
        except Exception as e:
            logger.warning(f"Error retrieving task: {e}")
            return None
    
    def execute_task(self, task: Dict[str, Any]) -> bool:
        """
        Execute a task received from the task server.
        
        Currently supports the "run_scan" command which performs a full
        metrics collection and sends the report to the API.
        
        Args:
            task: Task dictionary containing task_id, command, and created_at
        
        Returns:
            True if task executed successfully, False otherwise
        """
        try:
            task_id = task.get("task_id")
            command = task.get("command")
            
            logger.info(f"Task execution started: {task_id} (command: {command})")
            
            if command == "run_scan":
                # Execute the metrics collection and reporting
                metrics = self.collect_metrics()
                success = self.send_metrics(metrics)
                
                if success:
                    logger.info(f"Task {task_id} completed successfully")
                    return True
                else:
                    logger.error(f"Task {task_id} failed during metrics submission")
                    return False
            else:
                logger.warning(f"Unknown task command: {command}")
                return False
        
        except Exception as e:
            logger.error(f"Error executing task {task.get('task_id')}: {e}")
            return False
    
    def poll_tasks(self, poll_interval: int = 10) -> None:
        """
        Continuously poll the task server for pending tasks and execute them.
        
        This is a blocking call that runs an infinite loop. Each iteration:
        1. Polls for a task from the server
        2. If task available and command is supported, executes it
        3. Sleeps for poll_interval seconds before next poll
        
        Args:
            poll_interval: Seconds to wait between polls (default: 10)
        
        Note:
            - This method blocks indefinitely and should run in a long-lived process
            - Logs all task state transitions (received, started, completed, failed)
            - Handles network errors gracefully and continues polling
            - Timestamps are updated on each metrics collection
        
        Example:
            collector = MetricsCollector()
            collector.poll_tasks(poll_interval=15)  # Poll every 15 seconds
        """
        logger.info(f"Starting task polling for {self.hostname} (interval: {poll_interval}s)")
        
        # Perform initial registration scan before entering polling loop
        logger.info("Performing initial registration scan...")
        try:
            metrics = self.collect_metrics()
            if self.send_metrics(metrics):
                logger.info("Initial registration scan completed successfully")
            else:
                logger.warning("Initial registration scan failed to send metrics, continuing with polling")
        except Exception as e:
            logger.warning(f"Initial registration scan failed with error: {e}, continuing with polling")
        
        while True:
            try:
                # Update timestamp for freshness (UTC-aware)
                self.timestamp = datetime.now(timezone.utc).isoformat()
                
                # Poll for a task
                task = self.get_task()
                
                if task:
                    # Execute the task if it's supported
                    self.execute_task(task)
                
                # Sleep before next poll
                time.sleep(poll_interval)
            
            except KeyboardInterrupt:
                logger.info("Task polling interrupted by user")
                break
            except Exception as e:
                logger.error(f"Unexpected error in polling loop: {e}")
                # Continue polling despite errors
                time.sleep(poll_interval)
    def run(self) -> bool:
        """
        Run the full collection and submission cycle.

        Executes a single metrics collection, sends the report to the API,
        and returns True on success or False on failure. All errors are
        logged and swallowed so callers receive a boolean result.
        """
        try:
            metrics = self.collect_metrics()
            success = self.send_metrics(metrics)

            if success:
                logger.info("Metrics collection and submission completed successfully")
            else:
                logger.error("Failed to submit metrics to API")

            return bool(success)
        except Exception as e:
            logger.exception(f"Fatal error during metrics collection: {e}")
            return False


def main():
    """
    DEPRECATED: Use agent/ops_collect.py as the single official entrypoint.
    This main() is retained for backward-compatibility only.
    collector.py remains importable as a library (MetricsCollector).
    """
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Linux System Health Metrics Collector"
    )
    parser.add_argument(
        "--api-url",
        default="http://127.0.0.1:8000/report",
        help="API endpoint URL (default: http://127.0.0.1:8000/report)"
    )
    parser.add_argument(
        "--poll",
        action="store_true",
        help="Enable task polling mode instead of single run"
    )
    parser.add_argument(
        "--poll-interval",
        type=int,
        default=10,
        help="Seconds between task polls (default: 10)"
    )
    parser.add_argument(
        "--notify",
        action="store_true",
        default=False,
        help="Emit OPERATIONSCORE_SECURITY_ALERT and desktop popup when security issues detected"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    collector = MetricsCollector(api_url=args.api_url)
    collector.notify_enabled = args.notify
    
    # Choose execution mode
    if args.poll:
        # Task polling mode - runs indefinitely
        logger.info("Running in task polling mode")
        collector.poll_tasks(poll_interval=args.poll_interval)
        # poll_tasks() blocks indefinitely, but handle graceful exit
        sys.exit(0)
    else:
        # Single execution mode - collect and submit once
        logger.info("Running in single execution mode")
        success = collector.run()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
