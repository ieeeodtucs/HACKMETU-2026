import { useState, useEffect } from "react";
import type { Agent, Command } from "@kovan/shared";
import {
  fetchAgents,
  fetchCommands,
  sendCommand,
  deleteAgent,
  clearCommands,
  renameAgent,
  triggerVulnScan,
  fetchVulnScan,
  triggerNetworkScan,
  fetchNetworkScan,
  fetchMetrics,
  type VulnScanResult,
  type NetworkScanResult,
  type SystemMetrics,
} from "../api";
import { useAuthStore } from "../store";
import { DashboardHome, ControlPanel } from "../components/dashboard";
import type { MachineAction } from "../components/dashboard";
import {
  UserIcon,
  SpinnerGapIcon,
  WarningCircleIcon,
  SignOutIcon,
  CrownIcon,
  ArrowLeftIcon,
  GearIcon,
  GlobeSimpleIcon,
} from "@phosphor-icons/react";
import { NotificationBell } from "../components/NotificationBell";
import { useNavigate, useParams } from "react-router";

export default function DashboardPage() {
  const { user, isAdmin, logout } = useAuthStore();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId?: string }>();

  const selectedId = agentId ?? null;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [vulnScan, setVulnScan] = useState<VulnScanResult | null>(null);
  const [vulnScanning, setVulnScanning] = useState(false);
  const [networkScan, setNetworkScan] = useState<NetworkScanResult | null>(null);
  const [networkScanning, setNetworkScanning] = useState(false);
  const [metricsLatest, setMetricsLatest] = useState<SystemMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<SystemMetrics[]>([]);

  // Load agent list (always)
  useEffect(() => {
    const load = () => fetchAgents().then(setAgents).catch(console.error);
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, []);

  // Load selected agent with permission check
  useEffect(() => {
    if (!selectedId) {
      setSelectedAgent(null);
      setAgentError(null);
      setAgentLoading(false);
      return;
    }

    let cancelled = false;
    setAgentLoading(true);
    setAgentError(null);

    const load = async () => {
      try {
        const res = await fetch(`/api/agents/${selectedId}`, { credentials: "include" });
        if (cancelled) return;

        if (res.status === 403) {
          setAgentError("Bu makineye erişim yetkiniz yok.");
          setSelectedAgent(null);
          setAgentLoading(false);
          return;
        }
        if (res.status === 404) {
          setAgentError("Makine bulunamadı.");
          setSelectedAgent(null);
          setAgentLoading(false);
          return;
        }
        if (res.status === 401) {
          navigate("/login");
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.success && data.agent) {
          setSelectedAgent(data.agent);
          setAgentError(null);
        } else {
          setAgentError("Makine yüklenemedi.");
          setSelectedAgent(null);
        }
      } catch {
        if (!cancelled) {
          setAgentError("Sunucuya bağlanılamadı.");
          setSelectedAgent(null);
        }
      } finally {
        if (!cancelled) setAgentLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [selectedId, navigate]);

  // Commands polling
  useEffect(() => {
    if (!selectedId || agentError) {
      setCommands([]);
      return;
    }
    const load = () =>
      fetchCommands(selectedId).then(setCommands).catch(console.error);
    load();
    const iv = setInterval(load, 2000);
    return () => clearInterval(iv);
  }, [selectedId, agentError]);

  // Vuln scan polling
  useEffect(() => {
    if (!selectedId || agentError) {
      setVulnScan(null);
      setVulnScanning(false);
      return;
    }
    const loadScan = () =>
      fetchVulnScan(selectedId).then((scan) => {
        setVulnScan(scan);
        if (scan && scan.status !== "scanning") {
          setVulnScanning(false);
        }
      }).catch(console.error);
    loadScan();
    const iv = setInterval(loadScan, vulnScanning ? 2000 : 10000);
    return () => clearInterval(iv);
  }, [selectedId, vulnScanning, agentError]);

  // Network scan polling
  useEffect(() => {
    if (!selectedId || agentError) {
      setNetworkScan(null);
      setNetworkScanning(false);
      return;
    }
    const loadScan = () =>
      fetchNetworkScan(selectedId).then((scan) => {
        setNetworkScan(scan);
        if (scan && scan.status !== "scanning") {
          setNetworkScanning(false);
        }
      }).catch(console.error);
    loadScan();
    const iv = setInterval(loadScan, networkScanning ? 2000 : 10000);
    return () => clearInterval(iv);
  }, [selectedId, networkScanning, agentError]);

  // Metrics polling
  useEffect(() => {
    if (!selectedId || agentError) {
      setMetricsLatest(null);
      setMetricsHistory([]);
      return;
    }
    const loadMetrics = () =>
      fetchMetrics(selectedId, 60).then(({ metrics, latest }) => {
        setMetricsHistory(metrics);
        setMetricsLatest(latest);
      }).catch(console.error);
    loadMetrics();
    const iv = setInterval(loadMetrics, 5000);
    return () => clearInterval(iv);
  }, [selectedId, agentError]);

  const sel = selectedAgent;
  const onlineCount = agents.filter((a) => a.isOnline).length;

  const handleRename = async (id: string, alias: string) => {
    await renameAgent(id, alias);
    setAgents(await fetchAgents());
  };

  const handleAction = async (action: MachineAction): Promise<Command | null> => {
    if (!sel || !selectedId) return null;
    const cmdStr = action.getCommand(sel);
    const cmd = await sendCommand(selectedId, cmdStr);
    setCommands(await fetchCommands(selectedId));
    return cmd;
  };

  const handleVulnScan = async () => {
    if (!selectedId) return;
    setVulnScanning(true);
    try {
      await triggerVulnScan(selectedId);
    } catch (err) {
      console.error("Vuln scan error:", err);
      setVulnScanning(false);
    }
  };

  const handleNetworkScan = async () => {
    if (!selectedId) return;
    setNetworkScanning(true);
    try {
      await triggerNetworkScan(selectedId);
    } catch (err) {
      console.error("Network scan error:", err);
      setNetworkScanning(false);
    }
  };

  return (
    <div className="shell">
      <header className="hdr">
        <div
          className="hdr-brand"
          style={{ cursor: selectedId ? "pointer" : "default" }}
          onClick={() => {
            if (selectedId) navigate("/dashboard");
          }}
        >
          <img src="/assets/kovan-icon.svg" alt="Kovan" style={{ height: 32 }} />
          <span className="hdr-title">Kovan</span>
        </div>
        <div className="hdr-stats">
          <div className="hdr-kv">
            <span className="hdr-k">Makineler</span>
            <span className="hdr-v">{agents.length}</span>
          </div>
          <div className="hdr-sep" />
          <div className="hdr-kv">
            <span className="hdr-k">Çevrimiçi</span>
            <span className="hdr-v green">{onlineCount}</span>
          </div>
          <div className="hdr-sep" />
          <div className="hdr-kv">
            <span className="hdr-k">Çevrimdışı</span>
            <span className="hdr-v red">{agents.length - onlineCount}</span>
          </div>
        </div>
        <div className="hdr-user">
          <NotificationBell />
          <button className="hdr-settings-btn" onClick={() => navigate("/map")} title="Coğrafi Harita">
            <GlobeSimpleIcon size={16} />
          </button>
          <button className="hdr-settings-btn" onClick={() => navigate("/settings")} title="Ayarlar">
            <GearIcon size={16} />
          </button>
          <span className="hdr-username">
            <UserIcon size={13} />
            {user?.name || user?.email}
          </span>
          {isAdmin && (
            <button className="hdr-admin-btn" onClick={() => navigate("/admin")}>
              <CrownIcon size={13} weight="fill" />
              Admin
            </button>
          )}
          <button
            className="hdr-logout"
            onClick={() => logout().then(() => navigate("/login"))}
          >
            <SignOutIcon size={14} />
            Çıkış
          </button>
        </div>
      </header>

      <div className="body-full">
        {selectedId ? (
          agentLoading && !sel ? (
            <div className="agent-state-screen">
              <SpinnerGapIcon size={32} className="si-run" />
              <span>Makine yükleniyor...</span>
            </div>
          ) : agentError ? (
            <div className="agent-state-screen">
              <WarningCircleIcon size={40} weight="duotone" style={{ color: "var(--red)" }} />
              <span className="agent-state-title">{agentError}</span>
              <button className="mc-back-btn" onClick={() => navigate("/dashboard")}>
                <ArrowLeftIcon size={14} weight="bold" />
                Dashboard'a Dön
              </button>
            </div>
          ) : sel ? (
            <ControlPanel
              agent={sel}
              commands={commands}
              onAction={handleAction}
              onClear={async () => {
                if (!selectedId) return;
                await clearCommands(selectedId);
                setCommands([]);
              }}
              onSendCustom={async (cmd) => {
                if (!selectedId) return;
                await sendCommand(selectedId, cmd);
                setCommands(await fetchCommands(selectedId));
              }}
              onRename={handleRename}
              onBack={() => navigate("/dashboard")}
              vulnScan={vulnScan}
              vulnScanning={vulnScanning}
              onTriggerVulnScan={handleVulnScan}
              networkScan={networkScan}
              networkScanning={networkScanning}
              onTriggerNetworkScan={handleNetworkScan}
              metricsLatest={metricsLatest}
              metricsHistory={metricsHistory}
            />
          ) : null
        ) : (
          <DashboardHome
            agents={agents}
            onSelectAgent={(id) => navigate(`/agent/${id}`)}
            isAdmin={isAdmin}
            onRename={handleRename}
            onDeleteAgent={async (id) => {
              await deleteAgent(id);
              setAgents(await fetchAgents());
            }}
          />
        )}
      </div>
    </div>
  );
}
