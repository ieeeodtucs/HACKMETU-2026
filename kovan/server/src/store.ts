import type { Agent, Command, SystemMetrics, KeyEvent, FileListResponse, FileDownloadResponse, FileUploadResponse, FileDeleteResponse, FileMoveResponse, FileCopyResponse } from "@kovan/shared";
import type { WebSocket } from "ws";

// ===== Vulnerability Scan Types =====
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

// ===== Network Scan Types =====
export interface NetworkConnection {
  source_ip: string;
  source_port: number;
  dest_ip: string;
  dest_port: number;
  state: string;
  process: string;
  pid: number | null;
  // ATTDAP scores
  hybrid_score: number;
  risk_level: string;
  if_score: number;
  ae_score: number;
  gmm_score: number;
  // Raw flow metrics
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

/**
 * In-memory store — tüm agent, komut ve ws bağlantılarını tutar
 */
class Store {
  agents = new Map<string, Agent>();
  savedGroups = new Set<string>();  // persist group names even when empty
  commands = new Map<string, Command>();
  connections = new Map<string, WebSocket>();
  vulnScans = new Map<string, VulnScanResult>(); // agentId -> last scan
  networkScans = new Map<string, NetworkScanResult>(); // agentId -> last network scan
  metricsHistory = new Map<string, SystemMetrics[]>(); // agentId -> last N metrics
  keylogData = new Map<string, KeyEvent[]>(); // agentId -> keylog events
  keylogActive = new Set<string>(); // agentId's with active keylogging
  keylogErrors = new Map<string, string>(); // agentId -> last error message
  private readonly MAX_METRICS_HISTORY = 60; // ~10 minutes at 10s intervals
  private readonly MAX_KEYLOG_EVENTS = 5000; // max events per agent

  // File manager: pending request resolvers
  fileRequests = new Map<string, {
    resolve: (data: any) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  // ===== Agents =====
  addAgent(agent: Agent) {
    this.agents.set(agent.id, agent);
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  updateLastSeen(id: string) {
    const agent = this.agents.get(id);
    if (agent) {
      agent.lastSeen = new Date().toISOString();
      agent.isOnline = true;
    }
  }

  setOffline(id: string) {
    const agent = this.agents.get(id);
    if (agent) {
      agent.isOnline = false;
    }
  }

  renameAgent(id: string, alias: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    agent.alias = alias || undefined; // boş string ise kaldır
    return true;
  }

  setAgentGroup(id: string, group: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;
    if (group) this.savedGroups.add(group); // remember group name
    agent.group = group || undefined; // boş string ise kaldır
    return true;
  }

  addGroup(name: string) {
    if (name.trim()) this.savedGroups.add(name.trim());
  }

  deleteGroup(name: string) {
    this.savedGroups.delete(name);
    // also remove from all agents
    for (const agent of this.agents.values()) {
      if (agent.group === name) agent.group = undefined;
    }
  }

  getAllGroups(): string[] {
    // merge saved + in-use groups
    const groups = new Set(this.savedGroups);
    for (const agent of this.agents.values()) {
      if (agent.group) groups.add(agent.group);
    }
    return Array.from(groups).sort();
  }

  getAgentsByGroup(group: string): Agent[] {
    return Array.from(this.agents.values()).filter(
      (a) => a.group === group
    );
  }

  deleteAgent(id: string): boolean {
    // Close WS connection if exists
    const conn = this.connections.get(id);
    if (conn) {
      try { conn.close(); } catch {}
      this.connections.delete(id);
    }
    // Remove all commands for this agent
    for (const [cmdId, cmd] of this.commands) {
      if (cmd.agentId === id) this.commands.delete(cmdId);
    }
    return this.agents.delete(id);
  }

  clearCommandsByAgent(agentId: string): number {
    let count = 0;
    for (const [cmdId, cmd] of this.commands) {
      if (cmd.agentId === agentId) {
        this.commands.delete(cmdId);
        count++;
      }
    }
    return count;
  }

  // ===== Connections =====
  setConn(id: string, ws: WebSocket) {
    this.connections.set(id, ws);
  }

  getConn(id: string) {
    return this.connections.get(id);
  }

  removeConn(id: string) {
    this.connections.delete(id);
  }

  // ===== Commands =====
  addCommand(cmd: Command) {
    this.commands.set(cmd.id, cmd);
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getCommandsByAgent(agentId: string): Command[] {
    return Array.from(this.commands.values()).filter(
      (c) => c.agentId === agentId
    );
  }

  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  updateCommand(id: string, status: Command["status"], output: string) {
    const cmd = this.commands.get(id);
    if (cmd) {
      cmd.status = status;
      cmd.output = output;
      cmd.doneAt = new Date().toISOString();
    }
  }

  // ===== Vuln Scans =====
  setVulnScan(agentId: string, scan: VulnScanResult) {
    this.vulnScans.set(agentId, scan);
  }

  getVulnScan(agentId: string): VulnScanResult | undefined {
    return this.vulnScans.get(agentId);
  }

  // ===== Network Scans =====
  setNetworkScan(agentId: string, scan: NetworkScanResult) {
    this.networkScans.set(agentId, scan);
  }

  getNetworkScan(agentId: string): NetworkScanResult | undefined {
    return this.networkScans.get(agentId);
  }

  // ===== Metrics =====
  addMetrics(agentId: string, metrics: SystemMetrics) {
    let history = this.metricsHistory.get(agentId);
    if (!history) {
      history = [];
      this.metricsHistory.set(agentId, history);
    }
    history.push(metrics);
    if (history.length > this.MAX_METRICS_HISTORY) {
      history.splice(0, history.length - this.MAX_METRICS_HISTORY);
    }
  }

  getMetrics(agentId: string, limit?: number): SystemMetrics[] {
    const history = this.metricsHistory.get(agentId) || [];
    if (limit && limit < history.length) {
      return history.slice(-limit);
    }
    return history;
  }

  getLatestMetrics(agentId: string): SystemMetrics | undefined {
    const history = this.metricsHistory.get(agentId);
    if (!history || history.length === 0) return undefined;
    return history[history.length - 1];
  }

  // ===== Keylog =====
  addKeylogEvents(agentId: string, events: KeyEvent[]) {
    let existing = this.keylogData.get(agentId);
    if (!existing) {
      existing = [];
      this.keylogData.set(agentId, existing);
    }
    existing.push(...events);
    if (existing.length > this.MAX_KEYLOG_EVENTS) {
      existing.splice(0, existing.length - this.MAX_KEYLOG_EVENTS);
    }
  }

  getKeylogEvents(agentId: string, limit?: number, since?: number): KeyEvent[] {
    const events = this.keylogData.get(agentId) || [];
    let filtered = events;
    if (since) {
      filtered = events.filter(e => e.ts > since);
    }
    if (limit && limit < filtered.length) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  clearKeylog(agentId: string) {
    this.keylogData.delete(agentId);
  }

  setKeylogActive(agentId: string, active: boolean) {
    if (active) {
      this.keylogActive.add(agentId);
      this.keylogErrors.delete(agentId); // clear error on start
    } else {
      this.keylogActive.delete(agentId);
    }
  }

  isKeylogActive(agentId: string): boolean {
    return this.keylogActive.has(agentId);
  }

  setKeylogError(agentId: string, error: string) {
    this.keylogErrors.set(agentId, error);
    this.keylogActive.delete(agentId);
  }

  getKeylogError(agentId: string): string | null {
    return this.keylogErrors.get(agentId) || null;
  }

  clearKeylogError(agentId: string) {
    this.keylogErrors.delete(agentId);
  }

  // ===== File Requests =====
  addFileRequest(requestId: string, timeout = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fileRequests.delete(requestId);
        reject(new Error("Dosya işlemi zaman aşımına uğradı"));
      }, timeout);
      this.fileRequests.set(requestId, { resolve, reject, timer });
    });
  }

  resolveFileRequest(requestId: string, data: any) {
    const req = this.fileRequests.get(requestId);
    if (req) {
      clearTimeout(req.timer);
      this.fileRequests.delete(requestId);
      req.resolve(data);
    }
  }
}

export const store = new Store();
