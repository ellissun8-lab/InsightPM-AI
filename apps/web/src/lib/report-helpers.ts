export interface RunMeta {
  caseName: string;
  dataset: string;
  feedbackCount: number;
  status: string;
  timestamp: string;
}

export interface SegmentMeta {
  segmentId: string;
  name: string;
  type: string;
  businessGoal: string;
  feedbackCount: number;
  p0Count?: number;
  status?: string;
  summary?: string;
  recommendation?: string;
}

export interface IssueCluster {
  cluster_id: string;
  segment_id: string;
  segment_name?: string;
  name: string;
  summary: string;
  feedback_count: number;
  evidence_feedback_ids: string[];
  secondary_themes: string[];
  possible_metrics: string[];
  priority: string;
  opportunity_score: number;
  recommendation: string;
  low_confidence?: boolean;
  needs_validation?: boolean;
}

export interface SegmentData {
  segment_id: string;
  segment_type: string;
  summary: {
    feedback_count: number;
    cluster_count: number;
    clustered_feedback_count: number;
    unclustered_feedback_count: number;
  };
  issue_clusters: IssueCluster[];
}

export function isValidParam(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

export function getReadableSegmentName(
  segmentId: string,
  segments: SegmentMeta[]
): string {
  const seg = segments.find((s) => s.segmentId === segmentId);
  return seg?.name ?? segmentId;
}

export function sortByPriority(
  a: { priority: string; opportunity_score?: number },
  b: { priority: string; opportunity_score?: number }
): number {
  const order: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const pa = order[a.priority] ?? 4;
  const pb = order[b.priority] ?? 4;
  if (pa !== pb) return pa - pb;
  return (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0);
}

export function getEvidenceStatus(count: number): string {
  if (count >= 5) return "证据丰富";
  if (count >= 3) return "需补充";
  return "弱证据";
}

export function deriveHealthScore(hardVal: any, semVal: any): number {
  if (semVal?.semanticScore != null) return semVal.semanticScore;
  if (semVal?.score != null) return semVal.score;
  if (hardVal?.score != null) return hardVal.score;
  return 0;
}

export function formatDatasetName(dataset: string): string {
  return dataset
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
