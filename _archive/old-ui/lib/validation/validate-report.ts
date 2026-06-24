/**
 * 报告验证模块
 */

import type { ReportCheck, ValidationCheck } from "./types";

/**
 * 从报告中提取反馈数量
 */
function extractFeedbackCount(reportText: string): number | null {
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

  const excludePatterns = [
    "问题名称", "---", "P0", "P1", "P2", "P3",
    "排名", "优先级", "机会分", "反馈数", "置信度", "建议动作",
    "高", "中", "低", "立即修复", "改善体验", "加入待办",
    "用户访谈验证", "数据验证", "暂时忽略", "构建 MVP",
  ];

  // Match table rows
  const tablePattern = /\|\s*\d+\s*\|\s*(.+?)\s*\|/g;
  let match;
  while ((match = tablePattern.exec(reportText)) !== null) {
    const name = match[1].trim();
    if (name && !excludePatterns.includes(name) && !name.match(/^[P0-3]+$/)) {
      issues.push(name);
    }
  }

  // Match ### headers
  const headerPattern = /###\s+(.+?)(\n|$)/g;
  while ((match = headerPattern.exec(reportText)) !== null) {
    const name = match[1].trim();
    if (
      name &&
      !name.includes("附录") &&
      !name.includes("详情") &&
      !excludePatterns.includes(name)
    ) {
      issues.push(name);
    }
  }

  return [...new Set(issues)];
}

/**
 * 检查未定义的产品名
 */
function findUndefinedProductNames(
  reportText: string,
  definedProductName: string
): string[] {
  const productNamePatterns = [
    /(?:产品名称|产品名)[：:]\s*(.+?)(\n|$)/g,
    /(?:项目名称|项目名)[：:]\s*(.+?)(\n|$)/g,
  ];

  const foundNames: string[] = [];
  for (const pattern of productNamePatterns) {
    let match;
    while ((match = pattern.exec(reportText)) !== null) {
      const name = match[1].trim();
      if (name && name !== definedProductName && name.length < 20) {
        foundNames.push(name);
      }
    }
  }

  return [...new Set(foundNames)];
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
    clusterScores: Map<string, number>;
    clusterPriorities: Map<string, string>;
  }
): ReportCheck {
  const checks: ValidationCheck[] = [];

  // Check 1: Feedback count match
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
    severity: feedbackCountMatch ? "info" : "error",
    details: { in_report: feedbackCountInReport, expected: expected.feedbackCount },
  });

  // Check 2: Top issues from clusters
  const topIssues = extractTopIssues(reportText);
  const clusterNameSet = new Set(expected.clusterNames);
  const invalidTopIssues = topIssues.filter(
    (issue) =>
      !clusterNameSet.has(issue) &&
      !expected.clusterNames.some(
        (cn) => cn.includes(issue) || issue.includes(cn)
      )
  );

  checks.push({
    name: "top_issues_from_clusters",
    passed: invalidTopIssues.length === 0,
    message:
      invalidTopIssues.length === 0
        ? "所有 Top 问题都来自聚类结果"
        : `${invalidTopIssues.length} 个 Top 问题不在聚类结果中`,
    severity: invalidTopIssues.length > 0 ? "error" : "info",
    details: { found_issues: topIssues, invalid_issues: invalidTopIssues },
  });

  // Check 3: No undefined product names
  const undefinedNames = findUndefinedProductNames(reportText, expected.productName);

  checks.push({
    name: "no_undefined_product_names",
    passed: undefinedNames.length === 0,
    message:
      undefinedNames.length === 0
        ? "报告中未出现未定义的产品名"
        : `报告中出现了 ${undefinedNames.length} 个未定义的产品名`,
    severity: undefinedNames.length > 0 ? "error" : "info",
    details: { undefined_names: undefinedNames },
  });

  // Check 4: Opportunity scores match
  let scoreMismatch = 0;
  for (const [name, score] of expected.clusterScores) {
    const scorePattern = new RegExp(`${name}.*?(\\d+)`, "g");
    const match = scorePattern.exec(reportText);
    if (match) {
      const reportScore = parseInt(match[1], 10);
      if (Math.abs(reportScore - score) > 5) {
        scoreMismatch++;
      }
    }
  }

  checks.push({
    name: "opportunity_scores_match",
    passed: scoreMismatch === 0,
    message:
      scoreMismatch === 0
        ? "报告中的机会分与聚类结果一致"
        : `${scoreMismatch} 个问题的机会分不一致`,
    severity: scoreMismatch > 0 ? "warning" : "info",
  });

  // Check 5: Priorities match
  let priorityMismatch = 0;
  for (const [name, priority] of expected.clusterPriorities) {
    if (reportText.includes(name) && reportText.includes(priority)) {
      // Priority is mentioned, check if it matches
      const priorityPattern = new RegExp(`${name}.*?P[0-3]`, "g");
      const match = priorityPattern.exec(reportText);
      if (match && !match[0].includes(priority)) {
        priorityMismatch++;
      }
    }
  }

  checks.push({
    name: "priorities_match",
    passed: priorityMismatch === 0,
    message:
      priorityMismatch === 0
        ? "报告中的优先级与聚类结果一致"
        : `${priorityMismatch} 个问题的优先级不一致`,
    severity: priorityMismatch > 0 ? "warning" : "info",
  });

  return {
    feedback_count_match: feedbackCountMatch,
    top_issues_valid: invalidTopIssues.length === 0,
    undefined_product_names: undefinedNames,
    mismatched_metrics: [],
    checks,
  };
}
