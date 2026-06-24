/**
 * 幻觉验证模块
 */

import type { HallucinationCheck, ValidationCheck } from "./types";

/**
 * 从报告中提取数字声明
 */
function extractNumberClaims(reportText: string): { claim: string; number: number }[] {
  const claims: { claim: string; number: number }[] = [];

  // Match patterns like "XX 问题共 N 条反馈" or "占比 N%"
  const patterns = [
    /(.{5,30}?)\s*(?:共|有|占比)\s*(\d+)\s*(?:条|%|个)/g,
    /(\d+)\s*(?:条|%|个)\s*(.{5,30})/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(reportText)) !== null) {
      const num = parseInt(match[2] || match[1], 10);
      if (!isNaN(num) && num > 0) {
        claims.push({
          claim: match[0],
          number: num,
        });
      }
    }
  }

  return claims;
}

/**
 * 检查未定义的产品名
 */
function findUndefinedProductNames(
  reportText: string,
  definedProductName: string
): string[] {
  // Look for product-like names that aren't the defined product
  const productPatterns = [
    /(?:产品|项目|系统|平台|工具|软件)[：:]\s*(.+?)(\n|。|，)/g,
    /【(.+?)】/g,
  ];

  const foundNames: string[] = [];
  for (const pattern of productPatterns) {
    let match;
    while ((match = pattern.exec(reportText)) !== null) {
      const name = match[1].trim();
      if (
        name &&
        name !== definedProductName &&
        name.length > 2 &&
        name.length < 20 &&
        !name.includes("报告") &&
        !name.includes("分析")
      ) {
        foundNames.push(name);
      }
    }
  }

  return [...new Set(foundNames)];
}

/**
 * 检查不存在的 cluster 名称
 */
function findUndefinedClusterNames(
  reportText: string,
  definedClusterNames: string[]
): string[] {
  const undefinedNames: string[] = [];

  // Extract names from tables and headers
  const namePatterns = [
    /\|\s*\d+\s*\|\s*(.+?)\s*\|/g,
    /###\s+(.+?)(\n|$)/g,
  ];

  const excludePatterns = [
    "问题名称", "---", "P0", "P1", "P2", "P3",
    "排名", "优先级", "机会分", "反馈数", "置信度",
  ];

  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(reportText)) !== null) {
      const name = match[1].trim();
      if (
        name &&
        !excludePatterns.includes(name) &&
        !name.match(/^[P0-3]+$/) &&
        name.length > 2
      ) {
        const exists = definedClusterNames.some(
          (cn) => cn === name || cn.includes(name) || name.includes(cn)
        );
        if (!exists) {
          undefinedNames.push(name);
        }
      }
    }
  }

  return [...new Set(undefinedNames)];
}

/**
 * 验证幻觉
 */
export function validateHallucinations(
  reportText: string,
  productName: string,
  clusterNames: string[],
  productType: string | null,
  allowedMetrics: string[]
): HallucinationCheck {
  const checks: ValidationCheck[] = [];

  // Check 1: Undefined product names
  const undefinedProductNames = findUndefinedProductNames(reportText, productName);

  checks.push({
    name: "undefined_product_names",
    passed: undefinedProductNames.length === 0,
    message:
      undefinedProductNames.length === 0
        ? "报告中未出现未定义的产品名"
        : `报告中出现了 ${undefinedProductNames.length} 个未定义的产品名: ${undefinedProductNames.join(", ")}`,
    severity: undefinedProductNames.length > 0 ? "error" : "info",
    details: { undefined_names: undefinedProductNames },
  });

  // Check 2: Undefined cluster names
  const undefinedClusterNames = findUndefinedClusterNames(reportText, clusterNames);

  checks.push({
    name: "undefined_cluster_names",
    passed: undefinedClusterNames.length === 0,
    message:
      undefinedClusterNames.length === 0
        ? "报告中未出现未定义的问题名称"
        : `报告中出现了 ${undefinedClusterNames.length} 个未定义的问题名称`,
    severity: undefinedClusterNames.length > 0 ? "error" : "info",
    details: { undefined_names: undefinedClusterNames },
  });

  // Check 3: Number claims (basic check)
  const numberClaims = extractNumberClaims(reportText);
  let invalidNumbers = 0;

  // This is a basic check - in a real system, you'd verify against actual data
  for (const claim of numberClaims) {
    if (claim.number > 10000) {
      // Suspiciously large number
      invalidNumbers++;
    }
  }

  checks.push({
    name: "number_claims",
    passed: invalidNumbers === 0,
    message:
      invalidNumbers === 0
        ? "报告中的数字声明合理"
        : `发现 ${invalidNumbers} 个可疑的数字声明`,
    severity: invalidNumbers > 0 ? "warning" : "info",
  });

  // Check 4: Mismatched metrics (already covered in validate-metrics, but double check)
  const b2bForbidden = ["DAU", "MAU", "GMV", "客单价", "复购率"];
  const b2cForbidden = ["续费率", "管理员效率", "客服成本"];

  const isB2B =
    productType?.includes("B端") ||
    productType?.includes("SaaS") ||
    productType?.includes("企业");

  const forbidden = isB2B ? b2bForbidden : b2cForbidden;
  const mismatchedMetrics: string[] = [];

  for (const metric of forbidden) {
    if (reportText.includes(metric)) {
      mismatchedMetrics.push(metric);
    }
  }

  checks.push({
    name: "mismatched_metrics",
    passed: mismatchedMetrics.length === 0,
    message:
      mismatchedMetrics.length === 0
        ? "报告中未出现不匹配的指标"
        : `报告中出现了 ${mismatchedMetrics.length} 个不匹配的指标`,
    severity: mismatchedMetrics.length > 0 ? "error" : "info",
    details: { mismatched_metrics: mismatchedMetrics },
  });

  return {
    undefined_product_names: undefinedProductNames,
    undefined_cluster_names: undefinedClusterNames,
    invalid_numbers: invalidNumbers,
    mismatched_metrics: mismatchedMetrics,
    checks,
  };
}
