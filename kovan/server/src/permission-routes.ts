import { Hono } from "hono";
import { pool } from "./db.js";
import { auth } from "./auth.js";

const permissionRoutes = new Hono();

// Middleware: only admin can manage permissions
async function requireAdmin(c: any, next: any) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ success: false, error: "Unauthorized" }, 401);
  if ((session.user as any).role !== "admin") {
    return c.json({ success: false, error: "Admin only" }, 403);
  }
  c.set("user", session.user);
  await next();
}

// GET /api/permissions — list all permissions
permissionRoutes.get("/", requireAdmin, async (c) => {
  const { rows } = await pool.query(`
    SELECT uap.id, uap.user_id, uap.agent_id, uap.granted_at,
           u.name as user_name, u.email as user_email
    FROM user_agent_permissions uap
    JOIN "user" u ON u.id = uap.user_id
    ORDER BY uap.granted_at DESC
  `);
  return c.json({ success: true, permissions: rows });
});

// GET /api/permissions/user/:userId — permissions for a specific user
permissionRoutes.get("/user/:userId", requireAdmin, async (c) => {
  const userId = c.req.param("userId");
  const { rows } = await pool.query(
    `SELECT agent_id FROM user_agent_permissions WHERE user_id = $1`,
    [userId]
  );
  return c.json({ success: true, agentIds: rows.map((r: any) => r.agent_id) });
});

// POST /api/permissions — grant permission { userId, agentId }
permissionRoutes.post("/", requireAdmin, async (c) => {
  const { userId, agentId } = await c.req.json<{ userId: string; agentId: string }>();
  if (!userId || !agentId) {
    return c.json({ success: false, error: "userId and agentId required" }, 400);
  }
  const admin = (c as any).get("user");
  try {
    await pool.query(
      `INSERT INTO user_agent_permissions (user_id, agent_id, granted_by) VALUES ($1, $2, $3) ON CONFLICT (user_id, agent_id) DO NOTHING`,
      [userId, agentId, admin.id]
    );
    return c.json({ success: true, message: "Permission granted" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/permissions — revoke permission { userId, agentId }
permissionRoutes.delete("/", requireAdmin, async (c) => {
  const { userId, agentId } = await c.req.json<{ userId: string; agentId: string }>();
  if (!userId || !agentId) {
    return c.json({ success: false, error: "userId and agentId required" }, 400);
  }
  await pool.query(
    `DELETE FROM user_agent_permissions WHERE user_id = $1 AND agent_id = $2`,
    [userId, agentId]
  );
  return c.json({ success: true, message: "Permission revoked" });
});

// Helper: get permitted agent IDs for a user
export async function getPermittedAgentIds(userId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT agent_id FROM user_agent_permissions WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r: any) => r.agent_id);
}

export { permissionRoutes };
