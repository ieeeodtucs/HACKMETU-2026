import type { MachineAction } from "./actions";

export function ActionButton({
  action,
  onExecute,
  disabled,
}: {
  action: MachineAction;
  onExecute: (action: MachineAction) => void;
  disabled: boolean;
}) {
  return (
    <button
      className={`mc-action mc-action-${action.color}`}
      disabled={disabled}
      onClick={() => {
        if (action.confirm && !confirm(action.confirm)) return;
        onExecute(action);
      }}
    >
      <span className="mc-action-icon">{action.icon}</span>
      <div className="mc-action-text">
        <span className="mc-action-label">{action.label}</span>
        <span className="mc-action-desc">{action.desc}</span>
      </div>
    </button>
  );
}
