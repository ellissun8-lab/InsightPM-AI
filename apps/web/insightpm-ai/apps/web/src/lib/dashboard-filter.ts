export type TimeRange = "today" | "7d" | "30d" | "quarter" | "all";

export interface RunRecord {
  id?: string;
  caseName?: string;
  case_name?: string;
  scenario?: string;
  dataset?: string;
  status?: string;
  feedbackCount?: number;
  count?: number;
  hardScore?: number | null;
  semanticScore?: number | null;
  validation?: any;
  hardValidation?: any;
  semanticValidation?: any;
  createdAt?: string | null;
  updatedAt?: string | null;
  startedAt?: string | null;
  timestamp?: string | null;
  durationMs?: number | null;
  duration_ms?: number | null;
  metadata?: any;
}

function getRunDate(run: RunRecord): Date | null {
  const dateStr = run.updatedAt || run.timestamp || run.createdAt || run.startedAt;
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function hasReliableTimeData(runs: RunRecord[]): boolean {
  const withDate = runs.filter((r) => getRunDate(r) !== null);
  return withDate.length >= Math.ceil(runs.length * 0.5);
}

export function filterRunsByTimeRange(
  runs: RunRecord[],
  range: TimeRange
): RunRecord[] {
  if (range === "all") return runs;

  const now = new Date();
  let cutoff: Date;

  switch (range) {
    case "today":
      cutoff = startOfDay(now);
      break;
    case "7d":
      cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case "30d":
      cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      break;
    case "quarter": {
      const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      cutoff = qStart;
      break;
    }
    default:
      return runs;
  }

  return runs.filter((r) => {
    const d = getRunDate(r);
    if (!d) return false;
    return d >= cutoff;
  });
}

export function getTimeRangeLabel(range: TimeRange): string {
  const labels: Record<TimeRange, string> = {
    today: "今日",
    "7d": "近 7 天",
    "30d": "近 30 天",
    quarter: "本季度",
    all: "全部时间",
  };
  return labels[range];
}
