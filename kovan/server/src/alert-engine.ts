/**
 * Alert Engine — metrik eşik kontrolü, çevrimdışı tespiti, CVE uyarısı
 * Cooldown mantığıyla spam'i engeller, Telegram bildirimi gönderir
 */
import { pool } from "./db.js";
import type { SystemMetrics } from "@kovan/shared";

// ===== Types =====
export interface AlertRule {
  id: number;
  user_id: string;
  agent_id: string;
  rule_type: string;
  threshold: number;
  cooldown_minutes: number;
  enabled: boolean;
}

export interface AlertRecord {
  id: number;
  user_id: string;
  agent_id: string;
  rule_type: string;
  severity: string;
  message: string;
  detail: string | null;
  is_read: boolean;
  sent_telegram: boolean;
  created_at: string;
}

export interface AlertSettings {
  user_id: string;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  enabled: boolean;
}

// In-memory cooldown tracker: "userId:agentId:ruleType" -> last alert timestamp
const cooldownMap = new Map<string, number>();

function cooldownKey(userId: string, agentId: string, ruleType: string): string {
  return `${userId}:${agentId}:${ruleType}`;
}

function isInCooldown(userId: string, agentId: string, ruleType: string, cooldownMinutes: number): boolean {
  const key = cooldownKey(userId, agentId, ruleType);
  const lastAlert = cooldownMap.get(key);
  if (!lastAlert) return false;
  const elapsed = (Date.now() - lastAlert) / 60000; // ms → minutes
  return elapsed < cooldownMinutes;
}

function setCooldown(userId: string, agentId: string, ruleType: string) {
  cooldownMap.set(cooldownKey(userId, agentId, ruleType), Date.now());
}

// ===== Telegram =====
async function sendTelegram(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json() as any;
    if (!data.ok) {
      console.error("[TELEGRAM] Gönderim hatası:", data.description);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[TELEGRAM] Bağlantı hatası:", err);
    return false;
  }
}

export async function testTelegram(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🐝 <b>Kovan Test</b>\nTelegram bildirimleri başarıyla yapılandırıldı!",
        parse_mode: "HTML",
      }),
    });
    const data = await res.json() as any;
    if (!data.ok) return { success: false, error: data.description };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ===== Create Alert =====
async function createAlert(
  userId: string,
  agentId: string,
  ruleType: string,
  severity: string,
  message: string,
  detail?: string,
): Promise<AlertRecord | null> {
  try {
    const res = await pool.query(
      `INSERT INTO alerts (user_id, agent_id, rule_type, severity, message, detail)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, agentId, ruleType, severity, message, detail || null],
    );
    return res.rows[0];
  } catch (err) {
    console.error("[ALERT] DB insert hatası:", err);
    return null;
  }
}

// ===== Try send Telegram for alert =====
async function trySendTelegramAlert(userId: string, alert: AlertRecord) {
  try {
    const settingsRes = await pool.query(
      "SELECT * FROM alert_settings WHERE user_id = $1",
      [userId],
    );
    const settings = settingsRes.rows[0] as AlertSettings | undefined;
    if (!settings?.enabled || !settings.telegram_bot_token || !settings.telegram_chat_id) return;

    const severityEmoji = alert.severity === "critical" ? "🔴" : alert.severity === "warning" ? "🟡" : "🔵";
    const msg = `${severityEmoji} <b>Kovan Alarm</b>\n\n${alert.message}${alert.detail ? "\n\n<i>" + alert.detail + "</i>" : ""}`;

    const sent = await sendTelegram(settings.telegram_bot_token, settings.telegram_chat_id, msg);
    if (sent) {
      await pool.query("UPDATE alerts SET sent_telegram = true WHERE id = $1", [alert.id]);
    }
  } catch (err) {
    console.error("[ALERT] Telegram gönderim hatası:", err);
  }
}

// ===== Get rules for an agent (all users) =====
async function getRulesForAgent(agentId: string): Promise<AlertRule[]> {
  try {
    const res = await pool.query(
      "SELECT * FROM alert_rules WHERE agent_id = $1 AND enabled = true",
      [agentId],
    );
    return res.rows;
  } catch {
    return [];
  }
}

// ===== Fire alert if not in cooldown =====
async function fireAlert(
  rule: AlertRule,
  severity: string,
  message: string,
  detail?: string,
) {
  if (isInCooldown(rule.user_id, rule.agent_id, rule.rule_type, rule.cooldown_minutes)) {
    return; // Spam koruması
  }

  const alert = await createAlert(rule.user_id, rule.agent_id, rule.rule_type, severity, message, detail);
  if (alert) {
    setCooldown(rule.user_id, rule.agent_id, rule.rule_type);
    console.log(`[ALERT] ${severity.toUpperCase()}: ${message} (agent: ${rule.agent_id}, user: ${rule.user_id})`);
    // Async Telegram gönderimi
    trySendTelegramAlert(rule.user_id, alert).catch(() => {});
  }
}

// ===== Public API: Check metrics =====
export async function checkMetricsAlerts(
  agentId: string,
  metrics: SystemMetrics,
  agentHostname: string,
) {
  const rules = await getRulesForAgent(agentId);

  for (const rule of rules) {
    switch (rule.rule_type) {
      case "cpu":
        if (metrics.cpuPercent >= rule.threshold) {
          await fireAlert(
            rule,
            metrics.cpuPercent >= 95 ? "critical" : "warning",
            `⚡ <b>${agentHostname}</b> — CPU %${metrics.cpuPercent.toFixed(1)} (eşik: %${rule.threshold})`,
            `CPU kullanımı eşik değerini aştı.`,
          );
        }
        break;

      case "ram":
        if (metrics.memPercent >= rule.threshold) {
          await fireAlert(
            rule,
            metrics.memPercent >= 95 ? "critical" : "warning",
            `💾 <b>${agentHostname}</b> — RAM %${metrics.memPercent.toFixed(1)} (eşik: %${rule.threshold})`,
            `Bellek kullanımı: ${(metrics.memUsedMB / 1024).toFixed(1)} / ${(metrics.memTotalMB / 1024).toFixed(1)} GB`,
          );
        }
        break;

      case "disk":
        if (metrics.diskPercent >= rule.threshold) {
          await fireAlert(
            rule,
            metrics.diskPercent >= 95 ? "critical" : "warning",
            `💿 <b>${agentHostname}</b> — Disk %${metrics.diskPercent.toFixed(1)} (eşik: %${rule.threshold})`,
            `Disk kullanımı: ${metrics.diskUsedGB.toFixed(1)} / ${metrics.diskTotalGB.toFixed(1)} GB`,
          );
        }
        break;
    }
  }
}

// ===== Public API: Agent offline =====
export async function checkOfflineAlert(agentId: string, agentHostname: string) {
  const rules = await getRulesForAgent(agentId);
  for (const rule of rules) {
    if (rule.rule_type === "offline") {
      await fireAlert(
        rule,
        "critical",
        `🔌 <b>${agentHostname}</b> — Bağlantı koptu!`,
        `Agent çevrimdışı oldu.`,
      );
    }
  }
}

// ===== Public API: CVE alert =====
export async function checkCveAlert(
  agentId: string,
  agentHostname: string,
  criticalCount: number,
  highCount: number,
  totalCount: number,
) {
  if (criticalCount === 0 && highCount === 0) return;

  const rules = await getRulesForAgent(agentId);
  for (const rule of rules) {
    if (rule.rule_type === "cve_critical") {
      const severity = criticalCount > 0 ? "critical" : "warning";
      await fireAlert(
        rule,
        severity,
        `🛡 <b>${agentHostname}</b> — ${totalCount} zafiyet bulundu!`,
        `Kritik: ${criticalCount}, Yüksek: ${highCount}`,
      );
    }
  }
}

// ===== Settings CRUD =====
export async function getAlertSettings(userId: string): Promise<AlertSettings | null> {
  const res = await pool.query("SELECT * FROM alert_settings WHERE user_id = $1", [userId]);
  return res.rows[0] || null;
}

export async function upsertAlertSettings(
  userId: string,
  botToken: string | null,
  chatId: string | null,
  enabled: boolean = true,
): Promise<AlertSettings> {
  const res = await pool.query(
    `INSERT INTO alert_settings (user_id, telegram_bot_token, telegram_chat_id, enabled, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       telegram_bot_token = $2, telegram_chat_id = $3, enabled = $4, updated_at = NOW()
     RETURNING *`,
    [userId, botToken, chatId, enabled],
  );
  return res.rows[0];
}

// ===== Rules CRUD =====
export async function getAlertRules(userId: string): Promise<AlertRule[]> {
  const res = await pool.query(
    "SELECT * FROM alert_rules WHERE user_id = $1 ORDER BY agent_id, rule_type",
    [userId],
  );
  return res.rows;
}

export async function upsertAlertRule(
  userId: string,
  agentId: string,
  ruleType: string,
  threshold: number,
  cooldownMinutes: number,
  enabled: boolean,
): Promise<AlertRule> {
  const res = await pool.query(
    `INSERT INTO alert_rules (user_id, agent_id, rule_type, threshold, cooldown_minutes, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, agent_id, rule_type) DO UPDATE SET
       threshold = $4, cooldown_minutes = $5, enabled = $6, updated_at = NOW()
     RETURNING *`,
    [userId, agentId, ruleType, threshold, cooldownMinutes, enabled],
  );
  return res.rows[0];
}

export async function bulkUpsertRules(
  userId: string,
  agentId: string,
  rules: { rule_type: string; threshold: number; cooldown_minutes: number; enabled: boolean }[],
): Promise<AlertRule[]> {
  const results: AlertRule[] = [];
  for (const r of rules) {
    const rule = await upsertAlertRule(userId, agentId, r.rule_type, r.threshold, r.cooldown_minutes, r.enabled);
    results.push(rule);
  }
  return results;
}

// ===== Alerts Query =====
export async function getAlerts(
  userId: string,
  opts: { unread?: boolean; limit?: number; offset?: number } = {},
): Promise<{ alerts: AlertRecord[]; total: number; unreadCount: number }> {
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  let where = "WHERE user_id = $1";
  const params: any[] = [userId];
  if (opts.unread) {
    where += " AND is_read = false";
  }

  const countRes = await pool.query(`SELECT COUNT(*) FROM alerts ${where}`, params);
  const total = parseInt(countRes.rows[0].count);

  const unreadRes = await pool.query(
    "SELECT COUNT(*) FROM alerts WHERE user_id = $1 AND is_read = false",
    [userId],
  );
  const unreadCount = parseInt(unreadRes.rows[0].count);

  const alertsRes = await pool.query(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );

  return { alerts: alertsRes.rows, total, unreadCount };
}

export async function markAlertRead(alertId: number, userId: string): Promise<boolean> {
  const res = await pool.query(
    "UPDATE alerts SET is_read = true WHERE id = $1 AND user_id = $2",
    [alertId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markAllAlertsRead(userId: string): Promise<number> {
  const res = await pool.query(
    "UPDATE alerts SET is_read = true WHERE user_id = $1 AND is_read = false",
    [userId],
  );
  return res.rowCount ?? 0;
}
