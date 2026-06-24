/**
 * 报告验证脚本
 * 验证生成的报告是否符合预期
 */

export interface ReportValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  failed_checks: ValidationCheck[];
  stats: {
    feedback_count_in_report: number;
    feedback_count_in_csv: number;
    hallucination_count: number;
  };
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

/**
 * 从报告中提取反馈数量
 */
function extractFeedbackCount(reportText: string): number | null {
  // 尝试匹配各种格式的反馈数量
  const patterns = [
    /总反馈[数量].*?(\d+)/,
    /共\s*(\d+)\s*条/,
    /(\d+)\s*条反馈/,
    /反馈[数量].*?(\d+)/,
    /总共.*?(\d+)/,
    /分析了.*?(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = reportText.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * 从报告中提取 Top 问题名称
 */
function extractTopIssues(reportText: string): string[] {
  const issues: string[] = [];

  // 非问题名称的过滤列表
  const excludePatterns = [
    "问题名称",
    "---",
    "P0", "P1", "P2", "P3",
    "排名", "优先级", "机会分", "反馈数", "置信度", "建议动作",
    "高", "中", "低",
    "立即修复", "改善体验", "加入待办", "用户访谈验证", "数据验证", "暂时忽略", "构建 MVP",
  ];

  // 匹配表格中的问题名称 (格式: | 数字 | 名称 | ...)
  const tablePattern = /\|\s*\d+\s*\|\s*(.+?)\s*\|/g;
  let match;
  while ((match = tablePattern.exec(reportText)) !== null) {
    const name = match[1].trim();
    if (name && !excludePatterns.includes(name) && !name.match(/^[P0-3]+$/)) {
      issues.push(name);
    }
  }

  // 匹配 ### 开头的问题
  const headerPattern = /###\s+(.+?)(\n|$)/g;
  while ((match = headerPattern.exec(reportText)) !== null) {
    const name = match[1].trim();
    if (name && !name.includes("附录") && !name.includes("详情") && !excludePatterns.includes(name)) {
      issues.push(name);
    }
  }

  return [...new Set(issues)];
}

/**
 * 检查报告中是否出现了未定义的产品名
 */
function findUndefinedProductNames(
  reportText: string,
  definedProductName: string
): string[] {
  // 常见产品名模式
  const productNamePatterns = [
    /(?:产品名称|产品名)[：:]\s*(.+?)(\n|$)/g,
    /(?:项目名称|项目名)[：:]\s*(.+?)(\n|$)/g,
    /【(.+?)】/g,
  ];

  const foundNames: string[] = [];
  for (const pattern of productNamePatterns) {
    let match;
    while ((match = pattern.exec(reportText)) !== null) {
      const name = match[1].trim();
      if (name && name !== definedProductName) {
        foundNames.push(name);
      }
    }
  }

  return [...new Set(foundNames)];
}

/**
 * 检查报告中是否默认写了不匹配的指标
 */
function findMismatchedMetrics(
  reportText: string,
  productType: string
): string[] {
  const mismatches: string[] = [];

  // B端 SaaS 不应该出现的 C端指标
  const b2bForbidden = ["DAU", "MAU", "GMV", "客单价", "复购率"];
  // C端不应该出现的 B端指标
  const b2cForbidden = ["续费率", "管理员效率", "客服成本"];

  const isB2B =
    productType.includes("B端") ||
    productType.includes("SaaS") ||
    productType.includes("企业");

  const forbidden = isB2B ? b2bForbidden : b2cForbidden;

  for (const metric of forbidden) {
    if (reportText.includes(metric)) {
      mismatches.push(metric);
    }
  }

  return mismatches;
}

/**
 * 验证报告
 */
export function validateReport(
  reportText: string,
  expected: {
    productName: string;
    productType: string;
    feedbackCount: number;
    clusterNames: string[];
  }
): ReportValidationResult {
  const checks: ValidationCheck[] = [];
  let hallucinationCount = 0;

  // Check 1: 报告中的反馈数量是否等于 CSV 行数
  const feedbackCountInReport = extractFeedbackCount(reportText);
  const feedbackCountMatch =
    feedbackCountInReport === null ||
    Math.abs(feedbackCountInReport - expected.feedbackCount) <= 5;

  checks.push({
    name: "feedback_count_match",
    passed: feedbackCountMatch,
    message: feedbackCountMatch
      ? `反馈数量匹配: ${feedbackCountInReport || "未找到"} (期望: ${expected.feedbackCount})`
      : `反馈数量不匹配: 报告中 ${feedbackCountInReport}, 期望 ${expected.feedbackCount}`,
    details: {
      in_report: feedbackCountInReport,
      expected: expected.feedbackCount,
    },
  });

  // Check 2: 报告中的 Top 问题是否来自 clusters
  const topIssues = extractTopIssues(reportText);
  const clusterNameSet = new Set(expected.clusterNames);
  const invalidTopIssues = topIssues.filter(
    (issue) =>
      !clusterNameSet.has(issue) &&
      !expected.clusterNames.some(
        (cn) => cn.includes(issue) || issue.includes(cn)
      )
  );

  if (invalidTopIssues.length > 0) {
    hallucinationCount += invalidTopIssues.length;
  }

  checks.push({
    name: "top_issues_from_clusters",
    passed: invalidTopIssues.length === 0,
    message:
      invalidTopIssues.length === 0
        ? "所有 Top 问题都来自聚类结果"
        : `${invalidTopIssues.length} 个 Top 问题不在聚类结果中`,
    details: {
      found_issues: topIssues,
      invalid_issues: invalidTopIssues,
      valid_clusters: expected.clusterNames,
    },
  });

  // Check 3: 报告不能出现未定义产品名
  const undefinedNames = findUndefinedProductNames(
    reportText,
    expected.productName
  );

  if (undefinedNames.length > 0) {
    hallucinationCount += undefinedNames.length;
  }

  checks.push({
    name: "no_undefined_product_names",
    passed: undefinedNames.length === 0,
    message:
      undefinedNames.length === 0
        ? "报告中未出现未定义的产品名"
        : `报告中出现了 ${undefinedNames.length} 个未定义的产品名: ${undefinedNames.join(", ")}`,
    details: { undefined_names: undefinedNames },
  });

  // Check 4: 报告不能默认写不匹配的指标
  const mismatchedMetrics = findMismatchedMetrics(
    reportText,
    expected.productType
  );

  if (mismatchedMetrics.length > 0) {
    hallucinationCount += mismatchedMetrics.length;
  }

  checks.push({
    name: "no_mismatched_metrics",
    passed: mismatchedMetrics.length === 0,
    message:
      mismatchedMetrics.length === 0
        ? "报告中未出现不匹配的指标"
        : `报告中出现了 ${mismatchedMetrics.length} 个不匹配的指标: ${mismatchedMetrics.join(", ")}`,
    details: { mismatched_metrics: mismatchedMetrics },
  });

  const failed_checks = checks.filter((c) => !c.passed);

  return {
    valid: failed_checks.length === 0,
    checks,
    failed_checks,
    stats: {
      feedback_count_in_report: feedbackCountInReport || 0,
      feedback_count_in_csv: expected.feedbackCount,
      hallucination_count: hallucinationCount,
    },
  };
}
