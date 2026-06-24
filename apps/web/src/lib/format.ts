const STATUS_MAP: Record<string, string> = {
  pass: "通过",
  warning: "警告",
  fail: "失败",
  accepted: "已采纳",
  rejected: "已拒绝",
  pending: "待处理",
  running: "运行中",
};

export function translateStatus(status: string): string {
  return STATUS_MAP[status] || status;
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "pass":
    case "accepted":
      return "badge-pass";
    case "fail":
    case "rejected":
      return "badge-fail";
    case "warning":
    case "pending":
      return "badge-warning";
    default:
      return "badge-info";
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncate(str: string, len: number): string {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}
