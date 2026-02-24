import { useState, useEffect } from "react";
import type { Agent, Command } from "@kovan/shared";
import {
  fetchCommands,
  type VulnScanResult,
  type NetworkScanResult,
  type SystemMetrics,
} from "../../api";
import { isWindows } from "./helpers";
import { ACTIONS, type MachineAction, type ActionModalState } from "./actions";
import { MachineInfo } from "./MachineInfo";
import { ActionButton } from "./ActionButton";
import { ActionOutputModal } from "./ActionOutputModal";
import { MetricsKPI } from "./MetricsKPI";
import { ActionLogDrawerContent } from "./ActionLogDrawerContent";
import { SlideDrawer } from "./SlideDrawer";
import { VulnDrawerContent } from "./VulnDrawerContent";
import { NetworkDrawerContent } from "./NetworkDrawerContent";
import { ScreenDrawerContent } from "./ScreenDrawerContent";
import { KeylogDrawerContent } from "./KeylogDrawerContent";
import FileManagerContent from "../FileManager";
import { ScheduleDrawerContent } from "./ScheduleDrawerContent";
import { TerminalDrawerContent } from "./TerminalDrawerContent";
import {
  TerminalWindowIcon,
  ShieldWarningIcon,
  BugIcon,
  ChartLineUpIcon,
  MonitorIcon,
  KeyboardIcon,
  FolderOpenIcon,
  ClockCountdownIcon,
  SpinnerGapIcon,
  EraserIcon,
  CaretRightIcon,
  PaperPlaneRightIcon,
  ArrowLeftIcon,
  LinuxLogoIcon,
  WindowsLogoIcon,
  WifiHighIcon as WaveIcon,
} from "@phosphor-icons/react";

export function ControlPanel({
  agent,
  commands,
  onAction,
  onClear,
  onSendCustom,
  onBack,
  onRename,
  vulnScan,
  vulnScanning,
  onTriggerVulnScan,
  networkScan,
  networkScanning,
  onTriggerNetworkScan,
  metricsLatest,
  metricsHistory,
}: {
  agent: Agent;
  commands: Command[];
  onAction: (action: MachineAction) => Promise<Command | null>;
  onClear: () => void;
  onSendCustom: (cmd: string) => void;
  onBack: () => void;
  onRename: (id: string, alias: string) => void;
  vulnScan: VulnScanResult | null;
  vulnScanning: boolean;
  onTriggerVulnScan: () => void;
  networkScan: NetworkScanResult | null;
  networkScanning: boolean;
  onTriggerNetworkScan: () => void;
  metricsLatest: SystemMetrics | null;
  metricsHistory: SystemMetrics[];
}) {
  const [customCmd, setCustomCmd] = useState("");
  const [drawerOpen, setDrawerOpen] = useState<"vuln" | "network" | "log" | "files" | "screen" | "keylog" | "schedules" | "terminal" | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);

  // Poll for action modal result
  useEffect(() => {
    if (!actionModal || actionModal.status === "completed" || actionModal.status === "error") return;
    const iv = setInterval(async () => {
      try {
        const cmds = await fetchCommands(agent.id);
        const cmd = cmds.find((c) => c.id === actionModal.commandId);
        if (cmd && (cmd.status === "completed" || cmd.status === "error")) {
          setActionModal((prev) =>
            prev ? {
              ...prev,
              status: cmd.status as "completed" | "error",
              output: cmd.status === "completed" ? (cmd.output || null) : null,
              error: cmd.status === "error" ? (cmd.output || "Bilinmeyen hata") : null,
            } : null,
          );
        } else if (cmd && cmd.status === "running") {
          setActionModal((prev) =>
            prev ? { ...prev, status: "running" } : null,
          );
        }
      } catch {}
    }, 500);
    return () => clearInterval(iv);
  }, [actionModal, agent.id]);

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCmd.trim()) return;
    onSendCustom(customCmd.trim());
    setCustomCmd("");
  };

  const vulnTotal = vulnScan?.summary?.total ?? 0;
  const netRisks = networkScan ? (networkScan.summary?.critical ?? 0) + (networkScan.summary?.high ?? 0) : 0;

  return (
    <div className="mc-panel">
      {/* Back navigation bar */}
      <div className="mc-back-bar">
        <button className="mc-back-btn" onClick={onBack}>
          <ArrowLeftIcon size={16} weight="bold" />
          <span>Dashboard</span>
        </button>
        <div className="mc-back-info">
          <span className={`sb-dot ${agent.isOnline ? "on" : "off"}`} />
          {isWindows(agent) ? <WindowsLogoIcon size={14} /> : <LinuxLogoIcon size={14} />}
          <span className="mc-back-hostname">{agent.alias || agent.hostname}</span>
          <code className="mc-back-id">{agent.id}</code>
        </div>
      </div>

      <div className="mc-panel-top">
        <MachineInfo agent={agent} onRename={onRename} />

        {agent.isOnline && (
          <MetricsKPI metrics={metricsLatest} history={metricsHistory} />
        )}

        <div className="mc-sections">
          {ACTIONS.map((cat) => (
            <section key={cat.category} className="mc-section">
              <div className="mc-section-head">
                {cat.icon}
                <h3>{cat.category}</h3>
              </div>
              <div className="mc-actions-grid">
                {cat.items.map((action) => (
                  <ActionButton
                    key={action.id}
                    action={action}
                    onExecute={async (a) => {
                      const cmd = await onAction(a);
                      if (cmd) {
                        setActionModal({
                          action: a,
                          commandId: cmd.id,
                          commandStr: cmd.command,
                          status: "pending",
                          output: null,
                          error: null,
                        });
                      }
                    }}
                    disabled={!agent.isOnline}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Scan & Log Triggers */}
          <section className="mc-section">
            <div className="mc-section-head">
              <ShieldWarningIcon size={14} weight="bold" />
              <h3>Güvenlik & Geçmiş</h3>
            </div>
            <div className="mc-scan-triggers">
              <button
                className="mc-scan-trigger vuln-trigger"
                onClick={() => setDrawerOpen("vuln")}
                disabled={!agent.isOnline}
              >
                <span className="mc-scan-trigger-icon">
                  <BugIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">Zafiyet Taraması</span>
                  <span className="mc-scan-trigger-desc">CVE veritabanı ile paket karşılaştırma</span>
                </div>
                {vulnScanning && (
                  <SpinnerGapIcon size={16} className="si-run" style={{ color: "#ff9100", flexShrink: 0 }} />
                )}
                {!vulnScanning && vulnScan?.status === "completed" && vulnTotal > 0 && (
                  <span className="mc-scan-trigger-badge" style={{ background: "rgba(255,23,68,0.15)", color: "#ff1744" }}>
                    {vulnTotal}
                  </span>
                )}
                {!vulnScanning && vulnScan?.status === "completed" && vulnTotal === 0 && (
                  <span className="mc-scan-trigger-badge" style={{ background: "rgba(102,187,106,0.15)", color: "#66bb6a" }}>
                    Temiz
                  </span>
                )}
              </button>
              <button
                className="mc-scan-trigger net-trigger"
                onClick={() => setDrawerOpen("network")}
                disabled={!agent.isOnline}
              >
                <span className="mc-scan-trigger-icon">
                  <ChartLineUpIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">Ağ Anomali Analizi</span>
                  <span className="mc-scan-trigger-desc">AI tabanlı ağ bağlantı analizi</span>
                </div>
                {networkScanning && (
                  <SpinnerGapIcon size={16} className="si-run" style={{ color: "#b388ff", flexShrink: 0 }} />
                )}
                {!networkScanning && networkScan?.status === "completed" && netRisks > 0 && (
                  <span className="mc-scan-trigger-badge" style={{ background: "rgba(255,23,68,0.15)", color: "#ff1744" }}>
                    {netRisks} risk
                  </span>
                )}
                {!networkScanning && networkScan?.status === "completed" && netRisks === 0 && (
                  <span className="mc-scan-trigger-badge" style={{ background: "rgba(102,187,106,0.15)", color: "#66bb6a" }}>
                    Temiz
                  </span>
                )}
              </button>
              <button
                className="mc-scan-trigger screen-trigger"
                onClick={() => setDrawerOpen("screen")}
                disabled={!agent.isOnline}
              >
                <span className="mc-scan-trigger-icon">
                  <MonitorIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">Ekran İzleme</span>
                  <span className="mc-scan-trigger-desc">Canlı ekran görüntüsü akışı</span>
                </div>
              </button>
              <button
                className="mc-scan-trigger keylog-trigger"
                onClick={() => setDrawerOpen("keylog")}
                disabled={!agent.isOnline}
              >
                <span className="mc-scan-trigger-icon">
                  <KeyboardIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">Tuş Kaydedici</span>
                  <span className="mc-scan-trigger-desc">Tuş vuruşlarını canlı kaydet ve izle</span>
                </div>
              </button>
              <button
                className="mc-scan-trigger fm-trigger"
                onClick={() => setDrawerOpen("files")}
                disabled={!agent.isOnline}
              >
                <span className="mc-scan-trigger-icon">
                  <FolderOpenIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">Dosya Yöneticisi</span>
                  <span className="mc-scan-trigger-desc">Dosya gezinme, indirme, yükleme ve yönetim</span>
                </div>
              </button>
              <button
                className="mc-scan-trigger log-trigger"
                onClick={() => setDrawerOpen("log")}
              >
                <span className="mc-scan-trigger-icon">
                  <TerminalWindowIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">İşlem Geçmişi</span>
                  <span className="mc-scan-trigger-desc">Çalıştırılan komutlar ve çıktıları</span>
                </div>
                {commands.length > 0 && (
                  <span className="mc-scan-trigger-badge" style={{ background: "rgba(255,203,8,0.15)", color: "#ffcb08" }}>
                    {commands.length}
                  </span>
                )}
              </button>
              <button
                className="mc-scan-trigger terminal-trigger"
                onClick={() => setDrawerOpen("terminal")}
                disabled={!agent.isOnline}
              >
                <span className="mc-scan-trigger-icon">
                  <TerminalWindowIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">İnteraktif Terminal</span>
                  <span className="mc-scan-trigger-desc">Gerçek zamanlı PTY shell erişimi (SSH benzeri)</span>
                </div>
              </button>
              <button
                className="mc-scan-trigger sched-trigger"
                onClick={() => setDrawerOpen("schedules")}
              >
                <span className="mc-scan-trigger-icon">
                  <ClockCountdownIcon size={22} weight="bold" />
                </span>
                <div className="mc-scan-trigger-text">
                  <span className="mc-scan-trigger-label">Zamanlanmış Görevler</span>
                  <span className="mc-scan-trigger-desc">Otomatik komut zamanlama ve geçmişi</span>
                </div>
              </button>
            </div>
          </section>

          {/* Custom command */}
          <section className="mc-section">
            <div className="mc-section-head">
              <TerminalWindowIcon size={14} weight="bold" />
              <h3>Özel Komut</h3>
            </div>
            <form className="mc-custom-cmd" onSubmit={submitCustom}>
              <div className="mc-custom-input-wrap">
                <CaretRightIcon size={14} className="mc-custom-icon" />
                <input
                  value={customCmd}
                  onChange={(e) => setCustomCmd(e.target.value)}
                  placeholder={
                    agent.isOnline ? "Komut yazın ve Enter'a basın..." : "Makine çevrimdışı"
                  }
                  disabled={!agent.isOnline}
                />
              </div>
              <button
                type="submit"
                className="mc-custom-send"
                disabled={!agent.isOnline || !customCmd.trim()}
              >
                <PaperPlaneRightIcon size={14} />
                Çalıştır
              </button>
            </form>
          </section>
        </div>
      </div>

      {/* Action Log Drawer */}
      <SlideDrawer
        open={drawerOpen === "log"}
        onClose={() => setDrawerOpen(null)}
        title="İşlem Geçmişi"
        icon={<TerminalWindowIcon size={18} weight="fill" style={{ color: "var(--accent)" }} />}
        actionBar={
          commands.length > 0 ? (
            <>
              <div className="drawer-action-bar-info">
                <span>{commands.length} komut çalıştırıldı</span>
              </div>
              <button
                className="vuln-scan-btn"
                style={{ borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)", color: "#ef5350" }}
                onClick={onClear}
              >
                <EraserIcon size={13} />
                Temizle
              </button>
            </>
          ) : undefined
        }
      >
        <ActionLogDrawerContent commands={commands} />
      </SlideDrawer>

      {/* Vuln Scan Drawer */}
      <SlideDrawer
        open={drawerOpen === "vuln"}
        onClose={() => setDrawerOpen(null)}
        title="Zafiyet Taraması"
        icon={<ShieldWarningIcon size={18} weight="fill" style={{ color: "#ff6d00" }} />}
        actionBar={
          <>
            <div className="drawer-action-bar-info">
              {vulnScan?.status === "completed" && (
                <span>{vulnScan.scanned} paket tarandı</span>
              )}
              {vulnScan?.status === "completed" && vulnTotal > 0 && (
                <span className="vuln-badge vuln-badge-danger">{vulnTotal} zafiyet</span>
              )}
              {vulnScan?.status === "completed" && vulnTotal === 0 && (
                <span className="vuln-badge vuln-badge-safe">Temiz</span>
              )}
            </div>
            <button
              className="vuln-scan-btn"
              disabled={!agent.isOnline || vulnScanning}
              onClick={onTriggerVulnScan}
            >
              {vulnScanning ? (
                <><SpinnerGapIcon size={13} className="si-run" /> Taranıyor...</>
              ) : (
                <><BugIcon size={13} /> Tara</>
              )}
            </button>
          </>
        }
      >
        <VulnDrawerContent
          scan={vulnScan}
          scanning={vulnScanning}
          onTrigger={onTriggerVulnScan}
          disabled={!agent.isOnline}
        />
      </SlideDrawer>

      {/* Network Scan Drawer */}
      <SlideDrawer
        open={drawerOpen === "network"}
        onClose={() => setDrawerOpen(null)}
        title="Ağ Anomali Analizi"
        icon={<WaveIcon size={18} weight="fill" style={{ color: "#7c4dff" }} />}
        actionBar={
          <>
            <div className="drawer-action-bar-info">
              {networkScan?.status === "completed" && (
                <span>{networkScan.summary.total} bağlantı analiz edildi</span>
              )}
              {networkScan?.status === "completed" && netRisks > 0 && (
                <span className="net-badge net-badge-danger">{netRisks} risk</span>
              )}
              {networkScan?.status === "completed" && netRisks === 0 && (
                <span className="net-badge net-badge-safe">Temiz</span>
              )}
            </div>
            <button
              className="net-scan-btn"
              disabled={!agent.isOnline || networkScanning}
              onClick={onTriggerNetworkScan}
            >
              {networkScanning ? (
                <><SpinnerGapIcon size={13} className="si-run" /> Analiz ediliyor...</>
              ) : (
                <><ChartLineUpIcon size={13} /> Analiz Et</>
              )}
            </button>
          </>
        }
      >
        <NetworkDrawerContent
          scan={networkScan}
          scanning={networkScanning}
          onTrigger={onTriggerNetworkScan}
          disabled={!agent.isOnline}
        />
      </SlideDrawer>

      {/* File Manager Drawer */}
      <SlideDrawer
        open={drawerOpen === "files"}
        onClose={() => setDrawerOpen(null)}
        title="Dosya Yöneticisi"
        icon={<FolderOpenIcon size={18} weight="fill" style={{ color: "#42a5f5" }} />}
      >
        {drawerOpen === "files" && (
          <FileManagerContent
            agentId={agent.id}
            isWindows={isWindows(agent)}
            disabled={!agent.isOnline}
          />
        )}
      </SlideDrawer>

      {/* Screen Streaming Drawer */}
      <SlideDrawer
        open={drawerOpen === "screen"}
        onClose={() => setDrawerOpen(null)}
        title="Ekran İzleme"
        icon={<MonitorIcon size={18} weight="fill" style={{ color: "#00e676" }} />}
      >
        {drawerOpen === "screen" && (
          <ScreenDrawerContent
            agentId={agent.id}
            isOnline={agent.isOnline}
          />
        )}
      </SlideDrawer>

      {/* Keylogger Drawer */}
      <SlideDrawer
        open={drawerOpen === "keylog"}
        onClose={() => setDrawerOpen(null)}
        title="Tuş Kaydedici"
        icon={<KeyboardIcon size={18} weight="fill" style={{ color: "#ff9100" }} />}
      >
        {drawerOpen === "keylog" && (
          <KeylogDrawerContent
            agentId={agent.id}
            isOnline={agent.isOnline}
          />
        )}
      </SlideDrawer>

      {/* Interactive Terminal Drawer */}
      <SlideDrawer
        open={drawerOpen === "terminal"}
        onClose={() => setDrawerOpen(null)}
        title="İnteraktif Terminal"
        icon={<TerminalWindowIcon size={18} weight="fill" style={{ color: "#00e676" }} />}
      >
        {drawerOpen === "terminal" && (
          <TerminalDrawerContent
            agentId={agent.id}
            isOnline={agent.isOnline}
          />
        )}
      </SlideDrawer>

      {/* Schedule Drawer */}
      <SlideDrawer
        open={drawerOpen === "schedules"}
        onClose={() => setDrawerOpen(null)}
        title="Zamanlanmış Görevler"
        icon={<ClockCountdownIcon size={18} weight="fill" style={{ color: "#ffcb08" }} />}
      >
        {drawerOpen === "schedules" && (
          <ScheduleDrawerContent
            agentId={agent.id}
            agentName={agent.alias || agent.hostname}
          />
        )}
      </SlideDrawer>

      {/* Action Output Modal */}
      {actionModal && (
        <ActionOutputModal
          state={actionModal}
          onClose={() => setActionModal(null)}
        />
      )}
    </div>
  );
}
