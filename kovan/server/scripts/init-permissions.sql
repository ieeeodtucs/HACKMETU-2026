-- User-Agent permission mapping
-- Admin assigns which users can access which agents

CREATE TABLE IF NOT EXISTS user_agent_permissions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    granted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_uap_user ON user_agent_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_uap_agent ON user_agent_permissions(agent_id);
