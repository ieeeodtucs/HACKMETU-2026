# OperationScore

> **Linux device security & operations scoring system — hackathon demo build**

OperationScore continuously monitors Linux hosts, assigns a **0–100 security score**, and surfaces actionable remediation steps through a live dashboard.

| Component | Role |
|---|---|
| **Agent** (`ops_collect.py`) | Collects host metrics, registers with server, submits reports |
| **Server** (`server/`) | Scores metrics with 10 rules, stores history in SQLite, serves REST + WebSocket APIs |
| **Dashboard** (`dashboard/`) | Static single-page app — no build step, no Node.js required |

**License:** MIT — see [`License.txt`](License.txt)

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Requirements & Installation](#2-requirements--installation)
3. [Running the Server](#3-running-the-server)
4. [Running the Dashboard](#4-running-the-dashboard)
5. [Agent Usage](#5-agent-usage)
6. [Scoring System](#6-scoring-system)
7. [API Reference](#7-api-reference)
8. [Default Accounts](#8-default-accounts)
9. [Database Schema](#9-database-schema)
10. [Environment Variables](#10-environment-variables)
11. [Multi-Machine / WSL2 Setup](#11-multi-machine--wsl2-setup)
12. [Running Tests](#12-running-tests)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Repository Layout

```text
operationscore/                   # repo root — always run commands from here
├── agent/
│   ├── ops_collect.py            # ✅ Official agent entrypoint
│   ├── collector.py              # MetricsCollector class (library); legacy CLI
│   ├── security_notify.py        # Security alert helper (shared by both agents)
│   └── fake_agents.py            # Demo simulation — generates synthetic reports
├── server/
│   ├── main.py                   # FastAPI app, all routes
│   ├── models.py                 # Pydantic models (DeviceMetrics, ScoreReport …)
│   ├── scoring/
│   │   ├── engine.py             # calculate_score() — applies all rules
│   │   └── rules/                # One file per rule: k1_updates.py … k10_gpu.py
│   ├── repository.py             # SQLite read/write helpers
│   ├── db.py                     # SQLAlchemy engine + init_db()
│   ├── auth_seed.py              # Seeds default accounts at startup
│   ├── config.py                 # Environment-driven configuration
│   └── data/                     # Runtime: operationscore.db created here
├── dashboard/
│   ├── index.html                # Main SPA shell
│   ├── app.js                    # All UI logic (vanilla JS)
│   └── style.css                 # All styles
├── tests/                        # Pytest suite (~220 tests)
├── requirements.txt              # sqlalchemy, bcrypt, python-dateutil
└── conftest.py
```

> `agent/ops_collect.py` is the **single supported entrypoint**.  
> `agent/collector.py` exposes a legacy `main()` retained for backward compatibility only.

---

## 2. Requirements & Installation

- **OS:** Linux (Pardus, Ubuntu, WSL2)
- **Python:** 3.10 or newer
- **pip**

### Install

```bash
# From the repo root
pip install -r requirements.txt
pip install fastapi "uvicorn[standard]" requests
```

> **Debian / Pardus system Python** — if pip refuses to install system-wide:
>
> ```bash
> pip install --break-system-packages -r requirements.txt
> pip install --break-system-packages fastapi "uvicorn[standard]" requests
> ```

---

## 3. Running the Server

```bash
# From the repo root
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

At startup the server automatically:

- Creates `server/data/operationscore.db` (SQLite) if absent
- Runs `init_db()` — creates all tables
- Seeds two default accounts (idempotent — safe to restart)
- Enables CORS for all origins (hackathon mode)

---

## 4. Running the Dashboard

The dashboard is **pure static HTML/JS/CSS** — no build step, no Node.js.

```bash
# From the repo root
python3 -m http.server 5173 --bind 0.0.0.0 --directory dashboard
```

Open: **`http://127.0.0.1:5173/`**

### Dashboard tabs

| Tab | What it shows |
|---|---|
| **Genel Bakış** | KPI cards (device count, average score, critical count), fleet trend chart |
| **Cihazlar** | Registered device list — score, risk badge, last-seen, IP |
| **Methedoloji** | Scoring rules K1–K10 with penalty tables and test scenarios |

---

## 5. Agent Usage

All commands are run from the **repo root**.

---

### 5.1 — First-time Registration

Each device must be registered **once** before it can submit reports.

```bash
python3 agent/ops_collect.py \
  --register \
  --api-url http://127.0.0.1:8000/report
```

The agent prompts interactively:

```
Username: ops-client
Password:
```

Success output (machine-parseable):

```
OPERATIONSCORE_REGISTER: {"ok":true,"hostname":"my-host","device_type":"CLIENT"}
```

---

### 5.2 — One-shot Scan

Collect metrics → POST `/report` → print result → exit.

```bash
python3 agent/ops_collect.py \
  --api-url http://127.0.0.1:8000/report
```

---

### 5.3 — Polling Mode (Continuous)

The agent polls the server for tasks and executes a full scan when instructed.

```bash
python3 agent/ops_collect.py \
  --poll \
  --api-url http://127.0.0.1:8000/report
```

- Calls `GET /tasks/{hostname}` every **10 s** (default)
- On `{"command": "run_scan"}` → runs a full scan and POSTs to `/report`
- `204 No Content` → no task pending, sleep and loop
- `Ctrl+C` → exit code 0

---

### 5.4 — All Agent Flags

| Flag | Default | Description |
|---|---|---|
| `--api-url URL` | `http://127.0.0.1:8000/report` | Report endpoint |
| `--center URL` | — | Server base URL; derives `/report`, `/api/register`, `/tasks/` automatically |
| `--register` | off | Perform interactive registration before first scan |
| `--poll` | off | Enable continuous task-polling mode |
| `--poll-interval N` | `10` | Seconds between polls |
| `--notify` | off | Emit `OPERATIONSCORE_SECURITY_ALERT` + desktop popup on security issues |
| `--critical-threshold N` | `60` | Score below which `OPERATIONSCORE_ALERT` is also emitted |
| `--dry-run` | off | Collect and print metrics JSON only — no network |
| `--write-status PATH` | `~/.local/share/operationscore/status.txt` | Write a status file after each scan |
| `--no-status` | off | Disable status file |
| `--ip IPv4` | auto-detected | IPv4 address to register as |
| `--token TOKEN` | — | Bearer token sent as `X-OPS-TOKEN` header |
| `--timeout N` | `5` | HTTP request timeout in seconds |
| `--print-pretty` | off | Print raw debug JSON before structured output |

---

### 5.5 — Machine-parseable Output Lines

All output is written to **stdout** and safe for cron logs / task history.

| Line | When emitted |
|---|---|
| `OPERATIONSCORE_REGISTER: {...}` | After registration attempt (success or failure) |
| `OPERATIONSCORE_SECURITY_ALERT: {...}` | `--notify` AND security issues found (K1/K2/K3/K4/K5/K7) |
| `OPERATIONSCORE_ALERT: ...` | `--notify` AND score < `--critical-threshold` |
| `OPERATIONSCORE_RESULT: {...}` | After a successful scan — contains score, risk, top issues |
| `OPERATIONSCORE_JSON: {...}` | Raw collected metrics (compact single line) |

**Output order when all alerts fire:**

```
OPERATIONSCORE_SECURITY_ALERT: {...}
OPERATIONSCORE_ALERT: Score 52 HIGH | Todo: ...
OPERATIONSCORE_RESULT: {...}
OPERATIONSCORE_JSON: {...}
```

---

## 6. Scoring System

### 6.1 — Algorithm

```
Score = 100 − Σ(penalties)          minimum 0, maximum 100
```

Each rule returns a penalty (0 = pass, >0 = issue detected). All penalties are summed and subtracted from 100.

### 6.2 — Risk Levels

| Score | Risk Level | Meaning |
|---|---|---|
| 90 – 100 | **Mükemmel** | Excellent — no significant issues |
| 75 – 89 | **İyi** | Good — minor improvements available |
| 60 – 74 | **Dikkat** | Caution — action recommended |
| 40 – 59 | **Yüksek** | High risk — urgent action required |
| 0 – 39 | **Kritik** | Critical — immediate remediation needed |

### 6.3 — Rules (K1 – K10)

| ID | Name | What is checked | Penalty |
|---|---|---|---|
| **K1** | Pending Updates | Package update backlog | 1–30+ (scales with count) |
| **K2** | Firewall | UFW / iptables / nftables enabled | 25 (flat) |
| **K3** | SSH Root Login | `PermitRootLogin` in sshd_config | 30 (flat) |
| **K4** | Sudo Users | Number of accounts with sudo/wheel | 5–25 (scales with count) |
| **K5** | Unnecessary Services | Blacklisted services running (`telnet`, `vsftpd`, `proftpd`, `transmission-daemon`) | 10 per service |
| **K6** | Disk Usage | Root filesystem utilisation | 10 (>80%), 20 (>90%), 30 (>95%) |
| **K7** | Password Policy | `pam_pwquality` / `pam_cracklib` / `/etc/login.defs` minlen | 20 (flat) |
| **K8** | Zombie Device | Minutes since last seen (`last_seen_minutes`) | 10 (>60 min) |
| **K9** | RAM Usage | RAM utilisation % | 5 (>70%), 10 (>85%), 20 (>95%) |
| **K10** | CPU Usage | Load-average / cores × 100 | 10 (>70%), 20 (>85%), 30 (>95%) |

> **K10 collection method:** `os.getloadavg()[0] / os.cpu_count() * 100` — no sleep, no psutil required.

### 6.4 — Security Alert Rules

Rules marked as **security rules** trigger `OPERATIONSCORE_SECURITY_ALERT` when `--notify` is active:

`K1` (updates) · `K2` (firewall) · `K3` (SSH root) · `K4` (sudo users) · `K5` (blacklisted services) · `K7` (password policy)

---

## 7. API Reference

Base URL: `http://<host>:8000`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/register` | username + password (body) | Register/update a device |
| `POST` | `/report` | none (device must be registered) | Submit metrics → returns score + issues |
| `GET` | `/api/devices` | none | List all registered devices with latest score |
| `GET` | `/api/devices/{hostname}/history` | none | Score history; `?limit=N` (default 100, max 200) |
| `GET` | `/api/fleet/history` | none | Fleet-wide aggregate; `?limit=N` (default 200) |
| `GET` | `/tasks/{hostname}` | none | Agent task queue — `200` task JSON or `204` nothing pending |
| `GET` | `/ws` | none | WebSocket — live score-update push |
| `GET` | `/docs` | none | Interactive Swagger UI |

### Example: submit a report

```bash
curl -s -X POST http://127.0.0.1:8000/report \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "my-host",
    "timestamp": "2026-02-22T10:00:00+00:00",
    "update_count": 5,
    "firewall_enabled": true,
    "ssh_root_login_allowed": false,
    "sudo_users_count": 1,
    "unnecessary_services": [],
    "disk_usage_percent": 45,
    "password_policy_ok": true,
    "last_seen_minutes": 0,
    "ram_usage_percent": 60.0,
    "cpu_usage_percent": 20.0
  }'
```

> **Backward compatibility:** payloads containing `gpu_usage_percent` are silently ignored.  
> `cpu_usage_percent` defaults to `0.0` if omitted (no K10 penalty).

---

## 8. Default Accounts

Seeded automatically on every startup (existing rows are never overwritten):

| Username | Password | Role | Purpose |
|---|---|---|---|
| `ops-server` | `server123!` | `SERVER` | Dashboard / admin |
| `ops-client` | `client123!` | `CLIENT` | Agent registration |

> **Demo note:** credentials are shown here for convenience.  
> Rotate before any production deployment.

---

## 9. Database Schema

**File:** `server/data/operationscore.db` (created at runtime — not committed)

**`auth_accounts`**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `username` | TEXT UNIQUE | |
| `password_hash` | TEXT | bcrypt |
| `role` | TEXT | `SERVER` or `CLIENT` |
| `can_register` | BOOLEAN | whether this account may register devices |
| `created_at` | DATETIME | UTC |

**`devices`**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `hostname` | TEXT UNIQUE | |
| `registered_ip` | TEXT | IP at registration |
| `last_seen_ip` | TEXT | IP of latest report |
| `device_type` | TEXT | `SERVER` or `CLIENT` |
| `registered_at` | DATETIME | UTC |
| `last_seen_at` | DATETIME | UTC |
| `is_active` | BOOLEAN | |

**`device_reports`**

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `device_id` | INTEGER FK | → `devices.id` (cascade delete) |
| `collected_at` | DATETIME | from agent timestamp |
| `total_score` | REAL | 0 – 100 |
| `risk_level` | TEXT | `EXCELLENT` / `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `metrics_json` | TEXT | raw collected metrics |
| `issues_json` | TEXT | rule violations |
| `top_reasons_json` | TEXT | human-readable issue summaries |
| `actions_json` | TEXT | remediation recommendations |

**Retention:** up to **500 reports per device** — oldest rows pruned automatically.

### Reset

```bash
rm -f server/data/operationscore.db
# restart the server — tables and seed accounts are recreated
```

---

## 10. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPS_SERVER_USER` | `ops-server` | Server account username |
| `OPS_SERVER_PASS` | `server123!` | Server account password |
| `OPS_CLIENT_USER` | `ops-client` | Client account username |
| `OPS_CLIENT_PASS` | `client123!` | Client account password |
| `OPS_REPORT_URL` | — | Override report URL in agent |
| `OPS_REGISTER_URL` | — | Override register URL in agent |
| `OPS_REGISTER_USER` | — | Auto-register username (non-interactive) |
| `OPS_REGISTER_PASS` | — | Auto-register password (non-interactive) |
| `OPS_POLL_INTERVAL_SECONDS` | `10` | Override poll interval |
| `MAX_HISTORY_LIMIT` | `200` | Server hard cap on `?limit=` parameter |
| `DEFAULT_DEVICE_HISTORY_LIMIT` | `100` | Default `?limit=` for device history endpoint |
| `DEFAULT_FLEET_HISTORY_LIMIT` | `200` | Default `?limit=` for fleet history endpoint |
| `API_ALLOW_ORIGINS` | `*` | CORS allowed origins (comma-separated) |

---

## 11. Multi-Machine / WSL2 Setup

If the server runs inside **WSL2** and agents run on a separate physical machine, WSL2 is NAT'd and ports are not directly reachable.

### Step 1 — Port forwarding (PowerShell as Administrator)

```powershell
netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=127.0.0.1
netsh interface portproxy add v4tov4 listenport=5173 listenaddress=0.0.0.0 connectport=5173 connectaddress=127.0.0.1
```

### Step 2 — Firewall rules

```powershell
netsh advfirewall firewall add rule name="OperationScore 8000" dir=in action=allow protocol=tcp localport=8000
netsh advfirewall firewall add rule name="OperationScore 5173" dir=in action=allow protocol=tcp localport=5173
```

### Step 3 — Agent on remote machine

```bash
# Replace with your Windows host LAN IP
SERVER=http://10.78.13.39:8000

# Register (first time only)
python3 agent/ops_collect.py --register --api-url $SERVER/report

# Poll continuously
python3 agent/ops_collect.py --poll --api-url $SERVER/report
```

Dashboard: `http://10.78.13.39:5173/`

---

## 12. Running Tests

```bash
# From the repo root
python3 -m pytest -q
```

Expected: **all tests pass** (~220 tests, 0 failures).

Run a specific module:

```bash
python3 -m pytest tests/test_scoring_k9_k10.py -v   # K9/K10 scoring rules
python3 -m pytest tests/test_security_notifications.py -v  # Security alert module
```

---

## 13. Troubleshooting

### `HTTP 403` on `/report` — `Device not registered`

```bash
python3 agent/ops_collect.py --register --api-url http://<SERVER>:8000/report
```

---

### `HTTP 401` on `/api/register` — `Unauthorized`

Wrong username/password, or the account has `can_register = false`.  
Verify against [Default Accounts](#8-default-accounts) or check your `OPS_CLIENT_*` env vars.

---

### Agent prints `OPERATIONSCORE_JSON` but no `OPERATIONSCORE_RESULT`

Running with `--dry-run` — remove that flag to make a real HTTP request.

---

### No `OPERATIONSCORE_SECURITY_ALERT` in poll mode

- Confirm `--notify` flag is passed.
- Security alerts require a security rule (K1/K2/K3/K4/K5/K7) to be triggered — check the score issues.

---

### Port already in use

```bash
# Use a different port
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8080
python3 -m http.server 8081 --bind 0.0.0.0 --directory dashboard
```

---

### Reset everything

```bash
rm -f server/data/operationscore.db
python3 -m uvicorn server.main:app --host 0.0.0.0 --port 8000
```
