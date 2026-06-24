/**
 * 聚类验证模块
 */

import type { ClusterCheck, ValidationCheck } from "./types";

interface ClusterInput {
  id: string;
  name: string;
  summary: string;
  feedback_count: number;
  opportunity_score: number | null;
  priority: string | null;
  evidence_feedback_ids: string[] | null;
}

/**
 * 验证问题簇
 */
export function validateClusters(
  clusters: ClusterInput[],
  allFeedbackIds: string[],
  minEvidencePerCluster: number = 2
): ClusterCheck {
  const checks: ValidationCheck[] = [];
  const feedbackIdSet = new Set(allFeedbackIds);

  let missingName = 0;
  let missingSummary = 0;
  let missingEvidence = 0;
  let insufficientEvidence = 0;
  let invalidEvidenceIds = 0;
  let validClusters = 0;

  for (const cluster of clusters) {
    let isValid = true;

    // Check name
    if (!cluster.name || cluster.name.trim() === "") {
      missingName++;
      isValid = false;
    }

    // Check summary
    if (!cluster.summary || cluster.summary.trim() === "") {
      missingSummary++;
      isValid = false;
    }

    // Check evidence
    if (!cluster.evidence_feedback_ids || cluster.evidence_feedback_ids.length === 0) {
      missingEvidence++;
      isValid = false;
    } else {
      // Check if evidence IDs exist
      const invalidIds = cluster.evidence_feedback_ids.filter(
        (id) => !feedbackIdSet.has(id)
      );
      if (invalidIds.length > 0) {
        invalidEvidenceIds += invalidIds.length;
        checks.push({
          name: "invalid_evidence_ids",
          passed: false,
          message: `Cluster "${cluster.name}" 有 ${invalidIds.length} 个无效的 evidence_feedback_ids`,
          severity: "error",
          details: { cluster: cluster.name, invalid_ids: invalidIds },
        });
      }

      // Check minimum evidence
      if (cluster.evidence_feedback_ids.length < minEvidencePerCluster) {
        insufficientEvidence++;
        checks.push({
          name: "insufficient_evidence",
          passed: false,
          message: `Cluster "${cluster.name}" 证据不足（${cluster.evidence_feedback_ids.length}/${minEvidencePerCluster}）`,
          severity: "warning",
          details: {
            cluster: cluster.name,
            count: cluster.evidence_feedback_ids.length,
            required: minEvidencePerCluster,
          },
        });
      }
    }

    if (isValid) {
      validClusters++;
    }
  }

  // Summary check
  checks.push({
    name: "cluster_validity",
    passed: missingName === 0 && missingSummary === 0 && missingEvidence === 0,
    message:
      missingName === 0 && missingSummary === 0 && missingEvidence === 0
        ? `所有 ${clusters.length} 个 cluster 都有效`
        : `${missingName} 个缺少名称, ${missingSummary} 个缺少摘要, ${missingEvidence} 个缺少证据`,
    severity: missingName > 0 || missingSummary > 0 || missingEvidence > 0 ? "error" : "info",
  });

  return {
    total_clusters: clusters.length,
    valid_clusters: validClusters,
    invalid_clusters: clusters.length - validClusters,
    missing_name: missingName,
    missing_summary: missingSummary,
    missing_evidence: missingEvidence,
    insufficient_evidence: insufficientEvidence,
    invalid_evidence_ids: invalidEvidenceIds,
    checks,
  };
}
