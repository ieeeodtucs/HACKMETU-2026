import { useState, useEffect, useRef } from "react";
import type { Agent } from "@kovan/shared";
import { timeAgo, isWindows } from "./helpers";
import { fetchGroups, setAgentGroup, createGroup, type GroupInfo } from "../../api";
import {
  DesktopTowerIcon,
  UserIcon,
  GlobeSimpleIcon,
  ClockIcon,
  WifiHighIcon,
  WifiSlashIcon,
  LinuxLogoIcon,
  WindowsLogoIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  CpuIcon,
  MemoryIcon,
  TagIcon,
  PlusIcon,
  CaretDownIcon,
  XCircleIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react";

export function MachineInfo({ agent, onRename }: { agent: Agent; onRename: (id: string, alias: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(agent.alias || "");

  // Group
  const [groupOpen, setGroupOpen] = useState(false);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [newName, setNewName] = useState("");
  const groupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGroups().then(setGroups).catch(console.error);
  }, [agent.group]);

  useEffect(() => {
    if (!groupOpen) return;
    const h = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setGroupOpen(false);
        setMode("list");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [groupOpen]);

  useEffect(() => {
    if (mode === "create" && inputRef.current) inputRef.current.focus();
  }, [mode]);

  return (
    <div className="mc-info">
      <div className="mc-info-header">
        <div className="mc-info-icon">
          {isWindows(agent) ? (
            <WindowsLogoIcon size={28} weight="bold" />
          ) : (
            <LinuxLogoIcon size={28} weight="bold" />
          )}
        </div>
        <div className="mc-info-text">
          <div className="mc-hostname-row">
            {editing ? (
              <form
                className="mc-rename-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  onRename(agent.id, editValue);
                  setEditing(false);
                }}
              >
                <input
                  className="mc-rename-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={agent.hostname}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
                <button type="submit" className="mc-rename-ok">
                  <CheckIcon size={13} weight="bold" />
                </button>
                <button type="button" className="mc-rename-cancel" onClick={() => setEditing(false)}>
                  <XIcon size={13} weight="bold" />
                </button>
              </form>
            ) : (
              <>
                <h2 className="mc-hostname">{agent.alias || agent.hostname}</h2>
                <button
                  className="mc-rename-btn"
                  title="İsim değiştir"
                  onClick={() => {
                    setEditValue(agent.alias || "");
                    setEditing(true);
                  }}
                >
                  <PencilSimpleIcon size={14} />
                </button>
              </>
            )}
          </div>
          {agent.alias && <span className="mc-hostname-orig">{agent.hostname}</span>}
          <span className="mc-os">{agent.os}</span>
        </div>
        <span className={`mc-status ${agent.isOnline ? "on" : "off"}`}>
          {agent.isOnline ? (
            <>
              <WifiHighIcon size={13} /> Çevrimiçi
            </>
          ) : (
            <>
              <WifiSlashIcon size={13} /> Çevrimdışı
            </>
          )}
        </span>
      </div>

      <div className="mc-info-divider" />

      <div className="mc-info-grid">
        <div className="mc-info-item">
          <div className="mc-info-item-icon"><UserIcon size={14} /></div>
          <div className="mc-info-item-content">
            <span className="mc-info-k">Kullanıcı</span>
            <span className="mc-info-v">{agent.username}</span>
          </div>
        </div>
        <div className="mc-info-item">
          <div className="mc-info-item-icon"><GlobeSimpleIcon size={14} /></div>
          <div className="mc-info-item-content">
            <span className="mc-info-k">IP Adresi</span>
            <span className="mc-info-v mono">{agent.ip}</span>
          </div>
        </div>
        <div className="mc-info-item">
          <div className="mc-info-item-icon"><CpuIcon size={14} /></div>
          <div className="mc-info-item-content">
            <span className="mc-info-k">İşlemci</span>
            <span className="mc-info-v">{agent.cpuModel || "—"}</span>
          </div>
        </div>
        <div className="mc-info-item">
          <div className="mc-info-item-icon"><MemoryIcon size={14} /></div>
          <div className="mc-info-item-content">
            <span className="mc-info-k">Bellek</span>
            <span className="mc-info-v">
              {agent.totalMemMB ? `${(agent.totalMemMB / 1024).toFixed(1)} GB` : "—"}
            </span>
          </div>
        </div>
        <div className="mc-info-item">
          <div className="mc-info-item-icon"><ClockIcon size={14} /></div>
          <div className="mc-info-item-content">
            <span className="mc-info-k">Son Görülme</span>
            <span className="mc-info-v">{timeAgo(agent.lastSeen)}</span>
          </div>
        </div>
        <div className="mc-info-item">
          <div className="mc-info-item-icon"><DesktopTowerIcon size={14} /></div>
          <div className="mc-info-item-content">
            <span className="mc-info-k">Makine ID</span>
            <span className="mc-info-v mono">{agent.id}</span>
          </div>
        </div>

        {/* ─── Group ─── */}
        <div className="mc-info-item mc-group-item" ref={groupRef}>
          <div className="mc-info-item-icon"><TagIcon size={14} /></div>
          <div className="mc-info-item-content">
            <span className="mc-info-k">Grup</span>
            <button
              className={`gpk-trigger mc-gpk ${agent.group ? "assigned" : ""} ${groupOpen ? "active" : ""}`}
              onClick={() => { setGroupOpen(!groupOpen); setMode("list"); setNewName(""); }}
              style={{ opacity: 1 }}
            >
              <TagIcon size={10} weight={agent.group ? "fill" : "regular"} />
              <span className="gpk-trigger-label">{agent.group || "Grup seç..."}</span>
              <CaretDownIcon size={9} className={`gpk-caret ${groupOpen ? "flipped" : ""}`} />
            </button>

            {groupOpen && (
              <div className="gpk-popover mc-gpk-popover">
                <div className="gpk-header">
                  <TagIcon size={13} weight="bold" />
                  <span>Grup Ata</span>
                </div>

                {mode === "list" ? (
                  <>
                    {groups.length > 0 ? (
                      <div className="gpk-options">
                        {groups.map((g) => {
                          const isCurrent = agent.group === g.name;
                          return (
                            <button
                              key={g.name}
                              className={`gpk-opt ${isCurrent ? "current" : ""}`}
                              onClick={async () => {
                                await setAgentGroup(agent.id, g.name);
                                setGroupOpen(false);
                              }}
                            >
                              <div className={`gpk-opt-dot ${isCurrent ? "on" : ""}`} />
                              <span className="gpk-opt-name">{g.name}</span>
                              <span className="gpk-opt-meta">{g.total} makine</span>
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
                    <button className="gpk-action gpk-action-create" onClick={() => setMode("create")}>
                      <PlusIcon size={13} weight="bold" />
                      <span>Yeni grup oluştur</span>
                    </button>
                    {agent.group && (
                      <button className="gpk-action gpk-action-remove" onClick={async () => {
                        await setAgentGroup(agent.id, "");
                        setGroupOpen(false);
                      }}>
                        <XCircleIcon size={13} weight="bold" />
                        <span>Gruptan çıkar</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="gpk-create">
                    <span className="gpk-create-label">Grup adı</span>
                    <form className="gpk-create-row" onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newName.trim()) return;
                      await createGroup(newName.trim());
                      await setAgentGroup(agent.id, newName.trim());
                      setGroupOpen(false);
                      setMode("list");
                      setNewName("");
                    }}>
                      <input
                        ref={inputRef}
                        className="gpk-create-input"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder='ör. "Lab-1"'
                        maxLength={40}
                        onKeyDown={(e) => { if (e.key === "Escape") setMode("list"); }}
                      />
                      <button type="submit" className="gpk-create-ok" disabled={!newName.trim()}>
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
        </div>
      </div>
    </div>
  );
}
