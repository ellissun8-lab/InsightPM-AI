/**
 * 聚类验证脚本
 * 验证 issue_clusters 是否符合预期
 */

export interface ClusterInput {
  name: string;
  summary: string;
  feedback_count: number;
  evidence_feedback_ids: string[];
  priority?: string;
  opportunity_score?: number;
}

export interface ClusterValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  failed_checks: ValidationCheck[];
  stats: {
    cluster_count: number;
    valid_evidence_count: number;
    invalid_evidence_count: number;
    top_theme_recall: number;
  };
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * 验证聚类结果
 */
export function validateClusters(
  clusters: ClusterInput[],
  allFeedbackIds: string[],
  expectedTopThemes: string[],
  minEvidencePerCluster: number = 2,
  minTopThemeRecall: number = 0.6
): ClusterValidationResult {
  const checks: ValidationCheck[] = [];
  let invalidEvidenceCount = 0;

  // Check 1: 每个 cluster 必须有 name
  const clustersWithoutName = clusters.filter((c) => !c.name || c.name.trim() === "");
  checks.push({
    name: "cluster_has_name",
    passed: clustersWithoutName.length === 0,
    message: clustersWithoutName.length === 0
      ? "所有 cluster 都有名称"
      : `${clustersWithoutName.length} 个 cluster 缺少名称`,
    details: clustersWithoutName.map((c) => c.name),
  });

  // Check 2: 每个 cluster 必须有 summary
  const clustersWithoutSummary = clusters.filter((c) => !c.summary || c.summary.trim() === "");
  checks.push({
    name: "cluster_has_summary",
    passed: clustersWithoutSummary.length === 0,
    message: clustersWithoutSummary.length === 0
      ? "所有 cluster 都有摘要"
      : `${clustersWithoutSummary.length} 个 cluster 缺少摘要`,
  });

  // Check 3: 每个 cluster 必须有 evidence_feedback_ids
  const clustersWithoutEvidence = clusters.filter(
    (c) => !c.evidence_feedback_ids || c.evidence_feedback_ids.length === 0
  );
  checks.push({
    name: "cluster_has_evidence",
    passed: clustersWithoutEvidence.length === 0,
    message: clustersWithoutEvidence.length === 0
      ? "所有 cluster 都有证据反馈"
      : `${clustersWithoutEvidence.length} 个 cluster 缺少证据反馈`,
  });

  // Check 4: evidence_feedback_ids 必须存在于原始 CSV
  const feedbackIdSet = new Set(allFeedbackIds);
  for (const cluster of clusters) {
    if (cluster.evidence_feedback_ids) {
      const invalidIds = cluster.evidence_feedback_ids.filter(
        (id) => !feedbackIdSet.has(id)
      );
      invalidEvidenceCount += invalidIds.length;
      if (invalidIds.length > 0) {
        checks.push({
          name: "evidence_ids_exist",
          passed: false,
          message: `Cluster "${cluster.name}" 有 ${invalidIds.length} 个无效的 evidence_feedback_ids`,
          details: { cluster: cluster.name, invalid_ids: invalidIds },
        });
      }
    }
  }
  if (invalidEvidenceCount === 0) {
    checks.push({
      name: "evidence_ids_exist",
      passed: true,
      message: "所有 evidence_feedback_ids 都存在于原始数据中",
    });
  }

  // Check 5: 每个 cluster 至少有 minEvidencePerCluster 条证据
  const clustersWithInsufficientEvidence = clusters.filter(
    (c) => (c.evidence_feedback_ids?.length || 0) < minEvidencePerCluster
  );
  checks.push({
    name: "min_evidence_per_cluster",
    passed: clustersWithInsufficientEvidence.length === 0,
    message: clustersWithInsufficientEvidence.length === 0
      ? `所有 cluster 至少有 ${minEvidencePerCluster} 条证据`
      : `${clustersWithInsufficientEvidence.length} 个 cluster 证据不足（少于 ${minEvidencePerCluster} 条）`,
    details: clustersWithInsufficientEvidence.map((c) => ({
      name: c.name,
      evidence_count: c.evidence_feedback_ids?.length || 0,
    })),
  });

  // Check 6: expected_top_themes 召回率
  const clusterNames = new Set(clusters.map((c) => c.name));
  const recalledThemes = expectedTopThemes.filter((theme) => {
    // 模糊匹配：cluster 名称包含 expected theme 关键词，或 vice versa
    for (const clusterName of clusterNames) {
      if (
        clusterName.includes(theme) ||
        theme.includes(clusterName) ||
        similarity(clusterName, theme) > 0.6
      ) {
        return true;
      }
    }
    return false;
  });
  const topThemeRecall =
    expectedTopThemes.length > 0
      ? recalledThemes.length / expectedTopThemes.length
      : 1;

  checks.push({
    name: "top_theme_recall",
    passed: topThemeRecall >= minTopThemeRecall,
    message: `主题召回率: ${(topThemeRecall * 100).toFixed(0)}% (要求 >= ${(minTopThemeRecall * 100).toFixed(0)}%)`,
    details: {
      expected: expectedTopThemes,
      recalled: recalledThemes,
      missing: expectedTopThemes.filter((t) => !recalledThemes.includes(t)),
    },
  });

  const failed_checks = checks.filter((c) => !c.passed);

  return {
    valid: failed_checks.length === 0,
    checks,
    failed_checks,
    stats: {
      cluster_count: clusters.length,
      valid_evidence_count: clusters.reduce(
        (sum, c) => sum + (c.evidence_feedback_ids?.length || 0),
        0
      ) - invalidEvidenceCount,
      invalid_evidence_count: invalidEvidenceCount,
      top_theme_recall: topThemeRecall,
    },
  };
}

/**
 * 简单的字符串相似度计算 (Jaro-like)
 */
function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3
  );
}
