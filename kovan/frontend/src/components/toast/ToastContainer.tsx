import { useEffect, useState, useCallback, createContext, useContext } from "react";
import {
  CheckCircleIcon,
  WarningIcon,
  WarningCircleIcon,
  InfoIcon,
  XIcon,
} from "@phosphor-icons/react";
import "./toast.css";

type ToastSeverity = "info" | "success" | "warning" | "critical";

interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
  duration: number;
  createdAt: number;
}

interface ToastContextType {
  addToast: (message: string, severity?: ToastSeverity, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const SEVERITY_ICON: Record<ToastSeverity, React.ReactNode> = {
  info: <InfoIcon size={18} weight="fill" />,
  success: <CheckCircleIcon size={18} weight="fill" />,
  warning: <WarningIcon size={18} weight="fill" />,
  critical: <WarningCircleIcon size={18} weight="fill" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, severity: ToastSeverity = "info", duration = 5000) => {
      const id = crypto.randomUUID().slice(0, 8);
      setToasts((prev) => [...prev.slice(-4), { id, message, severity, duration, createdAt: Date.now() }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), toast.duration - 300);
    const removeTimer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div className={`toast toast-${toast.severity} ${exiting ? "toast-exit" : "toast-enter"}`}>
      <span className="toast-icon">{SEVERITY_ICON[toast.severity]}</span>
      <span className="toast-msg">{toast.message}</span>
      <button className="toast-close" onClick={() => onRemove(toast.id)}>
        <XIcon size={14} />
      </button>
    </div>
  );
}
