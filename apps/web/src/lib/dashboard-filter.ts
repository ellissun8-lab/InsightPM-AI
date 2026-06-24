export type TimeRange = "today" | "7d" | "30d" | "quarter" | "all";

export interface RunRecord {
  case_name: string;
  dataset: string;
  count: number;
  status: string;
  validation: any;
  timestamp: string | null;
}

function getRunDate(run: RunRecord): Date | null {
  if (!run.timestamp) return null;
  const d = new Date(run.timestamp);
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
