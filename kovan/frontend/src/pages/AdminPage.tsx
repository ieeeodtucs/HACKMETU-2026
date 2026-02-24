import { useState, useEffect } from "react";
import { authClient } from "../auth-client";
import { fetchAgents } from "../api";
import { useNavigate } from "react-router";
import { useAuthStore } from "../store";
import type { Agent } from "@kovan/shared";
import {
  ShieldCheckIcon,
  UserIcon,
  CrownIcon,
  ProhibitIcon,
  CheckCircleIcon,
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  EnvelopeSimpleIcon,
  CalendarIcon,
  CircleIcon,
  DesktopTowerIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role?: string;
  banned?: boolean;
  createdAt: string;
}

const BASE = "/api";
const opts: RequestInit = { credentials: "include" };

async function fetchPermissions(userId: string): Promise<string[]> {
  const res = await fetch(`${BASE}/permissions/user/${userId}`, opts);
  const data = await res.json();
  return data.agentIds || [];
}

async function grantPermission(userId: string, agentId: string) {
  await fetch(`${BASE}/permissions`, {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, agentId }),
  });
}

async function revokePermission(userId: string, agentId: string) {
  await fetch(`${BASE}/permissions`, {
    ...opts,
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, agentId }),
  });
}

/* ───── User Row with Agent Permissions ───── */

function UserRow({
  u,
  agents,
  currentUserId,
  onRoleChange,
  onBan,
  onUnban,
}: {
  u: UserRecord;
  agents: Agent[];
  currentUserId: string;
  onRoleChange: (userId: string, role: "user" | "admin") => void;
  onBan: (userId: string) => void;
  onUnban: (userId: string) => void;
}) {
  const isSelf = u.id === currentUserId;
  const [expanded, setExpanded] = useState(false);
  const [permitted, setPermitted] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPerms = async () => {
    setLoading(true);
    const ids = await fetchPermissions(u.id);
    setPermitted(ids);
    setLoading(false);
  };

  useEffect(() => {
    if (expanded) loadPerms();
  }, [expanded]);

  const toggleAgent = async (agentId: string) => {
    if (permitted.includes(agentId)) {
      await revokePermission(u.id, agentId);
      setPermitted((prev) => prev.filter((id) => id !== agentId));
    } else {
      await grantPermission(u.id, agentId);
      setPermitted((prev) => [...prev, agentId]);
    }
  };

  const isAdmin = u.role === "admin";

  return (
    <>
      <tr className={u.banned ? "row-banned" : ""}>
        <td>
          <div className="user-cell">
            <UserIcon size={14} />
            <span>{u.name || "—"}</span>
          </div>
        </td>
        <td>
          <div className="user-cell">
            <EnvelopeSimpleIcon size={14} />
            <span>{u.email}</span>
          </div>
        </td>
        <td>
          <span className={`role-badge ${isAdmin ? "role-admin" : "role-user"}`}>
            {isAdmin ? <CrownIcon size={12} weight="fill" /> : <UserIcon size={12} />}
            {u.role || "user"}
          </span>
        </td>
        <td>
          <span className={`status-badge ${u.banned ? "st-banned" : "st-active"}`}>
            <CircleIcon size={8} weight="fill" />
            {u.banned ? "Yasaklı" : "Aktif"}
          </span>
        </td>
        <td>
          <div className="user-cell">
            <CalendarIcon size={14} />
            <span>{new Date(u.createdAt).toLocaleDateString("tr-TR")}</span>
          </div>
        </td>
        <td>
          <div className="action-btns">
            {!isAdmin && (
              <button
                className="act-btn act-agents"
                onClick={() => setExpanded(!expanded)}
                title="Agent izinleri"
              >
                <DesktopTowerIcon size={13} />
                {expanded ? "Kapat" : "İzinler"}
                {!isAdmin && permitted.length > 0 && !expanded && (
                  <span className="perm-count">{permitted.length}</span>
                )}
              </button>
            )}
            {!isSelf && (
              !isAdmin ? (
                <button className="act-btn act-promote" onClick={() => onRoleChange(u.id, "admin")} title="Admin yap">
                  <CrownIcon size={13} /> Admin
                </button>
              ) : (
                <button className="act-btn act-demote" onClick={() => onRoleChange(u.id, "user")} title="User yap">
                  <UserIcon size={13} /> User
                </button>
              )
            )}
            {!isSelf && (
              !u.banned ? (
                <button className="act-btn act-ban" onClick={() => onBan(u.id)} title="Yasakla">
                  <ProhibitIcon size={13} /> Ban
                </button>
              ) : (
                <button className="act-btn act-unban" onClick={() => onUnban(u.id)} title="Yasağı kaldır">
                  <CheckCircleIcon size={13} /> Unban
                </button>
              )
            )}
          </div>
        </td>
      </tr>
      {expanded && !isAdmin && (
        <tr className="perm-row">
          <td colSpan={6}>
            <div className="perm-panel">
              <div className="perm-title">
                <DesktopTowerIcon size={14} />
                <span>Agent İzinleri — {u.name || u.email}</span>
                {loading && <span className="perm-loading">yükleniyor...</span>}
              </div>
              {agents.length === 0 ? (
                <div className="perm-empty">Henüz bağlı agent yok</div>
              ) : (
                <div className="perm-grid">
                  {agents.map((a) => {
                    const has = permitted.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        className={`perm-chip ${has ? "granted" : ""}`}
                        onClick={() => toggleAgent(a.id)}
                      >
                        <span className={`sb-dot ${a.isOnline ? "on" : "off"}`} />
                        <DesktopTowerIcon size={12} />
                        <span className="perm-hostname">{a.hostname}</span>
                        <span className="perm-ip">{a.ip}</span>
                        {has ? <XIcon size={12} /> : <PlusIcon size={12} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ───── Admin Page ───── */

export default function AdminPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, agentsData] = await Promise.all([
        authClient.admin.listUsers({ query: { limit: 100 } }),
        fetchAgents(),
      ]);
      if (usersRes.data) setUsers(usersRes.data.users as UserRecord[]);
      setAgents(agentsData);
    } catch (e) {
      console.error("Failed to load:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetRole = async (userId: string, role: "user" | "admin") => {
    await authClient.admin.setRole({ userId, role });
    await loadData();
  };

  const handleBan = async (userId: string) => {
    await authClient.admin.banUser({ userId });
    await loadData();
  };

  const handleUnban = async (userId: string) => {
    await authClient.admin.unbanUser({ userId });
    await loadData();
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-header-l">
          <button className="btn-sm" onClick={() => navigate("/dashboard")} title="Dashboard'a dön">
            <ArrowLeftIcon size={14} />
          </button>
          <ShieldCheckIcon size={20} weight="duotone" />
          <span className="admin-title">Admin Panel</span>
          <span className="sb-badge">{users.length} kullanıcı</span>
          <span className="sb-badge">{agents.length} agent</span>
        </div>
        <button className="btn-sm" onClick={loadData} title="Yenile">
          <ArrowClockwiseIcon size={14} />
        </button>
      </div>

      <div className="admin-body">
        {loading ? (
          <div className="admin-loading">Yükleniyor...</div>
        ) : users.length === 0 ? (
          <div className="admin-loading">Kullanıcı bulunamadı</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Kayıt Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  agents={agents}
                  currentUserId={currentUser?.id ?? ""}
                  onRoleChange={handleSetRole}
                  onBan={handleBan}
                  onUnban={handleUnban}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
