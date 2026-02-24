# AGENTS.md — Everything You Need to Know

## What Is This
- A simple Kovan (Command & Control) demo system written in Bun + TypeScript, consisting of a server, client agent, and web dashboard.
- Use pnpm instead of npm.

## Architecture
- Server (Bun + Hono) runs on port `4444`, hosting both a REST API and WebSocket endpoint.
- Agent (Bun) runs on the target machine, connects to the server via `ws://host:4444/ws/agent`.
- Dashboard (React + Vite) lists agents and provides a terminal UI to send commands.
- All data is held in memory (`Map`s in `store.ts`), there is no database.

## Flow
- Agent starts, connects to the server via WebSocket, and sends a `register` message (hostname, os, username, ip).
- Server assigns a unique 8-character ID and replies with a `registered` message.
- Agent sends a `heartbeat` every 10 seconds; server updates `lastSeen`.
- Dashboard user sends a command via REST API (`POST /api/command`); server forwards it to the agent over WebSocket.
- Agent executes the command using `sh -c` (Linux) or `cmd /c` (Windows), then sends stdout/stderr back as a `result` message.
- If the connection drops, the agent auto-reconnects after 5 seconds; the server marks that agent as offline.

## API Endpoints
- `GET /api/health` → server health check.
- `GET /api/agents` → list all agents (id, hostname, alias, os, ip, username, isOnline).
- `GET /api/agents/:id` → single agent details.
- `PATCH /api/agents/:id` → body: `{ alias: "Ofis PC" }` — set/clear agent alias (empty string removes it).
- `DELETE /api/agents/:id` → delete agent and all its commands (admin only).
- `GET /api/agents/:id/commands` → all commands sent to that agent.
- `DELETE /api/agents/:id/commands` → clear command history for that agent.
- `POST /api/command` → body: `{ agent_id, command }` — sends a command to an agent.
- `GET /api/commands` → all commands across all agents.
- `GET /api/geoip/agents` → all agents with GeoIP data (lat/lon, country, city, ISP) + country/city stats.

## WebSocket Message Types
- `register` → agent → server: initial registration (hostname, os, username, ip).
- `registered` → server → agent: registration confirmation (agentId).
- `heartbeat` → agent → server: liveness signal (agentId).
- `command` → server → agent: command to execute (commandId, command).
- `result` → agent → server: command output (commandId, output, error?).

## File Structure
- `server/src/index.ts` → Hono REST API + Bun.serve WebSocket, all routing lives here.
- `server/src/store.ts` → in-memory `Map`-based data store (agents, commands, connections).
- `shared/src/index.ts` → Agent, Command, WSMessage, RegisterData, CommandData, ResultData types.
- `client-go/main.go` → Go agent: WebSocket, system info, heartbeat, command exec, file manager, screen streaming.
- `client-go/installer.go` → Go agent daemon installer (systemd + Windows Scheduled Task).
- `client-go/keylogger.go` → platform-agnostic keylogger logic (buffer, flush, key mapping).
## Screen Capture
- Linux: ffmpeg (x11grab) is the primary capture method. Agent auto-installs ffmpeg via `sudo apt install -y ffmpeg` if not present.
- Fallback chain: ffmpeg → gnome-dbus → gnome-screenshot → grim → scrot → import (ImageMagick).
- Windows: PowerShell CopyFromScreen (unchanged).
- ffmpeg captures single JPEG frames: `ffmpeg -f x11grab -video_size WxH -i :0 -frames:v 1 -q:v N output.jpg`.
- Display and resolution auto-detected via xdpyinfo/xrandr, defaults to :0 / 1920x1080.
- Test capture verifies file > 1KB to avoid silent black-screen failures.
- `client-go/keylogger_windows.go` → Windows keylogger (GetAsyncKeyState + user32.dll).
- `client-go/keylogger_linux.go` → Linux keylogger (/dev/input/event* reader).
- `client-go/pty_handler.go` → Linux PTY handler (creack/pty, spawn shell, stream I/O).
- `client-go/pty_handler_windows.go` → Windows PTY fallback (piped cmd/powershell).
- `client-go/Makefile` → cross-compilation targets (linux, windows, arm64).
- `frontend/src/App.tsx` → React dashboard with routing (login, register, dashboard, admin).
- `frontend/src/api.ts` → `fetch` wrappers (fetchAgents, sendCommand, renameAgent, etc).
- `frontend/src/pages/DashboardPage.tsx` → main dashboard: agent grid, machine control panel, action log.
- `frontend/src/pages/AdminPage.tsx` → admin panel: user management + agent permissions.
- `frontend/src/pages/LoginPage.tsx` → login page.
- `frontend/src/pages/RegisterPage.tsx` → register page.
- `frontend/src/pages/MapPage.tsx` → geographic map view with Leaflet.js (agent locations on world map).
- `frontend/src/store.ts` → Zustand auth state store.

## Frontend CSS Structure
- CSS is split into separate files under `frontend/src/styles/`:
  - `base.css` → reset, CSS variables, shell layout, scrollbar, shared utilities.
  - `header.css` → top header bar, stats, user section, logout button.
  - `sidebar.css` → sidebar agent list (legacy layout).
  - `terminal.css` → terminal UI, command blocks, input bar, empty states.
  - `machine-control.css` → machine info card, action buttons, custom command, action log, back nav, rename UI.
  - `dashboard.css` → dashboard home grid, stat cards, agent cards, search, rename UI.
  - `auth.css` → login/register pages, form fields, buttons.
  - `admin.css` → admin panel, user table, role badges, permission chips.
  - `map.css` → geographic map view, Leaflet overrides, agent markers, sidebar, country badges.
- Main entry: `frontend/src/style.css` imports all split files (or used to be monolithic — now split).

## Agent Alias (Rename)
- Agents can be given a custom alias/nickname for easier identification.
- `Agent` interface has optional `alias?: string` field.
- `PATCH /api/agents/:id` with `{ alias: "My PC" }` sets the alias; empty string clears it.
- Alias persists across agent reconnects (server preserves it in `handleRegister`).
- Dashboard shows alias instead of hostname when set; original hostname shown as subtitle.
- Rename UI: pencil icon on hover (both agent card and machine detail view), inline edit with confirm/cancel.
- Search also matches against alias.

## GeoIP Map View
- Interactive world map showing agent locations on a dark CartoDB basemap (Leaflet.js + react-leaflet).
- Agent public IP detection: Go agent calls `api.ipify.org` / `ifconfig.me` / `icanhazip.com` to get public IP.
- Server fallback: if agent sends a private IP, server uses the WebSocket remote address instead.
- GeoIP lookup via `ip-api.com` (free, no API key, batch support up to 100 IPs, cached in-memory).
- `GET /api/geoip/agents` → returns all agents with geo data (country, city, lat/lon, ISP) + country/city stats.
- Map features: pulsing online markers, connection line animations, fly-to on selection, country highlight on hover.
- Sidebar: country list with expand/collapse (shows agents per country), agent list with location info.
- Country code badges (styled `<span>`) instead of emoji flags for cross-platform consistency.
- Route: `/map` (protected, accessible via globe icon in dashboard header).
- Files: `server/src/geoip.ts`, `frontend/src/pages/MapPage.tsx`, `frontend/src/components/map/` (WorldMap, MapSidebar, MapLegend), `frontend/src/styles/map.css`.

## Agent Groups (Gruplar)
- Agents can be assigned to groups/tags like "Lab-1", "Sunucular", "Masaüstü".
- `Agent` interface has optional `group?: string` field.
- `PATCH /api/agents/:id` with `{ group: "Lab-1" }` sets the group; empty string clears it.
- `GET /api/groups` → list all unique group names currently in use.
- `POST /api/groups/broadcast` → body: `{ group, command }` — sends command to all online agents in the group.
- Group persists across agent reconnects (server preserves it in `handleRegister`).
- Dashboard shows group filter bar at top when groups exist (chip-based filter).
- Agent cards show group badge; click to edit, hover shows "Grup" add button for ungrouped agents.
- MachineInfo detail view shows group with inline edit.
- Broadcast panel: select group, type command, see per-agent results.
- DB migration: `server/scripts/add-agent-groups.sql` adds `group` column to agents table.
- Permission-aware: normal users can only broadcast to agents they have permission for.

## Cross-Platform
- Agent auto-detects the OS: uses `cmd /c` on Windows, `sh -c` on Linux/Pardus.
- System info comes from the `os` module: hostname, username, platform, release, arch, IPv4 address.

## Tests
- `server/src/index.test.ts` → 15 tests: REST API (health, agents, commands, 404, 400) + WebSocket (register, heartbeat, offline, send/receive commands, errors, multi-command).
- Tests run with `bun test`; they start the server as a subprocess and kill it when done.

## Running
- `cd server && bun install && bun run dev` → starts the server.
- `cd frontend && bun install && bun run dev` → opens the dashboard at localhost:5173 (API proxy enabled).
- `cd frontend && bun run build` → production build; server auto-serves `frontend/dist/`.
- `cd client-go && go build -ldflags="-s -w" -o pardus-agent .` → builds the Go agent (~5.5MB binary).
- `./pardus-agent` → starts the agent (defaults to ws://localhost:4444/ws/agent).
- `./pardus-agent --server ws://IP:4444/ws/agent` → connect to a remote server.
- `C2_SERVER=ws://IP:4444/ws/agent ./pardus-agent` → alternative env-based connection.
- `sudo ./pardus-agent install --server ws://IP:4444/ws/agent` → install as systemd service (Linux) or Scheduled Task (Windows).
- `cd server && bun test` → server tests.

### Go Agent Cross-Compilation
- `cd client-go && make linux` → Linux AMD64 binary (for Pardus).
- `cd client-go && make windows` → Windows AMD64 binary.
- `cd client-go && make all` → all platforms.

## Pardus Note
- Pardus is Debian-based; install Bun with `curl -fsSL https://bun.sh/install | bash`.
- Agent uses `sh -c` on Linux, no extra dependencies needed.

## CVE Database
- PostgreSQL database `kovan` stores CVE data from NVD JSON files.
- Schema: `cves` (main CVE info) + `cve_affected` (affected products/versions).
- `pg_trgm` extension enables fuzzy product name search.
- Import script: `cd server && pnpm run db:import` — imports cves/2025 + cves/2026 (~47K CVEs in ~32s).
- DB init: `cd server && pnpm run db:init` — creates tables and indexes.

## CVE API Endpoints
- `GET /api/cves/stats` → total CVE count, severity distribution.
- `GET /api/cves/search?q=openssl&limit=20` → search by product/vendor name.
- `GET /api/cves/:id` → single CVE detail with affected products.
- `POST /api/cves/scan` → body: `{ packages: "dpkg -l output" }` or `{ packages: [{name, version}] }` — matches installed packages against CVE database, returns vulnerability report with severity summary.

## CVE File Structure
- `server/scripts/init-db.sql` → PostgreSQL schema (cves + cve_affected tables, indexes).
- `server/scripts/import-cves.ts` → batch import script, reads JSON files from cves/ folder.
- `server/src/db.ts` → PostgreSQL connection pool.
- `server/src/cve-routes.ts` → Hono routes for CVE search, detail, scan.

## Authentication (Better Auth)
- Uses `better-auth` library for email/password authentication with admin plugin.
- Server: `server/src/auth.ts` configures betterAuth with PostgreSQL, email/password, and admin plugin.
- Frontend: `frontend/src/auth-client.ts` creates React auth client with admin client plugin.
- Auth routes mounted at `/api/auth/*` on the Hono server.
- All `/api/agents`, `/api/command`, `/api/commands` routes are protected — require valid session.
- `/api/health` and `/api/cves/*` are unprotected.
- Admin credentials: `admin@admin.com` / `admin123`.
- DB tables: `user`, `session`, `account`, `verification`, `user_agent_permissions` in `kovan` database.
- Setup: `cd server && psql -U postgres -d kovan -f scripts/init-auth.sql && psql -U postgres -d kovan -f scripts/init-permissions.sql && pnpm run db:seed`.

## Agent Permissions
- Normal users see **no agents** by default. Admin must grant access per agent.
- Admin sees **all agents** automatically — no permission check needed.
- `user_agent_permissions` table maps `(user_id, agent_id)` pairs.
- Permission API: `GET/POST/DELETE /api/permissions` (admin only).
- `GET /api/permissions/user/:userId` → list permitted agent IDs for a user.
- `POST /api/permissions` → body: `{ userId, agentId }` — grant access.
- `DELETE /api/permissions` → body: `{ userId, agentId }` — revoke access.
- Agent list, agent detail, commands, and command execution all check permissions.
- Agent deletion is admin-only.

## Frontend Routing (React Router + Zustand)
- `/login` → Login page (guest only).
- `/register` → Register page (guest only).
- `/` → Dashboard — agent list + terminal (authenticated).
- `/admin` → Admin panel — user management + agent permissions (admin only).
- Zustand store (`frontend/src/store.ts`) manages auth state (user, isAdmin, loading).
- Pages: `frontend/src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `DashboardPage.tsx`, `AdminPage.tsx`.

## Scheduled Tasks / Zamanlanmış Görevler
- Cron-like otomatik komut çalıştırma sistemi. Belirli aralıklarla agent'lara veya gruplara komut gönderir.
- PostgreSQL'de kalıcı depolama (`scheduled_tasks` + `task_runs` tabloları).
- Scheduler engine: 30 saniyelik döngüde `next_run_at <= NOW()` olan görevleri çalıştırır.
- Cron expression (`0 3 * * *`) veya interval (saniye cinsinden) desteği.
- Tekil agent veya grup bazlı hedefleme.
- Agent çevrimdışıysa görev "skipped" olarak kaydedilir.
- DB setup: `psql -U postgres -d kovan -f server/scripts/init-scheduler.sql`.

## Scheduled Tasks API Endpoints
- `GET /api/schedules` → tüm zamanlanmış görevler.
- `POST /api/schedules` → yeni görev oluştur (name, command, cronExpr/intervalSeconds, targetType, targetId).
- `GET /api/schedules/:id` → tek görev detayı.
- `PUT /api/schedules/:id` → görev güncelle.
- `DELETE /api/schedules/:id` → görev sil.
- `PATCH /api/schedules/:id/toggle` → aktif/pasif değiştir.
- `GET /api/schedules/:id/runs` → çalışma geçmişi.
- `POST /api/schedules/:id/run-now` → manuel tetikle.

## Scheduled Tasks File Structure
- `server/scripts/init-scheduler.sql` → PostgreSQL schema (scheduled_tasks + task_runs).
- `server/src/scheduler.ts` → Scheduler engine (tick loop, cron parsing, command dispatch).
- `server/src/schedule-routes.ts` → Hono REST routes for CRUD.
- `shared/src/index.ts` → ScheduledTask, TaskRun interfaces.
- `frontend/src/pages/SchedulesPage.tsx` → Dashboard UI (task list, create/edit modal, run history).
- `frontend/src/styles/schedules.css` → Scheduled tasks styling.

## Scheduled Tasks Frontend
- `/schedules` route — accessible from dashboard header (clock icon).
- Task list table: name, command, target, schedule, last/next run, toggle, actions.
- Create/Edit modal: cron presets (her 5dk, her saat, her gün 03:00, vb.) veya dakika interval.
- Agent veya grup seçici dropdown.
- Run history: expandable per task, shows status (completed/running/error/skipped), agent, timestamp.
- Manual "Şimdi Çalıştır" butonu.

## ATTDAP Anomaly Detection Module
- Standalone Python (FastAPI) service under `anomaly-model/` for ML-based network traffic anomaly detection.
- 3-model ensemble: Isolation Forest + Denoising Autoencoder (PyTorch) + GMM.
- Trained on CICIDS2017 + UNSW-NB15 datasets (26 shared network flow features).
- Performance: F1=0.7995, AUC-ROC=0.9088, Precision=0.8836, Recall=0.7300.
- Hybrid scoring: weighted ensemble (IF 0.10 + GMM 0.90) → 0-100 risk score.
- Risk levels: low (<79), medium (<50), high (<75), critical (≥75).

## ATTDAP API Endpoints
- `GET /health` → service health + model status.
- `POST /score` → score single network flow event → hybrid_score, risk_level, per-model scores.
- `POST /batch-score` → score up to 10000 events per request → scores + summary stats.
- `GET /model-info` → model config, training metrics, feature list.

## ATTDAP File Structure
- `anomaly-model/attdap.py` → single-file integration interface (AnomalyDetector class).
- `anomaly-model/config/settings.py` → all configuration (paths, model params, thresholds, env vars).
- `anomaly-model/api/main.py` → FastAPI app with lifespan model loading.
- `anomaly-model/api/schemas.py` → Pydantic request/response models.
- `anomaly-model/api/routes/` → score, batch_score, health, model_info endpoints.
- `anomaly-model/data/download_datasets.py` → dataset downloader (UNB, HuggingFace, Kaggle, synthetic fallback).
- `anomaly-model/models/` → model wrappers (isolation_forest, autoencoder, gmm_model, hybrid_scorer).
- `anomaly-model/pipeline/` → training pipeline (data_loader, feature_engineer, train, evaluate).
- `anomaly-model/db/` → TimescaleDB schema and queries (optional).

## ATTDAP Running
- `cd anomaly-model && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` → setup.
- `python -m data.download_datasets` → download CICIDS2017 + UNSW-NB15 datasets.
- `python -m pipeline.train` → train models (saves to `models/saved/`).
- `uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload` → start anomaly API.
- Python import: `from attdap import AnomalyDetector; detector = AnomalyDetector(); detector.score({...})`.

## Keylogger
- Go agent captures keystrokes and sends them to the server in batches (every 2 seconds).
- **Windows**: Uses `GetAsyncKeyState` from `user32.dll` (polling at ~100 Hz). No extra dependencies.
- **Linux**: Reads from `/dev/input/event*` devices (requires root or `input` group membership).
- Active window title is captured alongside keystrokes (Windows: `GetWindowTextW`, Linux: `xdotool`).
- Server stores up to 5000 key events per agent in memory.
- Dashboard shows keystrokes grouped by active window with timestamps.
- Start/stop via REST API or dashboard drawer UI.

### Keylogger API
- `POST /api/agents/:id/keylog/start` → start keylogging on agent.
- `POST /api/agents/:id/keylog/stop` → stop keylogging on agent.
- `GET /api/agents/:id/keylog?limit=N&since=TS` → get key events.
- `GET /api/agents/:id/keylog/status` → check if keylogger is active + event count.
- `DELETE /api/agents/:id/keylog` → clear stored key events.

### Keylogger WebSocket Messages
- `keylog_start` → server → agent: start capturing keystrokes.
- `keylog_stop` → server → agent: stop capturing.
- `keylog_started` → agent → server: confirmation.
- `keylog_stopped` → agent → server: confirmation.
- `keylog_data` → agent → server: batch of key events `{ events: [{ key, ts, window }] }`.
- `keylog_error` → agent → server: error message.

### Keylogger Files
- `client-go/keylogger.go` → platform-agnostic keylogger logic (buffer, flush, start/stop).
- `client-go/keylogger_windows.go` → Windows implementation (GetAsyncKeyState polling).
- `client-go/keylogger_linux.go` → Linux implementation (/dev/input/event* reader).
- `frontend/src/styles/keylogger.css` → keylogger drawer UI styles.

## Interactive Terminal (PTY)
- Real-time interactive shell access via xterm.js + WebSocket, works like SSH.
- Go agent spawns a PTY (pseudo-terminal) on `pty_start` message.
- **Linux**: Uses `github.com/creack/pty` for full PTY support (colors, tab completion, `cd`, etc.).
- **Windows**: Fallback to piped cmd.exe/powershell (no PTY resize, but functional).
- Dashboard connects via `/ws/terminal?agentId=X` WebSocket for I/O relay.
- Server relays `pty_input` from viewer → agent, `pty_output` from agent → viewer(s).
- Supports terminal resize (`pty_resize`) — xterm.js FitAddon auto-fits to drawer size.
- Shell auto-detects: `$SHELL` or `/bin/bash` on Linux, `powershell.exe` or `cmd.exe` on Windows.
- Terminal session cleanup on agent disconnect, drawer close, or explicit stop.

### Interactive Terminal API
- `POST /api/agents/:id/terminal/start` → body: `{ rows?, cols? }` — start PTY session.
- `POST /api/agents/:id/terminal/stop` → stop PTY session.
- `GET /api/agents/:id/terminal/status` → check if terminal is active + viewer count.

### Interactive Terminal WebSocket Messages
- `pty_start` → server → agent: spawn PTY shell with optional rows/cols.
- `pty_stop` → server → agent: kill PTY process.
- `pty_input` → viewer → server → agent: send keystrokes to PTY stdin.
- `pty_output` → agent → server → viewer: PTY stdout data.
- `pty_resize` → viewer → server → agent: resize PTY window (rows/cols).
- `pty_started` → agent → server → viewer: PTY is ready (shell name, size).
- `pty_stopped` → agent → server → viewer: PTY session ended.
- `pty_exit` → agent → server → viewer: shell process exited (reason, exit code).
- `pty_error` → agent → server → viewer: error message.

### Interactive Terminal Files
- `client-go/pty_handler.go` → Linux PTY implementation (creack/pty).
- `client-go/pty_handler_windows.go` → Windows fallback (piped I/O).
- `frontend/src/components/dashboard/TerminalDrawerContent.tsx` → xterm.js terminal UI.
- `frontend/src/styles/interactive-terminal.css` → terminal drawer styles.

## Limitations
- Agent/command data is in-memory only, resets when the server stops.
- CVE data persists in PostgreSQL.
- No encryption or auth — this is a demo.
- Single port (4444) serves the API, WebSocket, and frontend together.
