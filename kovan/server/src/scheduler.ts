/**
 * Scheduler Engine — cron-like zamanlanmış görev yöneticisi
 * PostgreSQL'den görevleri yükler, 30 saniyelik döngüde kontrol eder, komut gönderir.
 */
import { pool } from "./db.js";
import { store } from "./store.js";
import { CronExpressionParser } from "cron-parser";
import { WebSocket } from "ws";
import type { Command, WSMessage, ScheduledTask, TaskRun } from "@kovan/shared";

const TICK_INTERVAL = 30_000; // 30 saniye
let tickTimer: ReturnType<typeof setInterval> | null = null;

// ===== DB Helpers =====

function rowToTask(row: any): ScheduledTask {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    cronExpr: row.cron_expr || undefined,
    intervalSeconds: row.interval_seconds || undefined,
    targetType: row.target_type,
    targetId: row.target_id,
    enabled: row.enabled,
    createdBy: row.created_by || undefined,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
    lastRunAt: row.last_run_at?.toISOString?.() || row.last_run_at || undefined,
    nextRunAt: row.next_run_at?.toISOString?.() || row.next_run_at || undefined,
    runCount: row.run_count || 0,
  };
}

function rowToRun(row: any): TaskRun {
  return {
    id: row.id,
    taskId: row.task_id,
    startedAt: row.started_at?.toISOString?.() || row.started_at,
    completedAt: row.completed_at?.toISOString?.() || row.completed_at || undefined,
    status: row.status,
    targetAgentId: row.target_agent_id || undefined,
    commandId: row.command_id || undefined,
    output: row.output || undefined,
    error: row.error || undefined,
  };
}

// ===== Next Run Calculation =====

export function calculateNextRun(task: { cronExpr?: string; intervalSeconds?: number; lastRunAt?: string }): Date | null {
  if (task.cronExpr) {
    try {
      const expr = CronExpressionParser.parse(task.cronExpr);
      return expr.next().toDate();
    } catch {
      return null;
    }
  }
  if (task.intervalSeconds) {
    const base = task.lastRunAt ? new Date(task.lastRunAt) : new Date();
    return new Date(base.getTime() + task.intervalSeconds * 1000);
  }
  return null;
}

// ===== CRUD =====

export async function getAllTasks(): Promise<ScheduledTask[]> {
  const { rows } = await pool.query("SELECT * FROM scheduled_tasks ORDER BY created_at DESC");
  return rows.map(rowToTask);
}

export async function getTask(id: string): Promise<ScheduledTask | null> {
  const { rows } = await pool.query("SELECT * FROM scheduled_tasks WHERE id = $1", [id]);
  return rows.length ? rowToTask(rows[0]) : null;
}

export async function createTask(data: {
  name: string;
  command: string;
  cronExpr?: string;
  intervalSeconds?: number;
  targetType: "agent" | "group";
  targetId: string;
  enabled?: boolean;
  createdBy?: string;
}): Promise<ScheduledTask> {
  const id = crypto.randomUUID().slice(0, 8);
  const enabled = data.enabled ?? true;
  const nextRun = calculateNextRun({
    cronExpr: data.cronExpr,
    intervalSeconds: data.intervalSeconds,
  });

  const { rows } = await pool.query(
    `INSERT INTO scheduled_tasks (id, name, command, cron_expr, interval_seconds, target_type, target_id, enabled, created_by, next_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [id, data.name, data.command, data.cronExpr || null, data.intervalSeconds || null,
     data.targetType, data.targetId, enabled, data.createdBy || null, nextRun]
  );
  return rowToTask(rows[0]);
}

export async function updateTask(id: string, data: {
  name?: string;
  command?: string;
  cronExpr?: string | null;
  intervalSeconds?: number | null;
  targetType?: "agent" | "group";
  targetId?: string;
  enabled?: boolean;
}): Promise<ScheduledTask | null> {
  const existing = await getTask(id);
  if (!existing) return null;

  const name = data.name ?? existing.name;
  const command = data.command ?? existing.command;
  const cronExpr = data.cronExpr !== undefined ? data.cronExpr : existing.cronExpr;
  const intervalSeconds = data.intervalSeconds !== undefined ? data.intervalSeconds : existing.intervalSeconds;
  const targetType = data.targetType ?? existing.targetType;
  const targetId = data.targetId ?? existing.targetId;
  const enabled = data.enabled ?? existing.enabled;

  const nextRun = calculateNextRun({ cronExpr: cronExpr || undefined, intervalSeconds: intervalSeconds || undefined, lastRunAt: existing.lastRunAt });

  const { rows } = await pool.query(
    `UPDATE scheduled_tasks SET name=$1, command=$2, cron_expr=$3, interval_seconds=$4, 
     target_type=$5, target_id=$6, enabled=$7, next_run_at=$8, updated_at=NOW()
     WHERE id=$9 RETURNING *`,
    [name, command, cronExpr || null, intervalSeconds || null, targetType, targetId, enabled, nextRun, id]
  );
  return rows.length ? rowToTask(rows[0]) : null;
}

export async function deleteTask(id: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM scheduled_tasks WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

export async function toggleTask(id: string): Promise<ScheduledTask | null> {
  const task = await getTask(id);
  if (!task) return null;
  const newEnabled = !task.enabled;
  let nextRun: Date | null = null;
  if (newEnabled) {
    nextRun = calculateNextRun({ cronExpr: task.cronExpr, intervalSeconds: task.intervalSeconds, lastRunAt: task.lastRunAt });
  }
  const { rows } = await pool.query(
    "UPDATE scheduled_tasks SET enabled=$1, next_run_at=$2, updated_at=NOW() WHERE id=$3 RETURNING *",
    [newEnabled, nextRun, id]
  );
  return rows.length ? rowToTask(rows[0]) : null;
}

// ===== Task Runs =====

export async function getTaskRuns(taskId: string, limit = 50): Promise<TaskRun[]> {
  const { rows } = await pool.query(
    "SELECT * FROM task_runs WHERE task_id = $1 ORDER BY started_at DESC LIMIT $2",
    [taskId, limit]
  );
  return rows.map(rowToRun);
}

async function recordRun(taskId: string, agentId: string, commandId: string | null, status: string, output?: string, error?: string): Promise<void> {
  const id = crypto.randomUUID().slice(0, 8);
  await pool.query(
    `INSERT INTO task_runs (id, task_id, target_agent_id, command_id, status, completed_at, output, error)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
    [id, taskId, agentId, commandId, status, output || null, error || null]
  );
}

// ===== Command Dispatch =====

function sendCommandToAgent(agentId: string, command: string): { success: boolean; commandId?: string; error?: string } {
  const agent = store.getAgent(agentId);
  if (!agent) return { success: false, error: "Agent bulunamadı" };
  if (!agent.isOnline) return { success: false, error: "Agent çevrimdışı" };

  const conn = store.getConn(agentId);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    return { success: false, error: "Agent bağlantısı yok" };
  }

  const cmd: Command = {
    id: crypto.randomUUID().slice(0, 8),
    agentId,
    command,
    status: "pending",
    output: "",
    sentAt: new Date().toISOString(),
  };
  store.addCommand(cmd);

  const wsMsg: WSMessage = {
    type: "command",
    agentId,
    data: { commandId: cmd.id, command },
  };
  conn.send(JSON.stringify(wsMsg));
  cmd.status = "running";

  return { success: true, commandId: cmd.id };
}

async function dispatchTask(task: ScheduledTask): Promise<void> {
  console.log(`[Scheduler] Görev çalıştırılıyor: "${task.name}" (${task.id})`);

  if (task.targetType === "agent") {
    const result = sendCommandToAgent(task.targetId, task.command);
    if (result.success) {
      await recordRun(task.id, task.targetId, result.commandId!, "running");
    } else {
      await recordRun(task.id, task.targetId, null, "skipped", undefined, result.error);
    }
  } else if (task.targetType === "group") {
    const agents = store.getAgentsByGroup(task.targetId);
    if (agents.length === 0) {
      await recordRun(task.id, task.targetId, null, "skipped", undefined, "Grupta agent yok");
      return;
    }
    for (const agent of agents) {
      const result = sendCommandToAgent(agent.id, task.command);
      if (result.success) {
        await recordRun(task.id, agent.id, result.commandId!, "running");
      } else {
        await recordRun(task.id, agent.id, null, "skipped", undefined, result.error);
      }
    }
  }

  // Update task metadata
  await pool.query(
    "UPDATE scheduled_tasks SET last_run_at=NOW(), run_count=run_count+1, next_run_at=$1, updated_at=NOW() WHERE id=$2",
    [calculateNextRun({ cronExpr: task.cronExpr, intervalSeconds: task.intervalSeconds, lastRunAt: new Date().toISOString() }), task.id]
  );
}

// ===== Manual Run =====

export async function runTaskNow(id: string): Promise<{ success: boolean; error?: string }> {
  const task = await getTask(id);
  if (!task) return { success: false, error: "Görev bulunamadı" };
  await dispatchTask(task);
  return { success: true };
}

// ===== Tick Loop =====

async function tick(): Promise<void> {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM scheduled_tasks WHERE enabled = true AND next_run_at <= NOW()"
    );

    for (const row of rows) {
      const task = rowToTask(row);
      try {
        await dispatchTask(task);
      } catch (err: any) {
        console.error(`[Scheduler] Görev hatası (${task.id}):`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[Scheduler] Tick hatası:", err.message);
  }
}

// ===== Start / Stop =====

export function startScheduler(): void {
  if (tickTimer) return;
  console.log("[Scheduler] Zamanlayıcı başlatıldı (30s döngü)");
  tick(); // ilk çalıştırma
  tickTimer = setInterval(tick, TICK_INTERVAL);
}

export function stopScheduler(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
    console.log("[Scheduler] Zamanlayıcı durduruldu");
  }
}
