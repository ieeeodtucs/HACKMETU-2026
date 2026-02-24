/**
 * Schedule Routes — zamanlanmış görev CRUD API
 */
import { Hono } from "hono";
import {
  getAllTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  toggleTask,
  getTaskRuns,
  runTaskNow,
} from "./scheduler.js";

export const scheduleRoutes = new Hono();

// GET /api/schedules — tüm görevler
scheduleRoutes.get("/", async (c) => {
  try {
    const tasks = await getAllTasks();
    return c.json({ success: true, tasks });
  } catch (err: any) {
    console.error("[Schedules] GET / error:", err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/schedules — yeni görev oluştur
scheduleRoutes.post("/", async (c) => {
  try {
    const user = c.get("user" as never) as any;
    const body = await c.req.json();

    if (!body.name || !body.command || !body.targetType || !body.targetId) {
      return c.json({ success: false, error: "name, command, targetType, targetId gerekli" }, 400);
    }
    if (!body.cronExpr && !body.intervalSeconds) {
      return c.json({ success: false, error: "cronExpr veya intervalSeconds gerekli" }, 400);
    }
    if (body.targetType !== "agent" && body.targetType !== "group") {
      return c.json({ success: false, error: "targetType 'agent' veya 'group' olmalı" }, 400);
    }

    const task = await createTask({
      name: body.name,
      command: body.command,
      cronExpr: body.cronExpr || undefined,
      intervalSeconds: body.intervalSeconds ? Number(body.intervalSeconds) : undefined,
      targetType: body.targetType,
      targetId: body.targetId,
      enabled: body.enabled ?? true,
      createdBy: user?.id,
    });

    return c.json({ success: true, task }, 201);
  } catch (err: any) {
    console.error("[Schedules] POST / error:", err.message);
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/schedules/:id — tek görev detayı
scheduleRoutes.get("/:id", async (c) => {
  try {
    const task = await getTask(c.req.param("id"));
    if (!task) return c.json({ success: false, error: "Görev bulunamadı" }, 404);
    return c.json({ success: true, task });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PUT /api/schedules/:id — görev güncelle
scheduleRoutes.put("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const task = await updateTask(c.req.param("id"), body);
    if (!task) return c.json({ success: false, error: "Görev bulunamadı" }, 404);
    return c.json({ success: true, task });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/schedules/:id — görev sil
scheduleRoutes.delete("/:id", async (c) => {
  try {
    const ok = await deleteTask(c.req.param("id"));
    if (!ok) return c.json({ success: false, error: "Görev bulunamadı" }, 404);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /api/schedules/:id/toggle — aktif/pasif
scheduleRoutes.patch("/:id/toggle", async (c) => {
  try {
    const task = await toggleTask(c.req.param("id"));
    if (!task) return c.json({ success: false, error: "Görev bulunamadı" }, 404);
    return c.json({ success: true, task });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/schedules/:id/runs — çalışma geçmişi
scheduleRoutes.get("/:id/runs", async (c) => {
  try {
    const limit = Number(c.req.query("limit")) || 50;
    const runs = await getTaskRuns(c.req.param("id"), limit);
    return c.json({ success: true, runs });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/schedules/:id/run-now — manuel tetikle
scheduleRoutes.post("/:id/run-now", async (c) => {
  try {
    const result = await runTaskNow(c.req.param("id"));
    if (!result.success) return c.json(result, 404);
    return c.json(result);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
