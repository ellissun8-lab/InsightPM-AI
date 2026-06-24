/**
 * 指标验证模块
 */

import type { MetricCheck, ValidationCheck } from "./types";
import { getDefaultMetrics, inferProductType } from "@/lib/config/product-analysis-context";

// 常见指标关键词
const COMMON_METRICS = [
  "DAU", "MAU", "WAU", "GMV", "ARPU", "LTV", "CAC",
  "续费率", "续费", "留存率", "留存", "转化率", "转化",
  "客单价", "NPS", "CSAT", "满意度", "DAU/MAU", "活跃率",
  "复购率", "复购", "退货率", "退货", "客服成本", "工单量",
  "管理员效率", "管理效率", "功能采纳率", "采纳率",
  "试用转化率", "试用转化", "数据准确性", "数据质量",
  "员工满意度", "用户满意度", "响应时间", "响应速度",
  "流失率", "客户健康分",
];

// B端 SaaS 禁止的 C端指标
const B2B_FORBIDDEN = ["DAU", "MAU", "GMV", "客单价", "复购率", "加购率"];

// C端禁止的 B端指标
const B2C_FORBIDDEN = ["续费率", "管理员效率", "客服成本", "工单量"];

/**
 * 从报告文本中提取提到的指标
 */
function extractMetricsFromText(text: string): string[] {
  const foundMetrics: string[] = [];

  for (const metric of COMMON_METRICS) {
    const regex = new RegExp(
      `(^|[\\s,，。、])${escapeRegex(metric)}([\\s,，。、]|$)`,
      "g"
    );
    if (regex.test(text)) {
      foundMetrics.push(metric);
    }
  }

  return [...new Set(foundMetrics)];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 获取禁止指标
 */
function getForbiddenMetrics(productType: string | null): string[] {
  if (!productType) return [];

  const type = inferProductType(productType);
  switch (type) {
    case "b2b_saas":
      return B2B_FORBIDDEN;
    case "b2c":
      return B2C_FORBIDDEN;
    default:
      return [];
  }
}

/**
 * 验证报告中的指标
 */
export function validateMetrics(
  reportText: string,
  productType: string | null,
  allowedMetrics?: string[]
): MetricCheck {
  const checks: ValidationCheck[] = [];
  const foundMetrics = extractMetricsFromText(reportText);

  // Get forbidden metrics based on product type
  const forbiddenMetrics = getForbiddenMetrics(productType);

  // Get allowed metrics
  const defaultAllowed = getDefaultMetrics(productType);
  const allowed = allowedMetrics || defaultAllowed;

  // Check forbidden metrics
  const foundForbidden = foundMetrics.filter((m) =>
    forbiddenMetrics.some((fm) => m.includes(fm) || fm.includes(m))
  );

  if (foundForbidden.length > 0) {
    checks.push({
      name: "forbidden_metrics",
      passed: false,
      message: `报告中出现了 ${foundForbidden.length} 个禁止的指标: ${foundForbidden.join(", ")}`,
      severity: "error",
      details: { forbidden_found: foundForbidden },
    });
  } else {
    checks.push({
      name: "forbidden_metrics",
      passed: true,
      message: "报告中未出现禁止的指标",
      severity: "info",
    });
  }

  // Check hallucinated metrics (not in allowed list)
  const hallucinated = foundMetrics.filter(
    (m) =>
      !allowed.some((am) => m.includes(am) || am.includes(m)) &&
      !forbiddenMetrics.some((fm) => m.includes(fm) || fm.includes(m))
  );

  if (hallucinated.length > 0) {
    checks.push({
      name: "hallucinated_metrics",
      passed: false,
      message: `${hallucinated.length} 个指标不在允许列表中: ${hallucinated.join(", ")}`,
      severity: "warning",
      details: { hallucinated, allowed },
    });
  } else {
    checks.push({
      name: "hallucinated_metrics",
      passed: true,
      message: "所有指标都在允许列表中",
      severity: "info",
    });
  }

  return {
    forbidden_found: foundForbidden,
    hallucinated_found: hallucinated,
    allowed_count: foundMetrics.length - foundForbidden.length - hallucinated.length,
    checks,
  };
}
