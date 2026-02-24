import { useEffect, useRef } from "react";
import type { Command } from "@kovan/shared";
import { timeAgo } from "./helpers";
import { StatusIcon } from "./StatusIcon";
import { TerminalWindowIcon } from "@phosphor-icons/react";

export function ActionLogDrawerContent({ commands }: { commands: Command[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevCommandCountRef = useRef(commands.length);

  useEffect(() => {
    if (isNearBottomRef.current && commands.length > prevCommandCountRef.current) {
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }
    prevCommandCountRef.current = commands.length;
  }, [commands]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 60;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  const sorted = [...commands].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );

  return (
    <div
      className="drawer-log-body"
      ref={scrollRef}
      onScroll={handleScroll}
      style={{ padding: "4px 20px 16px", height: "100%", overflowY: "auto" }}
    >
      {sorted.length === 0 ? (
        <div className="mc-log-empty" style={{ paddingTop: 60 }}>
          <TerminalWindowIcon size={36} />
          <span>Henüz işlem yapılmadı</span>
          <span className="mc-log-empty-sub">
            Aksiyonlardan veya özel komuttan bir işlem çalıştırın
          </span>
        </div>
      ) : (
        sorted.map((cmd) => (
          <div key={cmd.id} className="mc-log-item">
            <div className="mc-log-item-header">
              <StatusIcon status={cmd.status} />
              <code className="mc-log-cmd">{cmd.command}</code>
              <span className="mc-log-time">{timeAgo(cmd.sentAt)}</span>
            </div>
            {cmd.output && <pre className="mc-log-output">{cmd.output}</pre>}
          </div>
        ))
      )}
    </div>
  );
}
