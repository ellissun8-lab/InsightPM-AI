/**
 * 验证评分计算模块
 */

import type { ValidationResult, ValidationStatus } from "./types";

/**
 * 计算验证评分 (0-100)
 */
export function calculateValidationScore(
  validationResult: Omit<ValidationResult, "score" | "status">
): { score: number; status: ValidationStatus } {
  let score = 100;

  // Feedback count mismatch: -20
  if (!validationResult.feedback_count_check.match) {
    score -= 20;
  }

  // Invalid evidence IDs: -10 each
  score -= validationResult.cluster_check.invalid_evidence_ids * 10;

  // Missing evidence: -5 each
  score -= validationResult.cluster_check.missing_evidence * 5;

  // Insufficient evidence: -3 each
  score -= validationResult.cluster_check.insufficient_evidence * 3;

  // Forbidden metrics: -15 each
  score -= validationResult.metric_check.forbidden_found.length * 15;

  // Hallucinated metrics: -5 each
  score -= validationResult.metric_check.hallucinated_found.length * 5;

  // Undefined product names: -20 each
  score -= validationResult.hallucination_check.undefined_product_names.length * 20;

  // Undefined cluster names: -15 each
  score -= validationResult.hallucination_check.undefined_cluster_names.length * 15;

  // Invalid numbers: -5 each
  score -= validationResult.hallucination_check.invalid_numbers * 5;

  // Mismatched metrics: -10 each
  score -= validationResult.hallucination_check.mismatched_metrics.length * 10;

  // Top issues not from clusters: -15
  const topIssuesCheck = validationResult.report_check.checks.find(
    (c) => c.name === "top_issues_from_clusters"
  );
  if (topIssuesCheck && !topIssuesCheck.passed) {
    score -= 15;
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine status
  let status: ValidationStatus;
  if (score >= 90) {
    status = "passed";
  } else if (score >= 70) {
    status = "warning";
  } else {
    status = "failed";
  }

  return { score, status };
}
