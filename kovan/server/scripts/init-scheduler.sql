-- Zamanlanmış Görevler (Scheduled Tasks)
-- Kullanım: psql -U postgres -d kovan -f scripts/init-scheduler.sql

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  cron_expr TEXT,                     -- "0 3 * * *" (null if interval-based)
  interval_seconds INTEGER,          -- 3600 (null if cron-based)
  target_type TEXT NOT NULL CHECK (target_type IN ('agent', 'group')),
  target_id TEXT NOT NULL,           -- agent ID or group name
  enabled BOOLEAN DEFAULT true,
  created_by TEXT,                   -- user ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  CONSTRAINT check_schedule CHECK (
    cron_expr IS NOT NULL OR interval_seconds IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'error', 'skipped')),
  target_agent_id TEXT,
  command_id TEXT,
  output TEXT,
  error TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_enabled ON scheduled_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_task_runs_task_id ON task_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_started_at ON task_runs(started_at DESC);
