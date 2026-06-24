/**
 * 验证相关类型定义
 */

export type ValidationStatus = "pending" | "passed" | "warning" | "failed";

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: "error" | "warning" | "info";
  details?: any;
}

export interface FeedbackCountCheck {
  expected_count: number;
  actual_count: number;
  match: boolean;
}

export interface ClusterCheck {
  total_clusters: number;
  valid_clusters: number;
  invalid_clusters: number;
  missing_name: number;
  missing_summary: number;
  missing_evidence: number;
  insufficient_evidence: number;
  invalid_evidence_ids: number;
  checks: ValidationCheck[];
}

export interface MetricCheck {
  forbidden_found: string[];
  hallucinated_found: string[];
  allowed_count: number;
  checks: ValidationCheck[];
}

export interface ReportCheck {
  feedback_count_match: boolean;
  top_issues_valid: boolean;
  undefined_product_names: string[];
  mismatched_metrics: string[];
  checks: ValidationCheck[];
}

export interface HallucinationCheck {
  undefined_product_names: string[];
  undefined_cluster_names: string[];
  invalid_numbers: number;
  mismatched_metrics: string[];
  checks: ValidationCheck[];
}

export interface SemanticReviewResult {
  has_issues: boolean;
  issues: {
    type: "metric_mismatch" | "product_name" | "unsupported_claim" | "inconsistency" | "over_inference";
    description: string;
    severity: "error" | "warning";
    location?: string;
  }[];
  summary: string;
  confidence: "high" | "medium" | "low";
}

export interface ValidationResultInput {
  projectId: string;
  analysisRunId: string;
  reportId: string | null;
  userId: string;
  project: {
    name: string;
    product_type?: string | null;
    business_goal?: string | null;
    target_user?: string | null;
    key_metric?: string | null;
  };
  report: {
    title: string;
    content_markdown: string;
  };
  clusters: {
    id: string;
    name: string;
    summary: string;
    feedback_count: number;
    opportunity_score: number | null;
    priority: string | null;
    evidence_feedback_ids: string[] | null;
  }[];
  feedbackItems: {
    id: string;
    raw_content: string;
  }[];
}

export interface ValidationResult {
  status: ValidationStatus;
  score: number;
  feedback_count_check: FeedbackCountCheck;
  cluster_check: ClusterCheck;
  metric_check: MetricCheck;
  report_check: ReportCheck;
  hallucination_check: HallucinationCheck;
  semantic_review?: SemanticReviewResult;
  validation_provider?: string;
  validation_model?: string;
  model_fallback?: boolean;
  failed_checks: ValidationCheck[];
  warnings: ValidationCheck[];
  recommendations: string[];
  summary: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
    warning_checks: number;
  };
}
