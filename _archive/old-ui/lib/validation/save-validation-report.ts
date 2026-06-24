/**
 * 验证报告文件保存模块
 */

import * as fs from "fs";
import * as path from "path";
import type { ValidationResult } from "./types";

interface SaveReportInput {
  projectId: string;
  analysisRunId: string;
  projectName: string;
  validationResult: ValidationResult;
}

/**
 * 保存验证报告到文件系统
 */
export function saveValidationReport(input: SaveReportInput): {
  jsonPath: string | null;
  mdPath: string | null;
  error?: string;
} {
  try {
    const baseDir = path.join(
      process.cwd(),
      "validation-reports",
      input.projectId,
      input.analysisRunId
    );

    // Create directory
    fs.mkdirSync(baseDir, { recursive: true });

    // Save JSON report
    const jsonPath = path.join(baseDir, "validation-report.json");
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          project_id: input.projectId,
          analysis_run_id: input.analysisRunId,
          project_name: input.projectName,
          validated_at: new Date().toISOString(),
          ...input.validationResult,
        },
        null,
        2
      ),
      "utf-8"
    );

    // Save Markdown report
    const mdPath = path.join(baseDir, "validation-report.md");
    const mdContent = generateMarkdownReport(input);
    fs.writeFileSync(mdPath, mdContent, "utf-8");

    return { jsonPath, mdPath };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    console.error("Failed to save validation report:", error);
    return { jsonPath: null, mdPath: null, error: errorMessage };
  }
}

/**
 * 生成 Markdown 格式的验证报告
 */
function generateMarkdownReport(input: SaveReportInput): string {
  const { projectName, validationResult: result } = input;

  const statusEmoji =
    result.status === "passed" ? "✅" : result.status === "warning" ? "⚠️" : "❌";
  const statusText =
    result.status === "passed"
      ? "通过"
      : result.status === "warning"
      ? "有风险"
      : "未通过";

  let md = `# 验证报告

## 基本信息

- **产品名称**：${projectName}
- **验证时间**：${new Date().toLocaleString("zh-CN")}
- **验证状态**：${statusEmoji} ${statusText}
- **验证分数**：${result.score}/100

## 验证摘要

| 检查项 | 结果 |
|--------|------|
| 总检查数 | ${result.summary.total_checks} |
| 通过 | ${result.summary.passed_checks} |
| 失败 | ${result.summary.failed_checks} |
| 警告 | ${result.summary.warning_checks} |

`;

  // Feedback count check
  md += `## 反馈数量校验

- 期望数量：${result.feedback_count_check.expected_count}
- 实际数量：${result.feedback_count_check.actual_count}
- 状态：${result.feedback_count_check.match ? "✅ 匹配" : "❌ 不匹配"}

`;

  // Cluster check
  md += `## 问题簇校验

- 总簇数：${result.cluster_check.total_clusters}
- 有效簇数：${result.cluster_check.valid_clusters}
- 无效簇数：${result.cluster_check.invalid_clusters}
- 缺少证据：${result.cluster_check.missing_evidence}
- 证据不足：${result.cluster_check.insufficient_evidence}
- 无效证据 ID：${result.cluster_check.invalid_evidence_ids}

`;

  // Metric check
  md += `## 指标校验

- 禁止指标出现：${result.metric_check.forbidden_found.length > 0 ? result.metric_check.forbidden_found.join(", ") : "无"}
- 幻觉指标：${result.metric_check.hallucinated_found.length > 0 ? result.metric_check.hallucinated_found.join(", ") : "无"}

`;

  // Hallucination check
  md += `## 幻觉校验

- 未定义产品名：${result.hallucination_check.undefined_product_names.length > 0 ? result.hallucination_check.undefined_product_names.join(", ") : "无"}
- 未定义问题名：${result.hallucination_check.undefined_cluster_names.length > 0 ? result.hallucination_check.undefined_cluster_names.join(", ") : "无"}
- 可疑数字：${result.hallucination_check.invalid_numbers}
- 不匹配指标：${result.hallucination_check.mismatched_metrics.length > 0 ? result.hallucination_check.mismatched_metrics.join(", ") : "无"}

`;

  // Semantic review
  if (result.semantic_review) {
    md += `## 语义审查

- **验证提供者**：${result.validation_provider || "unknown"}
- **验证模型**：${result.validation_model || "unknown"}
- **模型降级**：${result.model_fallback ? "是" : "否"}
- **置信度**：${result.semantic_review.confidence}
- **总体评价**：${result.semantic_review.summary}

`;
    if (result.semantic_review.issues.length > 0) {
      md += `### 发现的问题

`;
      for (const issue of result.semantic_review.issues) {
        md += `- **${issue.type}** (${issue.severity}): ${issue.description}\n`;
      }
      md += "\n";
    }
  }

  // Failed checks
  if (result.failed_checks.length > 0) {
    md += `## 失败项

`;
    for (const check of result.failed_checks) {
      md += `- ❌ ${check.message}\n`;
    }
    md += "\n";
  }

  // Warnings
  if (result.warnings.length > 0) {
    md += `## 风险项

`;
    for (const warning of result.warnings) {
      md += `- ⚠️ ${warning.message}\n`;
    }
    md += "\n";
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    md += `## 修复建议

`;
    for (const rec of result.recommendations) {
      md += `- ${rec}\n`;
    }
    md += "\n";
  }

  return md;
}
