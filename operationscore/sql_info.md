# OperationScore — SQLite / SQLAlchemy Reference

> **Who is this for?** Any teammate who needs to understand how the database works, how to start it, how to reset it, and how the data flows from agent → server → SQLite.

---

## 1. What Is This?

OperationScore stores device registration and health-score history in a **local SQLite file** (`server/data/operationscore.db`). The backend uses **SQLAlchemy 2.0** to talk to it — there is no separate database server to install or manage.

SQLite is a file-based database:
- ✅ Zero config — just run the server
- ✅ Works offline
- ✅ The file is created automatically on first startup
- ✅ Reset anytime by deleting the file

---

## 2. File Locations

```
operationscore/
├── requirements.txt          ← sqlalchemy>=2.0, bcrypt>=4.0
├── server/
│   ├── db.py                 ← engine, SessionLocal, Base, init_db()
│   ├── db_models.py          ← ORM table definitions (AuthAccount, Device, DeviceReport)
│   ├── auth_seed.py          ← inserts 2 default accounts on startup
│   ├── repository.py         ← ALL DB queries live here (no SQL in main.py)
│   └── data/
│       ├── .gitkeep          ← keeps the directory in git
│       └── operationscore.db ← created at runtime (do NOT commit this file)
```

---

## 3. Database Schema

### 3.1 `auth_accounts` — Login credentials

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | autoincrement |
| `username` | VARCHAR(64) | unique, indexed |
| `password_hash` | VARCHAR(255) | bcrypt `$2b$12$...` |
| `role` | VARCHAR(16) | `"SERVER"` or `"CLIENT"` |
| `can_register` | BOOLEAN | if false, login blocked |
| `created_at` | DATETIME | UTC, timezone-aware |

**Purpose:** Devices register by posting their username + password. The server bcrypt-checks the hash and grants them a role.

### 3.2 `devices` — Registered devices

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | autoincrement |
| `hostname` | VARCHAR(255) | unique, indexed |
| `registered_ip` | VARCHAR(64) | IP from registration payload |
| `last_seen_ip` | VARCHAR(64) | nullable — updated on each report |
| `device_type` | VARCHAR(16) | `"SERVER"` or `"CLIENT"` |
| `registered_at` | DATETIME | UTC — when first registered |
| `last_seen_at` | DATETIME | UTC — updated on every report |
| `is_active` | BOOLEAN | soft delete flag |

**Index:** `ix_devices_device_type` on `device_type`

### 3.3 `device_reports` — Health score history

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | autoincrement |
| `device_id` | INTEGER FK → `devices.id` | CASCADE delete, indexed |
| `collected_at` | DATETIME | parsed from agent's `timestamp` field |
| `total_score` | FLOAT | 0.0 – 100.0 |
| `risk_level` | VARCHAR(16) | CRITICAL / HIGH / MEDIUM / LOW / EXCELLENT |
| `metrics_json` | TEXT | full `DeviceMetrics` dump as JSON |
| `issues_json` | TEXT | list of rule violations as JSON |
| `top_reasons_json` | TEXT | top-3 issues: `["K2 Firewall disabled", ...]` |
| `actions_json` | TEXT | top-3 recommendations: `["Enable UFW...", ...]` |

**Indexes:**
- `ix_device_reports_device_id_collected_at` (device_id, collected_at) — composite for fast history queries
- `ix_device_reports_device_id` (automatically from FK)

**Retention:** At most **500 reports per device** are kept. On insert, oldest rows beyond 500 are auto-deleted.

### 3.4 Entity Relationship

```
auth_accounts          devices                 device_reports
─────────────          ───────────             ──────────────
id PK                  id PK                   id PK
username               hostname (unique)        device_id ──► devices.id
password_hash          registered_ip            collected_at
role                   last_seen_ip             total_score
can_register           device_type              risk_level
created_at             registered_at            metrics_json
                       last_seen_at             issues_json
                       is_active                top_reasons_json
                                                actions_json
```

---

## 4. Risk Level Mapping

| Score Range | Risk Level |
|-------------|------------|
| 90 – 100 | EXCELLENT |
| 75 – 89 | LOW |
| 60 – 74 | MEDIUM |
| 40 – 59 | HIGH |
| 0 – 39 | CRITICAL |

---

## 5. Seeded Accounts (on every startup)

Two accounts are inserted automatically if they don't exist yet. Override with environment variables:

| Env Var | Default Value | Role |
|---------|--------------|------|
| `OPS_SERVER_USER` | `ops-server` | SERVER |
| `OPS_SERVER_PASS` | `server123!` | SERVER |
| `OPS_CLIENT_USER` | `ops-client` | CLIENT |
| `OPS_CLIENT_PASS` | `client123!` | CLIENT |

The seed is **idempotent** — restarting the server never overwrites existing accounts.

---

## 6. How to Start (Full Flow)

### Step 1: Install dependencies (once)
```bash
cd ~/hackmetu/operationscore
python3 -m pip install --break-system-packages -r requirements.txt
```

### Step 2: Start the server
```bash
python3 -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

On startup the server automatically:
1. Creates `server/data/` if it doesn't exist
2. Creates `server/data/operationscore.db` if it doesn't exist
3. Creates all tables (`auth_accounts`, `devices`, `device_reports`)
4. Seeds the two default accounts if they're missing
5. Begins serving requests

You should see:
```
INFO: Application startup complete.
```

### Step 3: Register a device
```bash
curl -X POST http://127.0.0.1:8000/api/register \
  -H "Content-Type: application/json" \
  -d '{"hostname":"my-laptop","ip":"192.168.1.10","username":"ops-client","password":"client123!"}'
```

Expected response:
```json
{"ok": true, "device_type": "CLIENT", "hostname": "my-laptop"}
```

### Step 4: Send a health report
```bash
curl -X POST http://127.0.0.1:8000/report \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "my-laptop",
    "timestamp": "2026-02-21T10:00:00+00:00",
    "update_count": 0,
    "firewall_enabled": true,
    "ssh_root_login_allowed": false,
    "sudo_users_count": 1,
    "unnecessary_services": [],
    "disk_usage_percent": 50,
    "password_policy_ok": true,
    "last_seen_minutes": 0
  }'
```

Expected response:
```json
{"ok": true, "hostname": "my-laptop", "score": 100.0, "total_score": 100.0, "risk_level": "EXCELLENT"}
```

> ⚠️ If you send a report from an **unregistered** hostname you get `HTTP 403`.

### Step 5: Run the agent (real system data)
```bash
cd ~/hackmetu/operationscore
python3 -m agent.ops_collect --api-url http://127.0.0.1:8000/report
```

Key output lines:
```
OPERATIONSCORE_RESULT: {"ok":true,"score":...}
OPERATIONSCORE_JSON: {"hostname":...,"update_count":...}
```

### Step 6: Query the dashboard API
```bash
# All devices with latest scores
curl http://127.0.0.1:8000/api/devices

# Score history for one device (ascending, for charts)
curl "http://127.0.0.1:8000/api/devices/my-laptop/history?limit=100"

# Fleet-wide timeline bucketed by minute
curl "http://127.0.0.1:8000/api/fleet/history?limit=200"
```

---

## 7. How to Inspect the Database Directly

```bash
# Count rows in each table
python3 - << 'EOF'
import sqlite3, pathlib
c = sqlite3.connect(pathlib.Path("server/data/operationscore.db"))
for t in ["auth_accounts", "devices", "device_reports"]:
    print(t, "→", c.execute(f"select count(*) from {t}").fetchone()[0], "rows")
EOF

# Show seeded accounts (passwords redacted for safety)
python3 - << 'EOF'
import sqlite3, pathlib
c = sqlite3.connect(pathlib.Path("server/data/operationscore.db"))
for row in c.execute("select username, role, can_register from auth_accounts"):
    print(row)
EOF
```

---

## 8. How to Reset (Fresh Start)

```bash
# Delete the DB file — server will recreate and reseed on next start
rm -f server/data/operationscore.db

# Restart the server
python3 -m uvicorn server.main:app --host 127.0.0.1 --port 8000
```

> The `.gitkeep` file in `server/data/` is not deleted, so the directory stays tracked in git.

---

## 9. How to Stop

```bash
# Ctrl+C in the terminal where uvicorn is running
# Or find and kill the process:
pkill -f "uvicorn server.main:app"
```

---

## 10. Code Map — Where Things Live

| What | File | Key function/class |
|------|------|--------------------|
| Engine + session factory | `server/db.py` | `engine`, `SessionLocal`, `init_db()` |
| ORM table definitions | `server/db_models.py` | `AuthAccount`, `Device`, `DeviceReport` |
| Startup seed | `server/auth_seed.py` | `seed_auth_accounts(db)` |
| ALL DB queries | `server/repository.py` | see §11 below |
| Startup wiring | `server/main.py` | `on_startup()` event |

---

## 11. Repository API (for teammates calling DB functions)

All functions are in `server/repository.py`. They open and close their own DB session internally — **callers do not pass a `db` session**.

```python
from server.repository import (
    verify_register_credentials,
    upsert_device,
    is_registered,
    save_report,
    get_devices_list,
    get_device_history,
    get_fleet_history,
)

# Check login credentials (returns True/False + role string or None)
ok, role = verify_register_credentials("ops-client", "client123!")

# Register / update a device
upsert_device("my-laptop", "192.168.1.10", "CLIENT", source_ip="192.168.1.10")

# Check if a device is registered (returns bool)
registered = is_registered("my-laptop")

# Save a scored report to history
save_report("my-laptop", metrics_obj, report_obj, source_ip="192.168.1.10")

# Get all devices with latest scores
devices = get_devices_list()
# → [{"hostname": "my-laptop", "device_type": "CLIENT", "latest_score": 100.0, ...}]

# Get score history for a device (ascending, for charts)
history = get_device_history("my-laptop", limit=100)
# → [{"timestamp": "2026-02-21T10:00:00+00:00", "score": 100.0}, ...]

# Fleet-wide timeline
fleet = get_fleet_history(limit=200)
# → [{"timestamp": ..., "fleet_avg": 80.0, "server_avg": 85.0, "client_avg": 75.0, "critical_count": 0}]
```

---

## 12. Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `HTTP 403 on /report` | Hostname not in `devices` table | Call `POST /api/register` first |
| `HTTP 401 on /api/register` | Wrong password or `can_register=False` | Check credentials / seed |
| `KeyError: 'Device not found'` | `get_device_history` called for unknown host | Register device first |
| `ValueError: device not registered` | `save_report` called before `upsert_device` | Registration step was skipped |
| DB file permission error | `server/data/` not writable | `chmod 755 server/data` |
