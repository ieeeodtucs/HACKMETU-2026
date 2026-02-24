#!/usr/bin/env python3
"""
Fake Multi-Agent Simulator for OperationScore

Spawns multiple concurrent fake device agents that generate random metrics
and submit operational health reports to the scoring API.

Usage:
    python agent/fake_agents.py --agents 20 --interval 10
    python agent/fake_agents.py --agents 10 --server http://localhost:8000
"""

import asyncio
import aiohttp
import argparse
import logging
import random
import signal
import sys
from datetime import datetime
from typing import Dict, Any, List

# Configure logging with detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


def generate_metrics(hostname: str) -> Dict[str, Any]:
    """
    Generate random device metrics for a fake agent.
    
    Simulates realistic system metrics within typical ranges:
    - Updates: 0-25 pending patches
    - Firewall: Enabled/disabled randomly
    - SSH: Always disabled (secure default)
    - Sudo users: 1-3 privileged users
    - Services: None for simplicity
    - Disk: 10-90% usage range
    - Password policy: Compliant/non-compliant
    - Last seen: 0-5 minutes (just reported)
    
    Args:
        hostname: The fake device hostname
        
    Returns:
        Dictionary of device metrics
    """
    return {
        "hostname": hostname,
        "timestamp": datetime.now().isoformat() + "Z",
        "update_count": random.randint(0, 25),
        "firewall_enabled": random.choice([True, False]),
        "ssh_root_login_allowed": False,  # Always disabled for security
        "sudo_users_count": random.randint(1, 3),
        "unnecessary_services": [],  # No unnecessary services in fake agents
        "disk_usage_percent": random.randint(10, 90),
        "password_policy_ok": random.choice([True, False]),
        "last_seen_minutes": random.randint(0, 2)  # Just reported
    }


async def fake_agent(
    agent_id: int,
    server_url: str,
    max_interval: int,
    session: aiohttp.ClientSession,
    shutdown_event: asyncio.Event
) -> None:
    """
    Simulate a fake device agent reporting operational health metrics.
    
    Each agent:
    1. Generates random metrics
    2. Submits POST /report to the server
    3. Sleeps for random interval
    4. Repeats until shutdown signal
    
    Args:
        agent_id: Unique agent identifier (1-based)
        server_url: Base URL of the scoring API
        max_interval: Maximum sleep interval in seconds
        session: Shared aiohttp ClientSession
        shutdown_event: Signal to stop the agent gracefully
    """
    hostname = f"fake-device-{agent_id}"
    logger = logging.getLogger(hostname)
    
    logger.info("Agent started")
    
    reports_sent = 0
    
    try:
        while not shutdown_event.is_set():
            # Generate random metrics
            metrics = generate_metrics(hostname)
            
            # Submit POST /report
            try:
                async with session.post(
                    f"{server_url}/report",
                    json=metrics,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    reports_sent += 1
                    if response.status == 200:
                        # Parse response to show score
                        report = await response.json()
                        score = report.get("total_score", "?")
                        logger.info(
                            f"Report #{reports_sent} submitted - "
                            f"Score: {score}, Updates: {metrics['update_count']}, "
                            f"Firewall: {metrics['firewall_enabled']}"
                        )
                    else:
                        logger.warning(f"Report #{reports_sent} failed - Status: {response.status}")
            except asyncio.TimeoutError:
                logger.error(f"Report #{reports_sent + 1} timeout")
            except aiohttp.ClientError as e:
                logger.error(f"Connection error: {e}")
            except Exception as e:
                logger.error(f"Unexpected error sending report: {e}")
            
            # Sleep for random interval (1 to max_interval seconds)
            sleep_time = random.randint(1, max_interval)
            try:
                await asyncio.wait_for(
                    shutdown_event.wait(),
                    timeout=sleep_time
                )
                # Shutdown event was set
                break
            except asyncio.TimeoutError:
                # Timeout expired, continue to next iteration
                pass
    
    except Exception as e:
        logger.error(f"Fatal error: {e}")
    finally:
        logger.info(f"Agent stopped (sent {reports_sent} reports)")


async def run_simulator(
    num_agents: int,
    server_url: str,
    max_interval: int
) -> None:
    """
    Launch and manage multiple fake agents.
    
    Creates N concurrent fake agents, each with unique hostnames,
    all reporting metrics concurrently to the scoring API.
    
    Args:
        num_agents: Number of fake agents to spawn
        server_url: Base URL of the scoring API
        max_interval: Maximum sleep interval between reports
    """
    logger = logging.getLogger("FakeAgentSimulator")
    logger.info(
        f"Starting simulator with {num_agents} agents, "
        f"max interval {max_interval}s, server {server_url}"
    )
    
    # Shutdown event for graceful termination
    shutdown_event = asyncio.Event()
    
    # Register signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        logger.info("Shutdown signal received, stopping agents...")
        shutdown_event.set()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create shared aiohttp session
    async with aiohttp.ClientSession() as session:
        # Create concurrent tasks for all agents
        tasks: List[asyncio.Task] = [
            asyncio.create_task(
                fake_agent(i + 1, server_url, max_interval, session, shutdown_event)
            )
            for i in range(num_agents)
        ]
        
        logger.info(f"Spawned {len(tasks)} fake agents")
        
        try:
            # Wait for all agents to complete
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Error during simulation: {e}")
        finally:
            logger.info("Simulator shutdown complete")


def main():
    """
    Parse command-line arguments and start the fake agent simulator.
    
    CLI Arguments:
        --agents N: Number of fake agents to spawn (default: 10)
        --interval S: Maximum seconds between reports (default: 5)
        --server URL: Scoring API server URL (default: http://localhost:8000)
    """
    parser = argparse.ArgumentParser(
        description="Fake multi-agent simulator for OperationScore",
        epilog="Example: python fake_agents.py --agents 20 --interval 10"
    )
    
    parser.add_argument(
        "--agents",
        type=int,
        default=10,
        help="Number of fake agents to spawn (default: 10)"
    )
    
    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Maximum sleep interval in seconds between reports (default: 5)"
    )
    
    parser.add_argument(
        "--server",
        type=str,
        default="http://localhost:8000",
        help="Scoring API server URL (default: http://localhost:8000)"
    )
    
    args = parser.parse_args()
    
    # Validate arguments
    if args.agents < 1:
        print("Error: --agents must be at least 1")
        sys.exit(1)
    
    if args.interval < 1:
        print("Error: --interval must be at least 1 second")
        sys.exit(1)
    
    # Run the simulator
    try:
        asyncio.run(run_simulator(args.agents, args.server, args.interval))
    except KeyboardInterrupt:
        print("\nSimulator interrupted by user")
        sys.exit(0)


if __name__ == "__main__":
    main()
