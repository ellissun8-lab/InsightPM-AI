/**
 * 指标验证脚本
 * 验证报告中出现的指标是否符合预期
 */

export interface MetricsValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
  failed_checks: ValidationCheck[];
  stats: {
    forbidden_metric_count: number;
    hallucinated_metric_count: number;
    allowed_metric_count: number;
  };
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

// 常见指标关键词，用于检测报告中提到的指标
const COMMON_METRICS = [
  "DAU", "MAU", "WAU",
  "GMV", "ARPU", "LTV", "CAC",
  "续费率", "续费", "留存率", "留存",
  "转化率", "转化", "客单价",
  "NPS", "CSAT", "满意度",
  "DAU/MAU", "活跃率",
  "复购率", "复购",
  "退货率", "退货",
  "客服成本", "工单量",
  "管理员效率", "管理效率",
  "功能采纳率", "采纳率",
  "试用转化率", "试用转化",
  "数据准确性", "数据质量",
  "员工满意度", "用户满意度",
  "响应时间", "响应速度",
];

/**
 * 从报告文本中提取提到的指标
 */
function extractMetricsFromText(text: string): string[] {
  const foundMetrics: string[] = [];

  for (const metric of COMMON_METRICS) {
    // 使用词边界匹配，避免误匹配
    const regex = new RegExp(`(^|[\\s,，。、])${escapeRegex(metric)}([\\s,，。、]|$)`, "g");
    if (regex.test(text)) {
      foundMetrics.push(metric);
    }
  }

  // 额外检查：数字 + % 可能是指标
  const percentMatches = text.match(/\d+(\.\d+)?%/g);
  if (percentMatches) {
    // 这些是具体数值，不是指标名称，跳过
  }

  return [...new Set(foundMetrics)];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 验证报告中的指标
 */
export function validateMetrics(
  reportText: string,
  allowedMetrics: string[],
  forbiddenMetrics: string[]
): MetricsValidationResult {
  const checks: ValidationCheck[] = [];
  const foundMetrics = extractMetricsFromText(reportText);

  // Check 1: 报告中不能出现 forbidden_metrics
  const foundForbidden = foundMetrics.filter((m) =>
    forbiddenMetrics.some((fm) => m.includes(fm) || fm.includes(m))
  );

  checks.push({
    name: "no_forbidden_metrics",
    passed: foundForbidden.length === 0,
    message: foundForbidden.length === 0
      ? "报告中未出现禁止的指标"
      : `报告中出现了 ${foundForbidden.length} 个禁止的指标: ${foundForbidden.join(", ")}`,
    details: { forbidden_found: foundForbidden },
  });

  // Check 2: 报告中出现的指标应尽量来自 allowed_metrics
  const hallucinatedMetrics = foundMetrics.filter(
    (m) =>
      !allowedMetrics.some((am) => m.includes(am) || am.includes(m)) &&
      !forbiddenMetrics.some((fm) => m.includes(fm) || fm.includes(m))
  );

  checks.push({
    name: "metrics_from_allowed_list",
    passed: hallucinatedMetrics.length === 0,
    message: hallucinatedMetrics.length === 0
      ? "所有指标都在允许列表中"
      : `${hallucinatedMetrics.length} 个指标不在允许列表中: ${hallucinatedMetrics.join(", ")}`,
    details: {
      hallucinated: hallucinatedMetrics,
      allowed: allowedMetrics,
    },
  });

  const failed_checks = checks.filter((c) => !c.passed);

  return {
    valid: failed_checks.length === 0,
    checks,
    failed_checks,
    stats: {
      forbidden_metric_count: foundForbidden.length,
      hallucinated_metric_count: hallucinatedMetrics.length,
      allowed_metric_count: foundMetrics.length - foundForbidden.length - hallucinatedMetrics.length,
    },
  };
}
