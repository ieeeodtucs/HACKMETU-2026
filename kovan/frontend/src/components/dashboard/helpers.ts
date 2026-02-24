import type { Agent } from "@kovan/shared";

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s önce`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}sa önce`;
}

export function isWindows(agent: Agent): boolean {
  return agent.os.toLowerCase().includes("win");
}

export function severityColor(sev: string): string {
  switch (sev) {
    case "CRITICAL": return "#ff1744";
    case "HIGH": return "#ff6d00";
    case "MEDIUM": return "#ffc107";
    case "LOW": return "#66bb6a";
    default: return "#90a4ae";
  }
}

export function severityBg(sev: string): string {
  switch (sev) {
    case "CRITICAL": return "rgba(255,23,68,0.12)";
    case "HIGH": return "rgba(255,109,0,0.12)";
    case "MEDIUM": return "rgba(255,193,7,0.1)";
    case "LOW": return "rgba(102,187,106,0.1)";
    default: return "rgba(144,164,174,0.1)";
  }
}

export function riskColor(level: string): string {
  switch (level) {
    case "critical": return "#ff1744";
    case "high": return "#ff6d00";
    case "medium": return "#ffc107";
    case "low": return "#66bb6a";
    default: return "#90a4ae";
  }
}

export function riskBg(level: string): string {
  switch (level) {
    case "critical": return "rgba(255,23,68,0.12)";
    case "high": return "rgba(255,109,0,0.12)";
    case "medium": return "rgba(255,193,7,0.1)";
    case "low": return "rgba(102,187,106,0.1)";
    default: return "rgba(144,164,174,0.1)";
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}g ${h}s`;
  if (h > 0) return `${h}s ${m}dk`;
  return `${m}dk`;
}

export function getMetricColor(percent: number): string {
  if (percent >= 90) return "#ff1744";
  if (percent >= 75) return "#ff6d00";
  if (percent >= 50) return "#ffc107";
  return "#66bb6a";
}
