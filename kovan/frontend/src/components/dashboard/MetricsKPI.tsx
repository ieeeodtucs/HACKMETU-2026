import type { SystemMetrics } from "../../api";
import { formatUptime, getMetricColor } from "./helpers";
import { Sparkline } from "./Sparkline";
import { CircularGauge } from "./CircularGauge";
import {
  SpinnerGapIcon,
  CpuIcon,
  MemoryIcon,
  HardDrivesIcon,
  MonitorIcon,
  ClockIcon,
} from "@phosphor-icons/react";

export function MetricsKPI({ metrics, history }: { metrics: SystemMetrics | null; history: SystemMetrics[] }) {
  if (!metrics) {
    return (
      <div className="metrics-kpi metrics-kpi-empty">
        <SpinnerGapIcon size={18} className="si-run" />
        <span>Metrikler bekleniyor...</span>
      </div>
    );
  }

  const cpuHistory = history.map((m) => m.cpuPercent);
  const memHistory = history.map((m) => m.memPercent);
  const diskHistory = history.map((m) => m.diskPercent);
  const gpuHistory = history.filter((m) => m.gpuPercent !== undefined).map((m) => m.gpuPercent!);

  const cpuColor = getMetricColor(metrics.cpuPercent);
  const memColor = getMetricColor(metrics.memPercent);
  const diskColor = getMetricColor(metrics.diskPercent);
  const gpuColor = metrics.gpuPercent !== undefined ? getMetricColor(metrics.gpuPercent) : "#90a4ae";

  return (
    <div className="metrics-kpi">
      {/* CPU */}
      <div className="metrics-card">
        <div className="metrics-card-top">
          <div className="metrics-card-icon" style={{ color: cpuColor }}>
            <CpuIcon size={18} weight="bold" />
          </div>
          <div className="metrics-card-info">
            <span className="metrics-card-label">CPU</span>
            <span className="metrics-card-value" style={{ color: cpuColor }}>
              {metrics.cpuPercent}%
            </span>
          </div>
          <CircularGauge percent={metrics.cpuPercent} size={48} color={cpuColor} />
        </div>
        {cpuHistory.length >= 2 && (
          <Sparkline data={cpuHistory} color={cpuColor} />
        )}
        {metrics.loadAvg && (
          <div className="metrics-card-sub">
            Load: {metrics.loadAvg.join(" / ")}
          </div>
        )}
      </div>

      {/* RAM */}
      <div className="metrics-card">
        <div className="metrics-card-top">
          <div className="metrics-card-icon" style={{ color: memColor }}>
            <MemoryIcon size={18} weight="bold" />
          </div>
          <div className="metrics-card-info">
            <span className="metrics-card-label">RAM</span>
            <span className="metrics-card-value" style={{ color: memColor }}>
              {metrics.memPercent}%
            </span>
          </div>
          <CircularGauge percent={metrics.memPercent} size={48} color={memColor} />
        </div>
        {memHistory.length >= 2 && (
          <Sparkline data={memHistory} color={memColor} />
        )}
        <div className="metrics-card-sub">
          {(metrics.memUsedMB / 1024).toFixed(1)} / {(metrics.memTotalMB / 1024).toFixed(1)} GB
        </div>
      </div>

      {/* Disk */}
      <div className="metrics-card">
        <div className="metrics-card-top">
          <div className="metrics-card-icon" style={{ color: diskColor }}>
            <HardDrivesIcon size={18} weight="bold" />
          </div>
          <div className="metrics-card-info">
            <span className="metrics-card-label">Disk</span>
            <span className="metrics-card-value" style={{ color: diskColor }}>
              {metrics.diskPercent}%
            </span>
          </div>
          <CircularGauge percent={metrics.diskPercent} size={48} color={diskColor} />
        </div>
        {diskHistory.length >= 2 && (
          <Sparkline data={diskHistory} color={diskColor} />
        )}
        <div className="metrics-card-sub">
          {metrics.diskUsedGB} / {metrics.diskTotalGB} GB
        </div>
      </div>

      {/* GPU (only if available) */}
      {metrics.gpuPercent !== undefined && (
        <div className="metrics-card">
          <div className="metrics-card-top">
            <div className="metrics-card-icon" style={{ color: gpuColor }}>
              <MonitorIcon size={18} weight="bold" />
            </div>
            <div className="metrics-card-info">
              <span className="metrics-card-label">GPU</span>
              <span className="metrics-card-value" style={{ color: gpuColor }}>
                {metrics.gpuPercent}%
              </span>
            </div>
            <CircularGauge percent={metrics.gpuPercent} size={48} color={gpuColor} />
          </div>
          {gpuHistory.length >= 2 && (
            <Sparkline data={gpuHistory} color={gpuColor} />
          )}
          <div className="metrics-card-sub">
            {metrics.gpuName || "GPU"}{metrics.gpuMemPercent !== undefined ? ` • VRAM ${metrics.gpuMemPercent}%` : ""}
          </div>
        </div>
      )}

      {/* Uptime */}
      <div className="metrics-card metrics-card-uptime">
        <div className="metrics-card-top">
          <div className="metrics-card-icon" style={{ color: "#b388ff" }}>
            <ClockIcon size={18} weight="bold" />
          </div>
          <div className="metrics-card-info">
            <span className="metrics-card-label">Uptime</span>
            <span className="metrics-card-value" style={{ color: "#b388ff" }}>
              {formatUptime(metrics.uptime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
