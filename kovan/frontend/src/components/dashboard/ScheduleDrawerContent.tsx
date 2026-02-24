import { useState, useEffect } from "react";
import {
  fetchSchedules,
  createSchedule,
  toggleSchedule,
  deleteSchedule,
  runTaskNow,
  fetchTaskRuns,
  type ScheduledTask,
  type TaskRun,
} from "../../api";
import {
  PlusIcon,
  PlayIcon,
  TrashIcon,
  ClockCountdownIcon,
  ClockClockwiseIcon,
  SpinnerGapIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  MinusCircleIcon,
  CalendarBlankIcon,
  TimerIcon,
} from "@phosphor-icons/react";

const CRON_PRESETS = [
  { label: "Her 5 dk", cron: "*/5 * * * *" },
  { label: "Her 15 dk", cron: "*/15 * * * *" },
  { label: "Her saat", cron: "0 * * * *" },
  { label: "Her gün 03:00", cron: "0 3 * * *" },
  { label: "Haftalık Pzt", cron: "0 2 * * 1" },
];

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso?: string): string {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "gecikmiş";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "< 1 dk";
  if (mins < 60) return `${mins} dk`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa ${mins % 60}dk`;
  return `${Math.floor(hrs / 24)} gün`;
}

function describeSchedule(task: ScheduledTask): string {
  if (task.cronExpr) return task.cronExpr;
  if (task.intervalSeconds) {
    const s = task.intervalSeconds;
    if (s < 60) return `Her ${s}s`;
    if (s < 3600) return `Her ${Math.floor(s / 60)}dk`;
    if (s < 86400) return `Her ${Math.floor(s / 3600)}sa`;
    return `Her ${Math.floor(s / 86400)} gün`;
  }
  return "—";
}

export function ScheduleDrawerContent({
  agentId,
  agentName: _agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<string | null>(null);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [schedType, setSchedType] = useState<"cron" | "interval">("cron");
  const [cronExpr, setCronExpr] = useState("0 * * * *");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    try {
      const all = await fetchSchedules();
      setTasks(all.filter((t) => t.targetType === "agent" && t.targetId === agentId));
    } catch {
      // table may not exist
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const iv = setInterval(loadTasks, 5000);
    return () => clearInterval(iv);
  }, [agentId]);

  const handleCreate = async () => {
    if (!name.trim() || !command.trim()) return;
    setSaving(true);
    try {
      await createSchedule({
        name: name.trim(),
        command: command.trim(),
        cronExpr: schedType === "cron" ? cronExpr : undefined,
        intervalSeconds: schedType === "interval" ? intervalMinutes * 60 : undefined,
        targetType: "agent",
        targetId: agentId,
      });
      setName("");
      setCommand("");
      setShowForm(false);
      await loadTasks();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleSchedule(id);
      await loadTasks();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteSchedule(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  const handleRunNow = async (id: string) => {
    try {
      await runTaskNow(id);
      await loadTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExpandRuns = async (taskId: string) => {
    if (expandedRuns === taskId) { setExpandedRuns(null); return; }
    setExpandedRuns(taskId);
    setRunsLoading(true);
    try {
      setRuns(await fetchTaskRuns(taskId, 15));
    } catch {} finally {
      setRunsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sched-drawer-loading">
        <SpinnerGapIcon size={20} className="si-run" />
      </div>
    );
  }

  return (
    <div className="sched-drawer">
      {/* Task List */}
      {tasks.length === 0 && !showForm ? (
        <div className="sched-drawer-empty">
          <ClockCountdownIcon size={32} weight="duotone" style={{ opacity: 0.3 }} />
          <span>Bu agent için zamanlanmış görev yok</span>
          <button className="sched-drawer-add-btn" onClick={() => setShowForm(true)}>
            <PlusIcon size={12} weight="bold" />
            Görev Ekle
          </button>
        </div>
      ) : (
        <>
          <div className="sched-drawer-list">
            {tasks.map((task) => (
              <div key={task.id} className={`sched-drawer-item ${!task.enabled ? "disabled" : ""}`}>
                <div className="sched-drawer-item-main">
                  <button
                    className={`sched-toggle ${task.enabled ? "on" : ""}`}
                    onClick={() => handleToggle(task.id)}
                    title={task.enabled ? "Devre dışı bırak" : "Etkinleştir"}
                  />
                  <div className="sched-drawer-item-info">
                    <span className="sched-drawer-item-name">{task.name}</span>
                    <span className="sched-drawer-item-cmd">{task.command}</span>
                  </div>
                  <div className="sched-drawer-item-sched">
                    <span className="sched-drawer-item-cron">{describeSchedule(task)}</span>
                    {task.enabled && task.nextRunAt && (
                      <span className="sched-drawer-item-next">Sonraki: {formatRelative(task.nextRunAt)}</span>
                    )}
                  </div>
                  <div className="sched-drawer-item-actions">
                    <button className="sched-act" title="Geçmiş" onClick={() => handleExpandRuns(task.id)}>
                      <ClockClockwiseIcon size={13} />
                    </button>
                    <button className="sched-act play" title="Şimdi çalıştır" onClick={() => handleRunNow(task.id)}>
                      <PlayIcon size={13} weight="fill" />
                    </button>
                    <button className="sched-act danger" title="Sil" onClick={() => handleDelete(task.id)}>
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
                {/* Run History Expansion */}
                {expandedRuns === task.id && (
                  <div className="sched-drawer-runs">
                    {runsLoading ? (
                      <div className="sched-drawer-loading" style={{ padding: 8 }}>
                        <SpinnerGapIcon size={14} className="si-run" />
                      </div>
                    ) : runs.length === 0 ? (
                      <span className="sched-drawer-runs-empty">Henüz çalışmadı</span>
                    ) : (
                      runs.map((run) => (
                        <div key={run.id} className="sched-drawer-run">
                          <span className={`sched-run-status ${run.status}`}>
                            {run.status === "completed" && <CheckCircleIcon size={10} />}
                            {run.status === "error" && <WarningCircleIcon size={10} />}
                            {run.status === "skipped" && <MinusCircleIcon size={10} />}
                            {run.status === "running" && <SpinnerGapIcon size={10} className="si-run" />}
                            {" "}{run.status}
                          </span>
                          {run.error && <span style={{ color: "var(--red)", fontSize: 10 }}>{run.error}</span>}
                          <span className="sched-run-time">{formatDate(run.startedAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!showForm && (
            <button className="sched-drawer-add-btn bottom" onClick={() => setShowForm(true)}>
              <PlusIcon size={12} weight="bold" />
              Yeni Görev Ekle
            </button>
          )}
        </>
      )}

      {/* Inline Create Form */}
      {showForm && (
        <div className="sched-drawer-form">
          <div className="sched-drawer-form-title">
            <ClockCountdownIcon size={14} />
            Yeni Zamanlanmış Görev
          </div>
          <div className="sched-field">
            <label>Görev Adı</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Disk Temizliği" />
          </div>
          <div className="sched-field">
            <label>Komut</label>
            <input type="text" className="mono" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="apt autoremove -y" />
          </div>
          <div className="sched-field">
            <label>Zamanlama</label>
            <div className="sched-type-tabs">
              <button className={`sched-type-tab ${schedType === "cron" ? "active" : ""}`} onClick={() => setSchedType("cron")}>
                <CalendarBlankIcon size={11} style={{ marginRight: 3 }} /> Cron
              </button>
              <button className={`sched-type-tab ${schedType === "interval" ? "active" : ""}`} onClick={() => setSchedType("interval")}>
                <TimerIcon size={11} style={{ marginRight: 3 }} /> Aralık
              </button>
            </div>
          </div>
          {schedType === "cron" ? (
            <div className="sched-field">
              <input type="text" className="mono" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="0 * * * *" />
              <div className="sched-presets">
                {CRON_PRESETS.map((p) => (
                  <button key={p.cron} className={`sched-preset ${cronExpr === p.cron ? "active" : ""}`} onClick={() => setCronExpr(p.cron)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="sched-field">
              <label>Aralık (dakika)</label>
              <input type="number" min={1} value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))} />
            </div>
          )}
          <div className="sched-drawer-form-actions">
            <button className="sched-btn secondary" onClick={() => setShowForm(false)}>İptal</button>
            <button
              className="sched-btn primary"
              disabled={!name.trim() || !command.trim() || saving}
              onClick={handleCreate}
            >
              {saving && <SpinnerGapIcon size={11} className="si-run" />}
              Oluştur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
