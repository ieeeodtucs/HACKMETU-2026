import { useEffect } from "react";
import { XIcon } from "@phosphor-icons/react";

export function SlideDrawer({
  open,
  onClose,
  title,
  icon,
  children,
  actionBar,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  actionBar?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      <div className={`drawer-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`drawer-panel ${open ? "open" : ""}`}>
        <div className="drawer-header">
          <div className="drawer-header-l">
            {icon}
            <span>{title}</span>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <XIcon size={16} weight="bold" />
          </button>
        </div>
        {actionBar && <div className="drawer-action-bar">{actionBar}</div>}
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
