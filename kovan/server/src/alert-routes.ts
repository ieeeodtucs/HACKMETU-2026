/**
 * Alert / Settings API Routes
 */
import { Hono } from "hono";
import { auth } from "./auth.js";
import {
  getAlertSettings,
  upsertAlertSettings,
  getAlertRules,
  bulkUpsertRules,
  getAlerts,
  markAlertRead,
  markAllAlertsRead,
  testTelegram,
} from "./alert-engine.js";

const alertRoutes = new Hono();

// Auth middleware for all alert routes
alertRoutes.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ success: false, error: "Unauthorized" }, 401);
  c.set("user" as never, session.user as never);
  await next();
});

// ===== Settings =====

// GET /api/settings — kullanıcının telegram ayarları
alertRoutes.get("/settings", async (c) => {
  const user = c.get("user" as never) as any;
  const settings = await getAlertSettings(user.id);
  return c.json({
    success: true,
    settings: settings || {
      user_id: user.id,
      telegram_bot_token: null,
      telegram_chat_id: null,
      enabled: true,
    },
  });
});

// PUT /api/settings — telegram ayarlarını güncelle
alertRoutes.put("/settings", async (c) => {
  const user = c.get("user" as never) as any;
  const body = await c.req.json<{
    telegram_bot_token?: string | null;
    telegram_chat_id?: string | null;
    enabled?: boolean;
  }>();

  const settings = await upsertAlertSettings(
    user.id,
    body.telegram_bot_token ?? null,
    body.telegram_chat_id ?? null,
    body.enabled ?? true,
  );
  return c.json({ success: true, settings });
});

// POST /api/settings/telegram/test — test mesajı gönder
alertRoutes.post("/settings/telegram/test", async (c) => {
  const user = c.get("user" as never) as any;
  const body = await c.req.json<{
    telegram_bot_token: string;
    telegram_chat_id: string;
  }>();

  if (!body.telegram_bot_token || !body.telegram_chat_id) {
    return c.json({ success: false, error: "Bot token ve chat ID gerekli" }, 400);
  }

  const result = await testTelegram(body.telegram_bot_token, body.telegram_chat_id);
  return c.json({ success: result.success, error: result.error });
});

// ===== Alert Rules =====

// GET /api/alerts/rules — kullanıcının tüm alarm kuralları
alertRoutes.get("/alerts/rules", async (c) => {
  const user = c.get("user" as never) as any;
  const rules = await getAlertRules(user.id);
  return c.json({ success: true, rules });
});

// PUT /api/alerts/rules/:agentId — bir agent için kuralları güncelle
alertRoutes.put("/alerts/rules/:agentId", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("agentId");
  const body = await c.req.json<{
    rules: {
      rule_type: string;
      threshold: number;
      cooldown_minutes: number;
      enabled: boolean;
    }[];
  }>();

  if (!body.rules || !Array.isArray(body.rules)) {
    return c.json({ success: false, error: "rules dizisi gerekli" }, 400);
  }

  const rules = await bulkUpsertRules(user.id, agentId, body.rules);
  return c.json({ success: true, rules });
});

// ===== Alerts =====

// GET /api/alerts — alarm listesi
alertRoutes.get("/alerts", async (c) => {
  const user = c.get("user" as never) as any;
  const unread = c.req.query("unread") === "true";
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");

  const result = await getAlerts(user.id, { unread, limit, offset });
  return c.json({ success: true, ...result });
});

// POST /api/alerts/:id/read — alarmı okundu işaretle
alertRoutes.post("/alerts/:id/read", async (c) => {
  const user = c.get("user" as never) as any;
  const id = parseInt(c.req.param("id"));
  const ok = await markAlertRead(id, user.id);
  return c.json({ success: ok });
});

// POST /api/alerts/read-all — tümünü okundu işaretle
alertRoutes.post("/alerts/read-all", async (c) => {
  const user = c.get("user" as never) as any;
  const count = await markAllAlertsRead(user.id);
  return c.json({ success: true, count });
});

export { alertRoutes };
