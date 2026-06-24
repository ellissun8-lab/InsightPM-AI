export interface DatasetInfo {
  caseName: string;
  status: "accepted" | "rejected" | "pending";
  rawCount: number;
  normalizedCount: number;
  clusterCount: number;
  hardValidationScore: number;
  semanticScore: number;
  baselineType: string;
  acceptedAt: string;
}

export interface DatasetIndex {
  generatedAt: string;
  totalDatasets: number;
  acceptedCount: number;
  rejectedCount: number;
  totalFeedbacks: number;
  datasets: DatasetInfo[];
}

export interface RunSummary {
  case_name: string;
  dataset: string;
  count: number;
  timestamp: string;
  duration_ms: number;
  status: string;
  steps: StepResult[];
  validation?: {
    score: number;
    status: string;
    total_checks: number;
    pass_count: number;
    warning_count: number;
    fail_count: number;
  };
}

export interface StepResult {
  step: string;
  success: boolean;
  message: string;
  duration_ms: number;
}

export interface HardValidation {
  score: number;
  status: string;
  total_checks: number;
  pass_count: number;
  warning_count: number;
  fail_count: number;
  checks?: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  status: string;
  score: number;
  maxScore: number;
  message: string;
  details: string[];
}

export interface SemanticValidation {
  caseName: string;
  model: string;
  timestamp: string;
  semanticScore: number;
  status: string;
  criticalIssues: number;
  warnings: string[];
  passedChecks: number;
  failedChecks: number;
  checks: ValidationCheck[];
  recommendations: string[];
}

export interface OverallAnalysis {
  summary: {
    total_feedback_count: number;
    analyzed_feedback_count: number;
    clustered_feedback_count: number;
    unclustered_feedback_count: number;
    segment_count: number;
    business_segment_count: number;
    noise_segment_count: number;
    positive_segment_count: number;
    unknown_segment_count: number;
    cluster_count: number;
    is_mixed_dataset: boolean;
  };
  segments: SegmentSummary[];
  issue_clusters: IssueCluster[];
}

export interface SegmentSummary {
  segment_id: string;
  name: string;
  feedback_count: number;
  business_goal: string;
  issue_cluster_ids: string[];
}

export interface IssueCluster {
  cluster_id: string;
  segment_id: string;
  name: string;
  summary: string;
  feedback_count: number;
  evidence_feedback_ids: string[];
  priority: string;
  opportunity_score: number;
  recommendation: string;
}

export interface EvaluationResult {
  caseName: string;
  dataset: string;
  evaluatedAt: string;
  metrics: Record<string, number>;
  averageScore: number;
  hardValidation: { score: number; status: string } | null;
  segmentCount: number;
  clusterCount: number;
  feedbackCount: number;
}
