import { useEffect, useRef } from "react";
import type { ActionModalState } from "./actions";
import {
  SpinnerGapIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  XIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";

export function ActionOutputModal({
  state,
  onClose,
}: {
  state: ActionModalState;
  onClose: () => void;
}) {
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [state.output]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isLoading = state.status === "pending" || state.status === "running";

  return (
    <>
      <div className="action-modal-overlay" onClick={onClose} />
      <div className="action-modal">
        <div className="action-modal-header">
          <div className="action-modal-header-left">
            <span className={`action-modal-icon action-modal-icon-${state.action.color}`}>
              {state.action.icon}
            </span>
            <div className="action-modal-title-group">
              <h3 className="action-modal-title">{state.action.label}</h3>
              <span className="action-modal-desc">{state.action.desc}</span>
            </div>
          </div>
          <div className="action-modal-header-right">
            {isLoading && (
              <span className="action-modal-status-badge loading">
                <SpinnerGapIcon size={13} className="si-run" />
                Çalışıyor...
              </span>
            )}
            {state.status === "completed" && (
              <span className="action-modal-status-badge success">
                <CheckCircleIcon size={13} weight="fill" />
                Tamamlandı
              </span>
            )}
            {state.status === "error" && (
              <span className="action-modal-status-badge error">
                <WarningCircleIcon size={13} weight="fill" />
                Hata
              </span>
            )}
            <button className="action-modal-close" onClick={onClose}>
              <XIcon size={16} weight="bold" />
            </button>
          </div>
        </div>

        <div className="action-modal-cmd-bar">
          <CaretRightIcon size={12} />
          <code>{state.commandStr}</code>
        </div>

        <div className="action-modal-body">
          {isLoading && !state.output && (
            <div className="action-modal-loading">
              <SpinnerGapIcon size={28} className="si-run" />
              <span>Komut çalıştırılıyor...</span>
            </div>
          )}
          {(state.output || state.error) && (
            <pre ref={outputRef} className={`action-modal-output ${state.error ? "has-error" : ""}`}>
              {state.output}
              {state.error && (
                <span className="action-modal-error-text">{state.error}</span>
              )}
            </pre>
          )}
        </div>
      </div>
    </>
  );
}
