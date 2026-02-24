/**
 * Agent DB helpers — PostgreSQL'de kalıcı agent kayıtları
 */
import { pool } from "./db";
import type { Agent } from "@kovan/shared";

/** DB'den tüm agentları yükle */
export async function loadAgentsFromDB(): Promise<Agent[]> {
  const { rows } = await pool.query(`
    SELECT id, hostname, alias, "group", os, ip, username,
           machine_id, mac, cpu_model, total_mem_mb, fingerprint,
           first_seen, last_seen, is_online
    FROM agents
  `);

  return rows.map((r) => ({
    id: r.id,
    hostname: r.hostname,
    alias: r.alias || undefined,
    group: r.group || undefined,
    os: r.os,
    ip: r.ip,
    username: r.username,
    machineId: r.machine_id,
    mac: r.mac,
    cpuModel: r.cpu_model,
    totalMemMB: r.total_mem_mb,
    fingerprint: r.fingerprint,
    firstSeen: r.first_seen?.toISOString() || new Date().toISOString(),
    lastSeen: r.last_seen?.toISOString() || new Date().toISOString(),
    isOnline: false, // server yeni başladı, hepsi offline
  }));
}

/** Fingerprint ile agent ID bul (DB'den) */
export async function findAgentByFingerprint(fingerprint: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT id FROM agents WHERE fingerprint = $1 LIMIT 1`,
    [fingerprint]
  );
  return rows.length > 0 ? rows[0].id : null;
}

/** MachineId ile agent ID bul */
export async function findAgentByMachineId(machineId: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT id FROM agents WHERE machine_id = $1 LIMIT 1`,
    [machineId]
  );
  return rows.length > 0 ? rows[0].id : null;
}

/** MAC adresi ile agent ID bul */
export async function findAgentByMac(mac: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT id FROM agents WHERE mac = $1 LIMIT 1`,
    [mac]
  );
  return rows.length > 0 ? rows[0].id : null;
}

/** Agent'ı DB'ye kaydet veya güncelle (upsert) */
export async function upsertAgent(agent: Agent): Promise<void> {
  await pool.query(`
    INSERT INTO agents (id, hostname, alias, "group", os, ip, username, machine_id, mac, cpu_model, total_mem_mb, fingerprint, first_seen, last_seen, is_online)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (id) DO UPDATE SET
      hostname = EXCLUDED.hostname,
      alias = COALESCE(agents.alias, EXCLUDED.alias),
      "group" = COALESCE(agents."group", EXCLUDED."group"),
      os = EXCLUDED.os,
      ip = EXCLUDED.ip,
      username = EXCLUDED.username,
      machine_id = EXCLUDED.machine_id,
      mac = EXCLUDED.mac,
      cpu_model = EXCLUDED.cpu_model,
      total_mem_mb = EXCLUDED.total_mem_mb,
      fingerprint = EXCLUDED.fingerprint,
      last_seen = EXCLUDED.last_seen,
      is_online = EXCLUDED.is_online
  `, [
    agent.id,
    agent.hostname,
    agent.alias || null,
    agent.group || null,
    agent.os,
    agent.ip,
    agent.username,
    agent.machineId || "unknown",
    agent.mac || "unknown",
    agent.cpuModel || "unknown",
    agent.totalMemMB || 0,
    agent.fingerprint || "unknown",
    agent.firstSeen,
    agent.lastSeen,
    agent.isOnline,
  ]);
}

/** Agent'ın lastSeen ve isOnline'ını güncelle */
export async function updateAgentStatus(id: string, isOnline: boolean): Promise<void> {
  await pool.query(
    `UPDATE agents SET last_seen = NOW(), is_online = $2 WHERE id = $1`,
    [id, isOnline]
  );
}

/** Agent alias güncelle */
export async function updateAgentAlias(id: string, alias: string | null): Promise<void> {
  await pool.query(
    `UPDATE agents SET alias = $1 WHERE id = $2`,
    [alias, id]
  );
}

/** Agent grup güncelle */
export async function updateAgentGroup(id: string, group: string | null): Promise<void> {
  await pool.query(
    `UPDATE agents SET "group" = $1 WHERE id = $2`,
    [group, id]
  );
}

/** Agent'ı DB'den sil */
export async function deleteAgentFromDB(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM agents WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
