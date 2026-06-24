import { CheckCircle, XCircle, Clock } from "lucide-react";
import { translateStatus, statusBadgeClass } from "@/lib/format";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const cls = statusBadgeClass(status);
  const sizeCls =
    size === "sm" ? "text-label-sm px-2 py-0.5" : "text-body-md px-3 py-1";
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <span
      className={`${cls} ${sizeCls} rounded font-label-sm font-bold inline-flex items-center gap-1`}
    >
      {status === "pass" || status === "accepted" ? (
        <CheckCircle size={iconSize} />
      ) : status === "fail" || status === "rejected" ? (
        <XCircle size={iconSize} />
      ) : (
        <Clock size={iconSize} />
      )}
      {translateStatus(status)}
    </span>
  );
}
