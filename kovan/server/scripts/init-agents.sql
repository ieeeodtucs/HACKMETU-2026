-- Agents tablosu — kalıcı agent kayıtları
CREATE TABLE IF NOT EXISTS agents (
  id           TEXT PRIMARY KEY,           -- 8 karakter UUID
  hostname     TEXT NOT NULL DEFAULT '',
  alias        TEXT,                        -- kullanıcı tanımlı takma ad
  os           TEXT NOT NULL DEFAULT '',
  ip           TEXT NOT NULL DEFAULT '',
  username     TEXT NOT NULL DEFAULT '',
  machine_id   TEXT NOT NULL DEFAULT 'unknown',
  mac          TEXT NOT NULL DEFAULT 'unknown',
  cpu_model    TEXT NOT NULL DEFAULT 'unknown',
  total_mem_mb INTEGER NOT NULL DEFAULT 0,
  fingerprint  TEXT NOT NULL DEFAULT 'unknown',
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_online    BOOLEAN NOT NULL DEFAULT false
);

-- Fingerprint ile hızlı arama
CREATE INDEX IF NOT EXISTS idx_agents_fingerprint ON agents(fingerprint);
CREATE INDEX IF NOT EXISTS idx_agents_machine_id ON agents(machine_id);
CREATE INDEX IF NOT EXISTS idx_agents_mac ON agents(mac);
