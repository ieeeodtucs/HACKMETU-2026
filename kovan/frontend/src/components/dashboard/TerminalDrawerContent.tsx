import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import {
  PlayIcon,
  StopIcon,
  SpinnerGapIcon,
  ArrowClockwiseIcon,
  TerminalWindowIcon,
  WarningCircleIcon,
  CommandIcon,
} from "@phosphor-icons/react";

interface Props {
  agentId: string;
  isOnline: boolean;
}

type Status = "idle" | "connecting" | "connected" | "error" | "closed";

export function TerminalDrawerContent({ agentId, isOnline }: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<Status>("idle");
  const [status, setStatus] = useState<Status>("idle");
  const [shell, setShell] = useState<string>("");
  const [error, setError] = useState<string>("");

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };

  // Cleanup terminal
  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }
    fitAddonRef.current = null;
  }, []);

  // Start terminal session
  const startTerminal = useCallback(async () => {
    cleanup();
    setStatusBoth("connecting");
    setError("");

    // Create xterm.js terminal
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: "#0a0a0f",
        foreground: "#e0e0e8",
        cursor: "#ffcb08",
        cursorAccent: "#0a0a0f",
        selectionBackground: "rgba(255, 203, 8, 0.2)",
        selectionForeground: "#ffffff",
        black: "#1a1a2e",
        red: "#ff1744",
        green: "#00e676",
        yellow: "#ffcb08",
        blue: "#448aff",
        magenta: "#e040fb",
        cyan: "#18ffff",
        white: "#e0e0e8",
        brightBlack: "#4a4a5e",
        brightRed: "#ff5252",
        brightGreen: "#69f0ae",
        brightYellow: "#ffd740",
        brightBlue: "#82b1ff",
        brightMagenta: "#ea80fc",
        brightCyan: "#84ffff",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    if (termRef.current) {
      term.open(termRef.current);
      setTimeout(() => fitAddon.fit(), 50);
    }

    term.writeln("\x1b[1;33m⚡ Kovan Terminal\x1b[0m");
    term.writeln("\x1b[2m   Bağlanılıyor...\x1b[0m");
    term.writeln("");

    // Start PTY via REST
    try {
      const rows = term.rows;
      const cols = term.cols;

      const res = await fetch(`/api/agents/${agentId}/terminal/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, cols }),
      });
      const data = await res.json();
      if (!data.success) {
        setStatusBoth("error");
        setError(data.error || "Terminal başlatılamadı");
        term.writeln(`\x1b[1;31m✗ Hata: ${data.error || "Bilinmeyen hata"}\x1b[0m`);
        return;
      }
    } catch (err: any) {
      setStatusBoth("error");
      setError(err.message);
      term.writeln(`\x1b[1;31m✗ Bağlantı hatası: ${err.message}\x1b[0m`);
      return;
    }

    // Connect WebSocket for terminal relay
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${proto}//${host}/ws/terminal?agentId=${agentId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[TERMINAL] WebSocket bağlandı");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "pty_started":
            setStatusBoth("connected");
            setShell(msg.data?.shell || "shell");
            term.clear();
            break;
          case "pty_output":
            if (msg.data?.output) {
              term.write(msg.data.output);
            }
            break;
          case "pty_stopped":
            setStatusBoth("closed");
            term.writeln("");
            term.writeln("\x1b[1;33m⚠ Terminal oturumu kapatıldı.\x1b[0m");
            break;
          case "pty_exit":
            setStatusBoth("closed");
            term.writeln("");
            term.writeln(`\x1b[1;33m⚠ Shell kapandı: ${msg.data?.reason || "bilinmeyen"}\x1b[0m`);
            break;
          case "pty_error":
            setStatusBoth("error");
            setError(msg.data?.error || "Bilinmeyen hata");
            term.writeln(`\x1b[1;31m✗ Hata: ${msg.data?.error}\x1b[0m`);
            break;
        }
      } catch (e) {
        console.error("[TERMINAL] Parse hatası:", e);
      }
    };

    ws.onclose = () => {
      console.log("[TERMINAL] WebSocket kapandı");
      if (statusRef.current !== "closed" && statusRef.current !== "error" && statusRef.current !== "idle") {
        setStatusBoth("closed");
        term.writeln("");
        term.writeln("\x1b[2m   Bağlantı kapandı.\x1b[0m");
      }
    };

    ws.onerror = () => {
      setStatusBoth("error");
      setError("WebSocket bağlantı hatası");
    };

    // Pipe terminal input to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pty_input", data: { input: data } }));
      }
    });

    // Handle resize
    term.onResize(({ rows, cols }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pty_resize", data: { rows, cols } }));
      }
    });
  }, [agentId, cleanup]);

  // Stop terminal
  const stopTerminal = useCallback(async () => {
    try {
      await fetch(`/api/agents/${agentId}/terminal/stop`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
    } catch {}
    cleanup();
    setStatusBoth("idle");
    setShell("");
  }, [agentId, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "pty_stop" }));
      }
      cleanup();
    };
  }, [cleanup]);

  // Handle resize on window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {}
      }
    };

    window.addEventListener("resize", handleResize);
    const observer = new ResizeObserver(handleResize);
    if (termRef.current) observer.observe(termRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, []);

  const isActive = status === "connected" || status === "connecting";

  return (
    <div className="iterm-container">
      {/* ─── Toolbar ─── */}
      <div className="iterm-toolbar">
        {(status === "idle" || status === "closed" || status === "error") && (
          <button
            className="vuln-scan-btn iterm-start-btn"
            onClick={startTerminal}
            disabled={!isOnline}
          >
            {status === "closed" || status === "error" ? (
              <><ArrowClockwiseIcon size={13} weight="bold" /> Yeniden Bağlan</>
            ) : (
              <><PlayIcon size={13} weight="bold" /> Oturum Başlat</>
            )}
          </button>
        )}
        {status === "connecting" && (
          <button className="vuln-scan-btn" disabled>
            <SpinnerGapIcon size={13} className="si-run" /> Bağlanıyor...
          </button>
        )}
        {status === "connected" && (
          <button
            className="vuln-scan-btn iterm-stop-btn"
            onClick={stopTerminal}
          >
            <StopIcon size={13} weight="bold" /> Oturumu Kapat
          </button>
        )}

        <div className="iterm-toolbar-right">
          {status === "connected" && shell && (
            <span className="iterm-shell-badge">
              <CommandIcon size={11} weight="bold" />
              {shell.split("/").pop()}
            </span>
          )}
          <span className={`iterm-status-badge ${status === "connected" ? "live" : status === "connecting" ? "connecting" : "off"}`}>
            <span className="iterm-status-dot" />
            {status === "idle" && "Kapalı"}
            {status === "connecting" && "Bağlanıyor"}
            {status === "connected" && "CANLI"}
            {status === "error" && "Hata"}
            {status === "closed" && "Kapandı"}
          </span>
        </div>
      </div>

      {/* ─── Terminal / States ─── */}
      <div className="iterm-viewer">
        {/* Idle empty state */}
        {status === "idle" && (
          <div className="iterm-empty">
            <div className="iterm-empty-glow" />
            <div className="iterm-empty-icon-wrap">
              <TerminalWindowIcon size={48} weight="duotone" />
            </div>
            <div className="iterm-empty-title">İnteraktif Terminal</div>
            <div className="iterm-empty-desc">
              Uzak makineye gerçek zamanlı shell erişimi sağlayın.
              SSH gibi komut yazabilir, <code>cd</code> ile gezinebilir,
              renkli çıktı ve <code>tab</code> completion kullanabilirsiniz.
            </div>
            <button
              className="iterm-hero-btn"
              onClick={startTerminal}
              disabled={!isOnline}
            >
              <PlayIcon size={15} weight="bold" />
              <span>Terminal Başlat</span>
            </button>
            {!isOnline && (
              <span className="iterm-offline-hint">Agent çevrimdışı — bağlantı kurulamaz</span>
            )}
            <div className="iterm-features">
              <div className="iterm-feature">
                <span className="iterm-feature-icon">⚡</span>
                <span>Gerçek PTY</span>
              </div>
              <div className="iterm-feature">
                <span className="iterm-feature-icon">🎨</span>
                <span>256 Renk</span>
              </div>
              <div className="iterm-feature">
                <span className="iterm-feature-icon">↹</span>
                <span>Tab Completion</span>
              </div>
              <div className="iterm-feature">
                <span className="iterm-feature-icon">📁</span>
                <span>cd Desteği</span>
              </div>
            </div>
          </div>
        )}

        {/* Connecting state */}
        {status === "connecting" && !terminalRef.current && (
          <div className="iterm-connecting">
            <SpinnerGapIcon size={40} className="si-run" />
            <span>Shell oturumu başlatılıyor...</span>
            <span className="iterm-connecting-sub">
              Agent'ta PTY oluşturuluyor
            </span>
          </div>
        )}

        {/* Error state (no terminal visible) */}
        {status === "error" && !terminalRef.current && (
          <div className="iterm-error-state">
            <WarningCircleIcon size={40} weight="fill" />
            <span>{error}</span>
            <span className="iterm-error-sub">
              Agent'ın çevrimiçi olduğundan ve shell erişiminin mümkün olduğundan emin olun.
            </span>
          </div>
        )}

        {/* xterm.js terminal surface */}
        <div
          className={`iterm-surface ${isActive || status === "closed" || status === "error" ? "visible" : ""}`}
          ref={termRef}
        />
      </div>
    </div>
  );
}
