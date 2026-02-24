import { useState, useEffect, useRef } from "react";
import type { Agent } from "@kovan/shared";
import { timeAgo, isWindows } from "./helpers";
import {
  fetchGroups, setAgentGroup, broadcastCommand, createGroup,
  type BroadcastResult, type GroupInfo,
} from "../../api";
import {
  DesktopTowerIcon,
  UserIcon,
  GlobeSimpleIcon,
  ClockIcon,
  MonitorIcon,
  WifiHighIcon,
  WifiSlashIcon,
  MagnifyingGlassIcon,
  CircleIcon,
  TrashIcon,
  LinuxLogoIcon,
  WindowsLogoIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  CpuIcon,
  MemoryIcon,
  TagIcon,
  BroadcastIcon,
  PaperPlaneTiltIcon,
  XCircleIcon,
  PlusIcon,
  CaretDownIcon,
  FolderOpenIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

/* ═══ Group Picker Popover ═══ */
function GroupPicker({
  agent,
  groups,
  onSave,
}: {
  agent: Agent;
  groups: GroupInfo[];
  onSave: (agentId: string, group: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("list");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (mode === "create" && inputRef.current) inputRef.current.focus();
  }, [mode]);

  const select = async (group: string) => {
    await onSave(agent.id, group);
    setOpen(false);
    setMode("list");
    setNewGroup("");
  };

  const remove = async () => {
    await onSave(agent.id, "");
    setOpen(false);
  };

  const addNew = async () => {
    const v = newGroup.trim();
    if (!v) return;
    await createGroup(v);
    await onSave(agent.id, v);
    setOpen(false);
    setMode("list");
    setNewGroup("");
  };

  const toggle = () => {
    setOpen(!open);
    setMode("list");
    setNewGroup("");
  };

  return (
    <div className="gpk" ref={ref}>
      {/* Trigger */}
      <button className={`gpk-trigger ${agent.group ? "assigned" : ""} ${open ? "active" : ""}`} onClick={toggle}>
        {agent.group ? (
          <>
            <TagIcon size={10} weight="fill" />
            <span className="gpk-trigger-label">{agent.group}</span>
          </>
        ) : (
          <>
            <TagIcon size={10} />
            <span className="gpk-trigger-label">Grup ekle</span>
          </>
        )}
        <CaretDownIcon size={9} className={`gpk-caret ${open ? "flipped" : ""}`} />
      </button>

      {/* Popover */}
      {open && (
        <div className="gpk-popover">
          {/* Header */}
          <div className="gpk-header">
            <TagIcon size={13} weight="bold" />
            <span>Grup Ata</span>
          </div>

          {mode === "list" ? (
            <>
              {/* Groups list */}
              {groups.length > 0 ? (
                <div className="gpk-options">
                  {groups.map((g) => {
                    const isCurrent = agent.group === g.name;
                    return (
                      <button
                        key={g.name}
                        className={`gpk-opt ${isCurrent ? "current" : ""}`}
                        onClick={() => select(g.name)}
                      >
                        <div className={`gpk-opt-dot ${isCurrent ? "on" : ""}`} />
                        <span className="gpk-opt-name">{g.name}</span>
                        <span className="gpk-opt-meta">
                          {g.total} makine
                        </span>
                        {isCurrent && <CheckIcon size={13} weight="bold" className="gpk-opt-check" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="gpk-empty">
                  <FolderOpenIcon size={20} />
                  <span>Henüz grup yok</span>
                </div>
              )}

              <div className="gpk-sep" />

              {/* Create new */}
              <button className="gpk-action gpk-action-create" onClick={() => setMode("create")}>
                <PlusIcon size={13} weight="bold" />
                <span>Yeni grup oluştur</span>
              </button>

              {/* Remove from group */}
              {agent.group && (
                <button className="gpk-action gpk-action-remove" onClick={remove}>
                  <XCircleIcon size={13} weight="bold" />
                  <span>Gruptan çıkar</span>
                </button>
              )}
            </>
          ) : (
            /* Create mode */
            <div className="gpk-create">
              <span className="gpk-create-label">Grup adı</span>
              <form className="gpk-create-row" onSubmit={(e) => { e.preventDefault(); addNew(); }}>
                <input
                  ref={inputRef}
                  className="gpk-create-input"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder='ör. "Lab-1"'
                  maxLength={40}
                  onKeyDown={(e) => { if (e.key === "Escape") setMode("list"); }}
                />
                <button type="submit" className="gpk-create-ok" disabled={!newGroup.trim()}>
                  <CheckIcon size={13} weight="bold" />
                </button>
              </form>
              <button className="gpk-create-back" onClick={() => setMode("list")}>
                ← Geri
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ Dashboard Home ═══ */
export function DashboardHome({
  agents,
  onSelectAgent,
  isAdmin,
  onDeleteAgent,
  onRename,
}: {
  agents: Agent[];
  onSelectAgent: (id: string) => void;
  isAdmin: boolean;
  onDeleteAgent: (id: string) => void;
  onRename: (id: string, alias: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Groups
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastGroup, setBroadcastGroup] = useState("");
  const [broadcastCmd, setBroadcastCmd] = useState("");
  const [broadcastResults, setBroadcastResults] = useState<BroadcastResult[] | null>(null);
  const [broadcastSending, setBroadcastSending] = useState(false);

  useEffect(() => {
    fetchGroups().then(setGroups).catch(console.error);
  }, [agents]);

  const online = agents.filter((a) => a.isOnline).length;
  const offline = agents.length - online;
  const windowsCount = agents.filter((a) => isWindows(a)).length;
  const linuxCount = agents.length - windowsCount;

  const filtered = agents.filter((a) => {
    if (groupFilter && a.group !== groupFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      a.hostname.toLowerCase().includes(q) ||
      (a.alias && a.alias.toLowerCase().includes(q)) ||
      a.ip.includes(filter) ||
      a.username.toLowerCase().includes(q) ||
      (a.group && a.group.toLowerCase().includes(q))
    );
  });

  const handleGroupSave = async (agentId: string, group: string) => {
    await setAgentGroup(agentId, group);
  };

  const handleBroadcast = async () => {
    if (!broadcastGroup || !broadcastCmd.trim()) return;
    setBroadcastSending(true);
    try {
      const res = await broadcastCommand(broadcastGroup, broadcastCmd.trim());
      setBroadcastResults(res.results || []);
    } catch (err) {
      console.error("Broadcast error:", err);
    } finally {
      setBroadcastSending(false);
    }
  };

  return (
    <div className="dash-home">
      {/* Stats Row */}
      <div className="dash-stats">
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-blue">
            <MonitorIcon size={22} weight="duotone" />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-value">{agents.length}</span>
            <span className="dash-stat-label">Toplam Makine</span>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-green">
            <WifiHighIcon size={22} weight="duotone" />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-value">{online}</span>
            <span className="dash-stat-label">Çevrimiçi</span>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-red">
            <WifiSlashIcon size={22} weight="duotone" />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-value">{offline}</span>
            <span className="dash-stat-label">Çevrimdışı</span>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-amber">
            <LinuxLogoIcon size={22} weight="duotone" />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-value">{linuxCount}</span>
            <span className="dash-stat-label">Linux</span>
          </div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-icon dash-stat-purple">
            <WindowsLogoIcon size={22} weight="duotone" />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-value">{windowsCount}</span>
            <span className="dash-stat-label">Windows</span>
          </div>
        </div>
      </div>

      {/* ─── Group Toolbar ─── */}
      {groups.length > 0 && (
        <div className="gtb">
          <div className="gtb-filters">
            <button
              className={`gtb-pill ${groupFilter === null ? "on" : ""}`}
              onClick={() => setGroupFilter(null)}
            >
              <UsersThreeIcon size={13} weight="bold" />
              Tümü
              <span className="gtb-pill-n">{agents.length}</span>
            </button>
            {groups.map((g) => (
              <button
                key={g.name}
                className={`gtb-pill ${groupFilter === g.name ? "on" : ""}`}
                onClick={() => setGroupFilter(groupFilter === g.name ? null : g.name)}
              >
                <TagIcon size={12} weight={groupFilter === g.name ? "fill" : "regular"} />
                {g.name}
                <span className="gtb-pill-n">{g.total}</span>
                {g.online > 0 && <span className="gtb-pill-online" title={`${g.online} çevrimiçi`} />}
              </button>
            ))}
          </div>
          <button
            className={`gtb-broadcast ${showBroadcast ? "on" : ""}`}
            onClick={() => { setShowBroadcast(!showBroadcast); setBroadcastResults(null); }}
          >
            <BroadcastIcon size={14} weight="bold" />
            <span>Toplu Komut</span>
          </button>
        </div>
      )}

      {/* ─── Broadcast Drawer ─── */}
      {showBroadcast && (
        <div className="bcast">
          <div className="bcast-top">
            <div className="bcast-title">
              <BroadcastIcon size={15} weight="fill" />
              Gruba Toplu Komut
            </div>
            <button className="bcast-close" onClick={() => { setShowBroadcast(false); setBroadcastResults(null); }}>
              <XIcon size={14} />
            </button>
          </div>

          <div className="bcast-body">
            {/* Group pills as selector */}
            <div className="bcast-groups">
              {groups.map((g) => (
                <button
                  key={g.name}
                  className={`bcast-gpill ${broadcastGroup === g.name ? "on" : ""}`}
                  onClick={() => { setBroadcastGroup(broadcastGroup === g.name ? "" : g.name); setBroadcastResults(null); }}
                >
                  <TagIcon size={11} weight={broadcastGroup === g.name ? "fill" : "regular"} />
                  {g.name}
                  <span className="bcast-gpill-info">{g.online}/{g.total}</span>
                </button>
              ))}
            </div>

            {/* Command input */}
            <div className="bcast-cmd">
              <span className="bcast-cmd-prompt">$</span>
              <input
                type="text"
                className="bcast-cmd-input"
                placeholder={broadcastGroup ? `"${broadcastGroup}" grubuna komut...` : "Önce grup seç..."}
                value={broadcastCmd}
                onChange={(e) => setBroadcastCmd(e.target.value)}
                disabled={!broadcastGroup}
                onKeyDown={(e) => { if (e.key === "Enter" && !broadcastSending) handleBroadcast(); }}
              />
              <button
                className="bcast-cmd-send"
                onClick={handleBroadcast}
                disabled={!broadcastGroup || !broadcastCmd.trim() || broadcastSending}
              >
                <PaperPlaneTiltIcon size={14} weight="fill" />
              </button>
            </div>
          </div>

          {/* Results */}
          {broadcastResults && (
            <div className="bcast-results">
              <div className="bcast-results-hdr">
                Sonuçlar — {broadcastResults.filter((r) => r.success).length}/{broadcastResults.length} başarılı
              </div>
              {broadcastResults.map((r) => (
                <div key={r.agentId} className={`bcast-row ${r.success ? "ok" : "fail"}`}>
                  <CircleIcon size={6} weight="fill" />
                  <span className="bcast-row-name">{r.hostname}</span>
                  <span className="bcast-row-status">
                    {r.success ? "Gönderildi" : r.error}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Machines Section */}
      <div className="dash-section">
        <div className="dash-section-header">
          <div className="dash-section-title">
            <DesktopTowerIcon size={16} weight="bold" />
            <h2>Makineler</h2>
            {groupFilter && (
              <span className="dash-section-filter-badge">
                <TagIcon size={12} />
                {groupFilter}
                <button onClick={() => setGroupFilter(null)}><XCircleIcon size={14} /></button>
              </span>
            )}
          </div>
          <div className="dash-search">
            <MagnifyingGlassIcon size={14} />
            <input
              type="text"
              placeholder="Makine ara..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="dash-empty">
            <MonitorIcon size={48} />
            <p>{agents.length === 0 ? "Henüz erişiminiz olan makine yok" : "Makine bulunamadı"}</p>
            <span>Agent'lar bağlandığında burada görünecek</span>
          </div>
        ) : (
          <div className="dash-grid">
            {filtered.map((agent) => (
              <div
                key={agent.id}
                className={`dash-agent-card ${agent.isOnline ? "" : "dash-agent-offline"}`}
                onClick={() => onSelectAgent(agent.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onSelectAgent(agent.id); }}
              >
                <div className="dash-agent-top">
                  <div className="dash-agent-os-icon">
                    {isWindows(agent) ? (
                      <WindowsLogoIcon size={24} weight="bold" />
                    ) : (
                      <LinuxLogoIcon size={24} weight="bold" />
                    )}
                  </div>
                  <span className={`dash-agent-status ${agent.isOnline ? "on" : "off"}`}>
                    <CircleIcon size={7} weight="fill" />
                    {agent.isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                  </span>
                  {isAdmin && (
                    <span
                      className="dash-agent-delete"
                      title="Makineyi sil"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${agent.hostname}" silinsin mi?`)) onDeleteAgent(agent.id);
                      }}
                    >
                      <TrashIcon size={13} />
                    </span>
                  )}
                </div>

                <div className="dash-agent-name-row">
                  {editingId === agent.id ? (
                    <form
                      className="dash-agent-rename"
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={(e) => {
                        e.preventDefault();
                        onRename(agent.id, editValue);
                        setEditingId(null);
                      }}
                    >
                      <input
                        className="dash-rename-input"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder={agent.hostname}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button type="submit" className="dash-rename-ok">
                        <CheckIcon size={12} weight="bold" />
                      </button>
                      <button type="button" className="dash-rename-cancel" onClick={() => setEditingId(null)}>
                        <XIcon size={12} weight="bold" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="dash-agent-name">
                        {agent.alias || agent.hostname}
                      </div>
                      <button
                        className="dash-rename-btn"
                        title="İsim değiştir"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditValue(agent.alias || "");
                          setEditingId(agent.id);
                        }}
                      >
                        <PencilSimpleIcon size={12} />
                      </button>
                    </>
                  )}
                </div>
                {agent.alias && (
                  <div className="dash-agent-hostname-sub">{agent.hostname}</div>
                )}
                <div className="dash-agent-os-text">{agent.os}</div>

                {/* Group picker */}
                <div className="dash-agent-group-row" onClick={(e) => e.stopPropagation()}>
                  <GroupPicker agent={agent} groups={groups} onSave={handleGroupSave} />
                </div>

                <div className="dash-agent-details">
                  <div className="dash-agent-detail">
                    <UserIcon size={12} />
                    <span>{agent.username}</span>
                  </div>
                  <div className="dash-agent-detail">
                    <GlobeSimpleIcon size={12} />
                    <span>{agent.ip}</span>
                  </div>
                  <div className="dash-agent-detail">
                    <CpuIcon size={12} />
                    <span>{agent.cpuModel ? agent.cpuModel.split(" ").slice(0, 3).join(" ") : "—"}</span>
                  </div>
                  <div className="dash-agent-detail">
                    <MemoryIcon size={12} />
                    <span>{agent.totalMemMB ? `${(agent.totalMemMB / 1024).toFixed(1)} GB RAM` : "—"}</span>
                  </div>
                </div>

                <div className="dash-agent-footer">
                  <span className="dash-agent-id">{agent.id}</span>
                  <span className="dash-agent-seen">
                    <ClockIcon size={11} /> {timeAgo(agent.lastSeen)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
