import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import type { Agent } from "@kovan/shared";
import { fetchAgents } from "../api";
import { useAuthStore } from "../store";
import {
  GearIcon,
  TelegramLogoIcon,
  FloppyDiskIcon,
  PaperPlaneRightIcon,
  SpinnerGapIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ArrowLeftIcon,
  CpuIcon,
  MemoryIcon,
  HardDriveIcon,
  WifiSlashIcon,
  ShieldCheckIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  UserIcon,
  SignOutIcon,
  CrownIcon,
  CaretRightIcon,
  CircleIcon,
} from "@phosphor-icons/react";
import { NotificationBell } from "../components/NotificationBell";
import "../styles/settings.css";

const opts: RequestInit = { credentials: "include" };

interface AlertSettings {
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  enabled: boolean;
}

interface AlertRule {
  rule_type: string;
  threshold: number;
  cooldown_minutes: number;
  enabled: boolean;
}

interface AgentRules {
  [agentId: string]: AlertRule[];
}

const DEFAULT_RULES: AlertRule[] = [
  { rule_type: "cpu", threshold: 90, cooldown_minutes: 15, enabled: true },
  { rule_type: "ram", threshold: 90, cooldown_minutes: 15, enabled: true },
  { rule_type: "disk", threshold: 90, cooldown_minutes: 30, enabled: true },
  { rule_type: "offline", threshold: 0, cooldown_minutes: 5, enabled: true },
  { rule_type: "cve_critical", threshold: 0, cooldown_minutes: 60, enabled: true },
];

const RULE_META: Record<string, { label: string; icon: React.ReactNode; hasThreshold: boolean }> = {
  cpu: { label: "CPU", icon: <CpuIcon size={13} weight="duotone" />, hasThreshold: true },
  ram: { label: "RAM", icon: <MemoryIcon size={13} weight="duotone" />, hasThreshold: true },
  disk: { label: "Disk", icon: <HardDriveIcon size={13} weight="duotone" />, hasThreshold: true },
  offline: { label: "Offline", icon: <WifiSlashIcon size={13} weight="duotone" />, hasThreshold: false },
  cve_critical: { label: "CVE", icon: <ShieldCheckIcon size={13} weight="duotone" />, hasThreshold: false },
};

export default function SettingsPage() {
  const { user, isAdmin, logout } = useAuthStore();
  const navigate = useNavigate();

  const [settings, setSettings] = useState<AlertSettings>({
    telegram_bot_token: null, telegram_chat_id: null, enabled: true,
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentRules, setAgentRules] = useState<AgentRules>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [ruleSaving, setRuleSaving] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings", opts).then((r) => r.json()).then((d) => {
      if (d.success && d.settings) setSettings(d.settings);
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchAgents().then(setAgents).catch(() => {}); }, []);

  useEffect(() => {
    fetch("/api/alerts/rules", opts).then((r) => r.json()).then((d) => {
      if (d.success && d.rules) {
        const grouped: AgentRules = {};
        for (const rule of d.rules) {
          if (!grouped[rule.agent_id]) grouped[rule.agent_id] = [];
          grouped[rule.agent_id].push(rule);
        }
        setAgentRules(grouped);
      }
    }).catch(() => {});
  }, []);

  const getRulesForAgent = (agentId: string): AlertRule[] => {
    const existing = agentRules[agentId] || [];
    return DEFAULT_RULES.map((def) => {
      const found = existing.find((r) => r.rule_type === def.rule_type);
      return found ? { ...found } : { ...def };
    });
  };

  const isAgentEnabled = (agentId: string): boolean => {
    const rules = getRulesForAgent(agentId);
    return rules.some((r) => r.enabled);
  };

  const toggleAgentAll = (agentId: string) => {
    const anyEnabled = isAgentEnabled(agentId);
    setAgentRules((prev) => {
      const rules = getRulesForAgent(agentId).map((r) => ({ ...r, enabled: !anyEnabled }));
      return { ...prev, [agentId]: rules };
    });
  };

  const updateRule = (agentId: string, ruleType: string, field: string, value: any) => {
    setAgentRules((prev) => {
      const rules = getRulesForAgent(agentId).map((r) =>
        r.rule_type === ruleType ? { ...r, [field]: value } : r,
      );
      return { ...prev, [agentId]: rules };
    });
  };

  const saveSettings = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch("/api/settings", {
        ...opts, method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) { setSaveMsg("Kaydedildi!"); setTimeout(() => setSaveMsg(null), 3000); }
    } catch { setSaveMsg("Hata!"); }
    setSaving(false);
  };

  const testTelegram = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await fetch("/api/settings/telegram/test", {
        ...opts, method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_bot_token: settings.telegram_bot_token, telegram_chat_id: settings.telegram_chat_id }),
      });
      const data = await res.json();
      setTestResult({ ok: data.success, msg: data.success ? "Gönderildi!" : data.error || "Hata!" });
    } catch { setTestResult({ ok: false, msg: "Bağlantı hatası" }); }
    setTesting(false);
    setTimeout(() => setTestResult(null), 5000);
  };

  const saveAgentRules = async (agentId: string) => {
    setRuleSaving(agentId);
    try {
      await fetch(`/api/alerts/rules/${agentId}`, {
        ...opts, method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: getRulesForAgent(agentId) }),
      });
    } catch {}
    setRuleSaving(null);
  };

  const enabledCount = (agentId: string) => getRulesForAgent(agentId).filter((r) => r.enabled).length;

  return (
    <div className="shell">
      <header className="hdr">
        <div className="hdr-brand" style={{ cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
          <img src="/assets/kovan-icon.svg" alt="Kovan" style={{ height: 32 }} />
          <span className="hdr-title">Kovan</span>
        </div>
        <div className="hdr-stats">
          <div className="hdr-kv">
            <span className="hdr-k">Ayarlar</span>
            <span className="hdr-v"><GearIcon size={14} /></span>
          </div>
        </div>
        <div className="hdr-user">
          <NotificationBell />
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
          <button className="hdr-logout" onClick={() => logout().then(() => navigate("/login"))}>
            <SignOutIcon size={14} />
            Çıkış
          </button>
        </div>
      </header>

      <div className="settings-page">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 className="settings-title">
            <GearIcon size={18} weight="duotone" />
            Bildirim Ayarları
          </h1>
          <button className="settings-back" onClick={() => navigate("/dashboard")}>
            <ArrowLeftIcon size={12} weight="bold" />
            Dashboard
          </button>
        </div>

        <div className="settings-grid">
          {/* Left: Telegram Config */}
          <section className="settings-section">
            <h2 className="settings-section-title">
              <TelegramLogoIcon size={16} weight="duotone" />
              Telegram
            </h2>
            <p className="settings-desc">
              Bot token ve chat ID girerek alarm bildirimleri alın.
            </p>
            <div className="settings-form">
              <div className="settings-field">
                <label>Bot Token</label>
                <input
                  type="password"
                  placeholder="123456789:ABCdef..."
                  value={settings.telegram_bot_token || ""}
                  onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value || null })}
                />
              </div>
              <div className="settings-field">
                <label>Chat ID</label>
                <input
                  type="text"
                  placeholder="-1001234567890"
                  value={settings.telegram_chat_id || ""}
                  onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value || null })}
                />
              </div>
              <div className="settings-field settings-toggle-row">
                <label>Bildirimler</label>
                <button
                  className={`settings-toggle ${settings.enabled ? "on" : ""}`}
                  onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                >
                  {settings.enabled ? <ToggleRightIcon size={22} weight="fill" /> : <ToggleLeftIcon size={22} />}
                  <span>{settings.enabled ? "Açık" : "Kapalı"}</span>
                </button>
              </div>
              <div className="settings-actions">
                <button className="settings-btn primary" onClick={saveSettings} disabled={saving}>
                  {saving ? <SpinnerGapIcon size={12} className="si-run" /> : <FloppyDiskIcon size={12} />}
                  Kaydet
                </button>
                <button
                  className="settings-btn secondary"
                  onClick={testTelegram}
                  disabled={testing || !settings.telegram_bot_token || !settings.telegram_chat_id}
                >
                  {testing ? <SpinnerGapIcon size={12} className="si-run" /> : <PaperPlaneRightIcon size={12} />}
                  Test
                </button>
              </div>
              {saveMsg && (
                <span className="settings-msg success">
                  <CheckCircleIcon size={12} weight="fill" /> {saveMsg}
                </span>
              )}
              {testResult && (
                <span className={`settings-msg ${testResult.ok ? "success" : "error"}`}>
                  {testResult.ok ? <CheckCircleIcon size={12} weight="fill" /> : <WarningCircleIcon size={12} weight="fill" />}
                  {testResult.msg}
                </span>
              )}
            </div>
          </section>

          {/* Right: Agent Rules — Accordion */}
          <section className="settings-section">
            <h2 className="settings-section-title">
              <ShieldCheckIcon size={16} weight="duotone" />
              Makine Alarm Kuralları
            </h2>
            <p className="settings-desc">
              Makineye tıklayarak kuralları düzenleyin. Ana toggle ile tüm alarmları açıp kapatın.
            </p>

            {agents.length === 0 ? (
              <div className="settings-empty">Henüz makine yok.</div>
            ) : (
              <div className="sa-list">
                {agents.map((agent) => {
                  const isOpen = expandedAgent === agent.id;
                  const rules = getRulesForAgent(agent.id);
                  const allEnabled = isAgentEnabled(agent.id);
                  const ec = enabledCount(agent.id);

                  return (
                    <div key={agent.id} className={`sa-item ${isOpen ? "sa-open" : ""}`}>
                      {/* Collapsed Row */}
                      <div className="sa-row">
                        <button
                          className="sa-expand"
                          onClick={() => setExpandedAgent(isOpen ? null : agent.id)}
                        >
                          <CaretRightIcon
                            size={12}
                            weight="bold"
                            className={`sa-caret ${isOpen ? "sa-caret-open" : ""}`}
                          />
                        </button>
                        <span className={`sa-dot ${agent.isOnline ? "on" : "off"}`}>
                          <CircleIcon size={7} weight="fill" />
                        </span>
                        <span
                          className="sa-name"
                          onClick={() => setExpandedAgent(isOpen ? null : agent.id)}
                        >
                          {agent.alias || agent.hostname}
                        </span>
                        <span className="sa-id">{agent.id}</span>
                        <span className="sa-badge">{ec}/{DEFAULT_RULES.length}</span>
                        <button
                          className={`sa-master-toggle ${allEnabled ? "on" : ""}`}
                          onClick={(e) => { e.stopPropagation(); toggleAgentAll(agent.id); }}
                          title={allEnabled ? "Tüm alarmları kapat" : "Tüm alarmları aç"}
                        >
                          {allEnabled
                            ? <ToggleRightIcon size={20} weight="fill" />
                            : <ToggleLeftIcon size={20} />
                          }
                        </button>
                      </div>

                      {/* Expanded Rules */}
                      {isOpen && (
                        <div className="sa-detail">
                          <div className="sa-rules">
                            {rules.map((rule) => {
                              const meta = RULE_META[rule.rule_type];
                              return (
                                <div key={rule.rule_type} className="sa-rule">
                                  <span className="sa-rule-icon">{meta?.icon}</span>
                                  <span className="sa-rule-name">{meta?.label}</span>
                                  {meta?.hasThreshold ? (
                                    <div className="sa-rule-field">
                                      <span className="sa-rule-lbl">%</span>
                                      <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={rule.threshold}
                                        onChange={(e) => updateRule(agent.id, rule.rule_type, "threshold", Number(e.target.value))}
                                      />
                                    </div>
                                  ) : (
                                    <div className="sa-rule-field">
                                      <span className="sa-rule-na">—</span>
                                    </div>
                                  )}
                                  <div className="sa-rule-field">
                                    <span className="sa-rule-lbl">dk</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={1440}
                                      value={rule.cooldown_minutes}
                                      onChange={(e) => updateRule(agent.id, rule.rule_type, "cooldown_minutes", Number(e.target.value))}
                                    />
                                  </div>
                                  <button
                                    className={`sa-rule-toggle ${rule.enabled ? "on" : ""}`}
                                    onClick={() => updateRule(agent.id, rule.rule_type, "enabled", !rule.enabled)}
                                  >
                                    {rule.enabled
                                      ? <ToggleRightIcon size={18} weight="fill" />
                                      : <ToggleLeftIcon size={18} />
                                    }
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            className="settings-btn primary sa-save"
                            onClick={() => saveAgentRules(agent.id)}
                            disabled={ruleSaving === agent.id}
                          >
                            {ruleSaving === agent.id
                              ? <SpinnerGapIcon size={12} className="si-run" />
                              : <FloppyDiskIcon size={12} />
                            }
                            Kaydet
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
