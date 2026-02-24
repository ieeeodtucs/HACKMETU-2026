-- Agent grupları için migration
-- Kullanım: psql -U postgres -d pardus_c2 -f server/scripts/add-agent-groups.sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS "group" VARCHAR(100) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_agents_group ON agents ("group");
