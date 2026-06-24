/**
 * 语义验证模块
 * 使用 DeepSeek 进行语义审查
 */

import { getValidationAIProvider } from "@/lib/ai";
import type { SemanticReviewResult } from "./types";
import { z } from "zod";

// Zod schema for DeepSeek response
const SemanticIssueSchema = z.object({
  type: z.enum([
    "metric_mismatch",
    "product_name",
    "unsupported_claim",
    "inconsistency",
    "over_inference",
  ]),
  description: z.string(),
  severity: z.enum(["error", "warning"]),
  location: z.string().optional(),
});

const SemanticReviewSchema = z.object({
  has_issues: z.boolean(),
  issues: z.array(SemanticIssueSchema),
  summary: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

/**
 * 使用 DeepSeek 进行语义审查
 */
export async function validateSemantic(
  reportText: string,
  project: {
    name: string;
    product_type?: string | null;
    business_goal?: string | null;
    target_user?: string | null;
    key_metric?: string | null;
  },
  clusters: {
    name: string;
    summary: string;
    feedback_count: number;
    opportunity_score: number | null;
    priority: string | null;
  }[]
): Promise<{
  result: SemanticReviewResult;
  provider: string;
  model: string;
  fallback: boolean;
}> {
  const { provider, providerName, modelName, fallback } = getValidationAIProvider();

  const system = `你是一个产品报告审查专家。请审查以下产品反馈分析报告，检查是否存在以下问题：

1. metric_mismatch: 指标与产品类型不匹配（如 B端 SaaS 报告写 DAU 增长）
2. product_name: 把用户名、竞品名当作产品名
3. unsupported_claim: 没有证据支撑的数字声明
4. inconsistency: 报告内容与提供的数据不一致
5. over_inference: 过度推断，超出数据支撑范围

重要规则：
- 只报告确实存在的问题，不要过度敏感
- 如果报告没有问题，返回 has_issues: false
- 输出严格 JSON 格式`;

  const clustersSummary = clusters
    .map(
      (c) =>
        `- ${c.name}: ${c.feedback_count} 条反馈, 机会分 ${c.opportunity_score || 0}, 优先级 ${c.priority || "P3"}`
    )
    .join("\n");

  const user = `产品背景：
- 产品名称：${project.name}
- 产品类型：${project.product_type || "未指定"}
- 业务目标：${project.business_goal || "未指定"}
- 目标用户：${project.target_user || "未指定"}
- 关键指标：${project.key_metric || "未指定"}

聚类结果：
${clustersSummary}

请审查以下报告：

${reportText}

请输出 JSON：
{
  "has_issues": true/false,
  "issues": [
    {
      "type": "metric_mismatch|product_name|unsupported_claim|inconsistency|over_inference",
      "description": "问题描述",
      "severity": "error|warning",
      "location": "问题位置（可选）"
    }
  ],
  "summary": "总体评价",
  "confidence": "high|medium|low"
}`;

  try {
    const response = await provider.generateJSON<z.infer<typeof SemanticReviewSchema>>({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schemaName: "SemanticReview",
      temperature: 0.1,
    });

    // Validate with Zod
    const validated = SemanticReviewSchema.parse(response);

    return {
      result: validated,
      provider: providerName,
      model: modelName,
      fallback,
    };
  } catch (error) {
    console.error("Semantic validation error:", error);

    // Return warning state on failure
    return {
      result: {
        has_issues: false,
        issues: [],
        summary: `语义验证失败: ${error instanceof Error ? error.message : "未知错误"}`,
        confidence: "low",
      },
      provider: providerName,
      model: modelName,
      fallback: true,
    };
  }
}
