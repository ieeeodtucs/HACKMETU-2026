import {
  CheckCircleIcon,
  WarningCircleIcon,
  SpinnerGapIcon,
  HourglassIcon,
} from "@phosphor-icons/react";

export function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircleIcon size={14} weight="fill" className="si-ok" />;
    case "error":
      return <WarningCircleIcon size={14} weight="fill" className="si-err" />;
    case "running":
      return <SpinnerGapIcon size={14} weight="bold" className="si-run" />;
    case "pending":
      return <HourglassIcon size={14} weight="fill" className="si-wait" />;
    default:
      return null;
  }
}
