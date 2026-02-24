import { useState, useEffect, useRef, useCallback } from "react";
import {
  startScreenStream,
  stopScreenStream,
  getScreenWebSocketUrl,
} from "../../api";
import {
  SpinnerGapIcon,
  WarningCircleIcon,
  MonitorIcon,
  XIcon,
  ArrowsOutIcon,
} from "@phosphor-icons/react";

export function ScreenDrawerContent({
  agentId,
  isOnline,
}: {
  agentId: string;
  isOnline: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "starting" | "streaming" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(5);
  const [frameCount, setFrameCount] = useState(0);
  const [_lastFrameTime, setLastFrameTime] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef(0);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      stopScreenStream(agentId).catch(() => {});
    };
  }, [agentId, cleanup]);

  useEffect(() => {
    if (status !== "streaming") return;
    const interval = setInterval(() => {
      setFrameCount(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const handleStart = async () => {
    setStatus("starting");
    setError(null);

    try {
      const res = await startScreenStream(agentId, fps, 40);
      if (!res.success) {
        setError(res.error || "Ekran akışı başlatılamadı");
        setStatus("error");
        return;
      }

      const url = getScreenWebSocketUrl(agentId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("streaming");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "screen_frame" && msg.data?.frame) {
            if (imgRef.current) {
              imgRef.current.src = "data:image/jpeg;base64," + msg.data.frame;
            }
            frameCountRef.current++;
            setLastFrameTime(msg.data.ts);
          } else if (msg.type === "screen_stopped") {
            setStatus("idle");
            cleanup();
          } else if (msg.type === "screen_error") {
            setError(msg.data?.error || "Bilinmeyen hata");
            setStatus("error");
            cleanup();
          }
        } catch {}
      };

      ws.onerror = () => {
        setError("WebSocket bağlantı hatası");
        setStatus("error");
      };

      ws.onclose = () => {
        if (status === "streaming") {
          setStatus("idle");
        }
        wsRef.current = null;
      };
    } catch (err: any) {
      setError(err.message || "Bağlantı hatası");
      setStatus("error");
    }
  };

  const handleStop = async () => {
    cleanup();
    try { await stopScreenStream(agentId); } catch {}
    setStatus("idle");
  };

  const handleFullscreen = () => {
    if (viewerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        viewerRef.current.requestFullscreen();
      }
    }
  };

  return (
    <div className="screen-container">
      <div className="screen-toolbar">
        {status === "idle" || status === "error" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="vuln-scan-btn"
              onClick={handleStart}
              disabled={!isOnline}
              style={{ gap: 5 }}
            >
              <MonitorIcon size={13} />
              Ekranı İzle
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              FPS:
              <select
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  color: "#fff",
                  padding: "2px 4px",
                  fontSize: 11,
                }}
              >
                <option value={2}>2</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
            </label>
          </div>
        ) : status === "starting" ? (
          <button className="vuln-scan-btn" disabled style={{ gap: 5 }}>
            <SpinnerGapIcon size={13} className="si-run" />
            Bağlanıyor...
          </button>
        ) : (
          <button
            className="vuln-scan-btn"
            onClick={handleStop}
            style={{ gap: 5, borderColor: "rgba(220,38,38,0.3)", background: "rgba(220,38,38,0.08)", color: "#ef5350" }}
          >
            <XIcon size={13} weight="bold" />
            Akışı Durdur
          </button>
        )}

        <div className="screen-status" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {status === "streaming" && (
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>
              {frameCount} FPS
            </span>
          )}
          {status === "streaming" ? (
            <span className="screen-status-badge live">
              <span className="screen-status-dot" />
              CANLI
            </span>
          ) : (
            <span className="screen-status-badge stopped">
              <span className="screen-status-dot" />
              {status === "starting" ? "Bağlanıyor" : "Kapalı"}
            </span>
          )}
        </div>
      </div>

      <div className="screen-viewer" ref={viewerRef}>
        {status === "idle" && !error && (
          <div className="screen-empty">
            <MonitorIcon size={48} weight="duotone" />
            <span>Ekran akışı başlatılmadı</span>
            <span className="screen-empty-sub">
              "Ekranı İzle" butonuna basarak uzak makinenin ekranını canlı izleyin.
              Agent'ta <code>gnome-screenshot</code> veya <code>scrot</code> kurulu olmalıdır.
            </span>
          </div>
        )}

        {status === "starting" && (
          <div className="screen-connecting">
            <SpinnerGapIcon size={40} className="si-run" />
            <span>Ekran akışı başlatılıyor...</span>
            <span className="screen-connecting-sub">
              Agent ekran yakalama aracını tespit ediyor
            </span>
          </div>
        )}

        {status === "error" && error && (
          <div className="screen-error-state">
            <WarningCircleIcon size={40} weight="fill" />
            <span>{error}</span>
            <span className="screen-empty-sub" style={{ color: "rgba(255,82,82,0.5)" }}>
              Şunlardan birinin agent'ta kurulu olduğundan emin olun:
              <code>sudo apt install gnome-screenshot</code> veya <code>sudo apt install scrot</code>
            </span>
          </div>
        )}

        <img
          ref={imgRef}
          alt="Uzak ekran"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: status === "streaming" ? "block" : "none",
            background: "#000",
          }}
        />

        {status === "streaming" && (
          <button className="screen-fullscreen-btn" onClick={handleFullscreen} title="Tam ekran">
            <ArrowsOutIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
