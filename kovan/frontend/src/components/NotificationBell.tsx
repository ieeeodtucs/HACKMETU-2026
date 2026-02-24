import { useState, useEffect, useRef } from "react";
import {
  BellIcon,
  BellRingingIcon,
  ChecksIcon,
  CircleIcon,
  WarningCircleIcon,
  WarningIcon,
  InfoIcon,
  ClockIcon,
  CpuIcon,
  MemoryIcon,
  HardDriveIcon,
  WifiSlashIcon,
  ShieldWarningIcon,
} from "@phosphor-icons/react";
import { useToast } from "./toast/ToastContainer";
import "./notification-bell.css";

interface AlertRecord {
  id: number;
  agent_id: string;
  rule_type: string;
  severity: string;
  message: string;
  detail: string | null;
  is_read: boolean;
  created_at: string;
}

const opts: RequestInit = { credentials: "include" };

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAD6}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, "")
    .replace(/^\s+/, "");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins}dk`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa`;
  return `${Math.floor(hrs / 24)}g`;
}

export function NotificationBell() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);
  const { addToast } = useToast();

  // Poll for alerts
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/alerts?limit=20", opts);
        const data = await res.json();
        if (data.success) {
          setAlerts(data.alerts || []);
          const newUnread = data.unreadCount || 0;

          // Show toast for NEW alerts
          if (newUnread > prevUnreadRef.current && prevUnreadRef.current >= 0) {
            const newAlerts = (data.alerts || []).filter((a: AlertRecord) => !a.is_read);
            // Show latest unread toast
            if (newAlerts.length > 0 && prevUnreadRef.current > 0) {
              const latest = newAlerts[0];
              const severity = latest.severity === "critical" ? "critical" : latest.severity === "warning" ? "warning" : "info";
              addToast(stripEmoji(stripHtml(latest.message)), severity as any);
            }
          }
          prevUnreadRef.current = newUnread;
          setUnreadCount(newUnread);
        }
      } catch {}
    };
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [addToast]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (id: number) => {
    await fetch(`/api/alerts/${id}/read`, { ...opts, method: "POST" });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    await fetch("/api/alerts/read-all", { ...opts, method: "POST" });
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const ruleTypeIcon = (ruleType: string, severity: string) => {
    const sevClass =
      severity === "critical" ? "notif-sev-critical" :
      severity === "warning" ? "notif-sev-warning" : "notif-sev-info";

    switch (ruleType) {
      case "cpu":
        return <CpuIcon size={16} weight="fill" className={sevClass} />;
      case "ram":
        return <MemoryIcon size={16} weight="fill" className={sevClass} />;
      case "disk":
        return <HardDriveIcon size={16} weight="fill" className={sevClass} />;
      case "offline":
        return <WifiSlashIcon size={16} weight="bold" className={sevClass} />;
      case "cve_critical":
        return <ShieldWarningIcon size={16} weight="fill" className={sevClass} />;
      default:
        return severity === "critical"
          ? <WarningCircleIcon size={16} weight="fill" className={sevClass} />
          : severity === "warning"
          ? <WarningIcon size={16} weight="fill" className={sevClass} />
          : <InfoIcon size={16} weight="fill" className={sevClass} />;
    }
  };

  return (
    <div className="notif-bell-wrap" ref={dropdownRef}>
      <button
        className={`notif-bell-btn ${unreadCount > 0 ? "notif-bell-active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Bildirimler"
      >
        {unreadCount > 0 ? (
          <BellRingingIcon size={18} weight="fill" />
        ) : (
          <BellIcon size={18} />
        )}
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Bildirimler</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={markAllRead} disabled={loading}>
                <ChecksIcon size={14} />
                Tümünü oku
              </button>
            )}
          </div>
          <div className="notif-list">
            {alerts.length === 0 ? (
              <div className="notif-empty">
                <BellIcon size={28} />
                <span>Henüz bildirim yok</span>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`notif-item ${!alert.is_read ? "notif-unread" : ""}`}
                  onClick={() => !alert.is_read && markRead(alert.id)}
                >
                  <div className="notif-item-icon">{ruleTypeIcon(alert.rule_type, alert.severity)}</div>
                  <div className="notif-item-content">
                    <div className="notif-item-msg">{stripEmoji(stripHtml(alert.message))}</div>
                    {alert.detail && <div className="notif-item-detail">{stripEmoji(stripHtml(alert.detail))}</div>}
                    <div className="notif-item-time">
                      <ClockIcon size={11} />
                      {timeAgo(alert.created_at)}
                    </div>
                  </div>
                  {!alert.is_read && (
                    <div className="notif-item-dot">
                      <CircleIcon size={8} weight="fill" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
