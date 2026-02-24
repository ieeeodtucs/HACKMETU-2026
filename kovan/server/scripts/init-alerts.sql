-- ===== Alert / Bildirim Sistemi =====

-- Kullanıcı bazlı Telegram ayarları
CREATE TABLE IF NOT EXISTS alert_settings (
  user_id TEXT PRIMARY KEY,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent bazlı alarm kuralları
CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,  -- 'cpu', 'ram', 'disk', 'offline', 'cve_critical'
  threshold REAL DEFAULT 90,  -- yüzde veya sayı (offline/cve için kullanılmaz)
  cooldown_minutes INTEGER DEFAULT 15,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, agent_id, rule_type)
);

-- Alarm kayıtları
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',  -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  detail TEXT,
  is_read BOOLEAN DEFAULT false,
  sent_telegram BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_unread ON alerts(user_id, is_read) WHERE NOT is_read;
CREATE INDEX IF NOT EXISTS idx_alerts_user_created ON alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_agent ON alerts(agent_id, rule_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_rules_user ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_agent ON alert_rules(agent_id);
