/**
 * DeepSeek 验证报告脚本
 * 运行: pnpm validate:report
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const VALIDATION_DIR = path.join(__dirname, "..", "validation-reports");

interface ValidationResult {
  dataset: string;
  status: "pass" | "warning" | "fail";
  score: number;
  model_roles: {
    generator: string;
    validator: string;
  };
  summary: {
    feedback_count: number;
    cluster_count: number;
    invalid_evidence_count: number;
    forbidden_metric_count: number;
    hallucination_count: number;
    over_inference_count: number;
  };
  score_breakdown: {
    data_realism: number;
    theme_coverage: number;
    cluster_accuracy: number;
    evidence_accuracy: number;
    metric_fit: number;
    format_compliance: number;
    conclusion_credibility: number;
    no_hallucination: number;
  };
  training_decision: {
    usable_for_training: boolean;
    usable_for_testing: boolean;
    usable_for_regression: boolean;
    requires_human_review: boolean;
  };
  failed_checks: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * 使用 DeepSeek 验证报告
 */
export async function validateReportWithDeepSeek(dataset: string): Promise<{ status: string; score: number }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_VALIDATION_MODEL || "deepseek-v4-pro";

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is required");
  }

  // Read files - support both old and new file naming
  let mdPath = path.join(FIXTURES_DIR, "analysis", `${dataset}.overall.analysis.md`);
  let jsonPath = path.join(FIXTURES_DIR, "analysis", `${dataset}.overall.analysis.json`);
  let normalizedPath = path.join(FIXTURES_DIR, "normalized", `${dataset}.normalized.json`);

  // Fallback to old naming
  if (!fs.existsSync(mdPath)) {
    mdPath = path.join(FIXTURES_DIR, "analysis", `${dataset}.analysis.md`);
  }
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.join(FIXTURES_DIR, "analysis", `${dataset}.analysis.json`);
  }

  if (!fs.existsSync(mdPath)) throw new Error("analysis.md not found");
  if (!fs.existsSync(jsonPath)) throw new Error("analysis.json not found");

  const mdContent = fs.readFileSync(mdPath, "utf-8");
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  // Get feedback count from normalized data or json
  let feedbackCount = jsonContent.summary?.total_feedback_count || 0;
  if (feedbackCount === 0 && fs.existsSync(normalizedPath)) {
    const normalized = JSON.parse(fs.readFileSync(normalizedPath, "utf-8"));
    feedbackCount = normalized.length;
  }

  // Call DeepSeek for validation
  const result = await validateWithAI(
    apiKey,
    baseUrl,
    model,
    dataset,
    mdContent,
    jsonContent,
    feedbackCount
  );

  // Save validation report
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  fs.mkdirSync(VALIDATION_DIR, { recursive: true });

  // Save JSON
  const jsonReportPath = path.join(VALIDATION_DIR, `${dataset}-${timestamp}.json`);
  fs.writeFileSync(jsonReportPath, JSON.stringify(result, null, 2), "utf-8");

  // Save MD
  const mdReportPath = path.join(VALIDATION_DIR, `${dataset}-${timestamp}.md`);
  fs.writeFileSync(mdReportPath, generateMarkdownReport(result), "utf-8");

  return { status: result.status, score: result.score };
}

async function validateWithAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  dataset: string,
  mdContent: string,
  jsonContent: any,
  feedbackCount: number
): Promise<ValidationResult> {
  const system = `你是一个产品报告验证专家。请验证以下产品分析报告的准确性。

评分维度（总分 100）：
- 数据真实性 (15分): 反馈数量、聚类数量是否准确
- 主题覆盖度 (15分): 是否覆盖了主要问题
- 聚类准确性 (15分): 聚类是否合理
- 证据引用准确性 (15分): evidence_feedback_ids 是否真实存在
- 指标匹配度 (10分): 指标是否匹配产品类型
- 报告格式合规性 (10分): 是否符合报告格式
- 结论可信度 (10分): 结论是否有证据支撑
- 无幻觉/无过度推断 (10分): 是否存在幻觉

重点检查以下 warning 类型：
1. count_mismatch: 反馈数量前后不一致
2. markdown_json_mixed: Markdown 混入 JSON
3. missing_analysis_json: 缺少独立 analysis.json
4. missing_structured_evidence: 缺少结构化证据
5. partial_sample_overclaim: 部分样本冒充全量结论
6. top5_incomplete: Top 5 不完整
7. over_inference: 过度推断
8. forbidden_metric: 出现禁止指标

状态规则：
- score >= 90: pass
- score 70-89: warning
- score < 70: fail`;

  const user = `数据集: ${dataset}
原始反馈数量: ${feedbackCount}
问题簇数量: ${jsonContent.issue_clusters?.length || 0}

分析报告：
${mdContent}

结构化数据：
${JSON.stringify(jsonContent, null, 2)}

请验证报告并输出 JSON：
{
  "dataset": "${dataset}",
  "status": "pass/warning/fail",
  "score": 0-100,
  "model_roles": {
    "generator": "mimo",
    "validator": "${model}"
  },
  "summary": {
    "feedback_count": ${feedbackCount},
    "cluster_count": ${jsonContent.issue_clusters?.length || 0},
    "invalid_evidence_count": 0,
    "forbidden_metric_count": 0,
    "hallucination_count": 0,
    "over_inference_count": 0
  },
  "warning_types": [],
  "score_breakdown": {
    "data_realism": 0-15,
    "theme_coverage": 0-15,
    "cluster_accuracy": 0-15,
    "evidence_accuracy": 0-15,
    "metric_fit": 0-10,
    "format_compliance": 0-10,
    "conclusion_credibility": 0-10,
    "no_hallucination": 0-10
  },
  "training_decision": {
    "usable_for_training": true/false,
    "usable_for_testing": true/false,
    "usable_for_regression": true/false,
    "requires_human_review": true/false
  },
  "failed_checks": [],
  "warnings": [],
  "recommendations": []
}`;

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "";

  // Extract JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse DeepSeek response as JSON");
  }

  return JSON.parse(jsonMatch[0]);
}

function generateMarkdownReport(result: ValidationResult): string {
  const statusEmoji = result.status === "pass" ? "✅" : result.status === "warning" ? "⚠️" : "❌";

  return `# Agent 报告验证与评分结果

## 基本信息
- Dataset: ${result.dataset}
- Generator Model: MiMo
- Validator Model: ${result.model_roles.validator}
- Status: ${statusEmoji} ${result.status}
- Score: ${result.score}/100

## 一、总体判断

${result.status === "pass" ? "报告质量良好，可以用于训练。" : result.status === "warning" ? "报告存在一些问题，建议人工复核。" : "报告存在严重问题，不建议使用。"}

## 二、评分明细

| 维度 | 分值 | 满分 |
|------|------|------|
| 数据真实性 | ${result.score_breakdown.data_realism} | 15 |
| 主题覆盖度 | ${result.score_breakdown.theme_coverage} | 15 |
| 聚类准确性 | ${result.score_breakdown.cluster_accuracy} | 15 |
| 证据引用准确性 | ${result.score_breakdown.evidence_accuracy} | 15 |
| 指标匹配度 | ${result.score_breakdown.metric_fit} | 10 |
| 报告格式合规性 | ${result.score_breakdown.format_compliance} | 10 |
| 结论可信度 | ${result.score_breakdown.conclusion_credibility} | 10 |
| 无幻觉/无过度推断 | ${result.score_breakdown.no_hallucination} | 10 |

## 三、数据真实性检查

反馈数量: ${result.summary.feedback_count}
问题簇数量: ${result.summary.cluster_count}
无效证据数: ${result.summary.invalid_evidence_count}

## 四、主题覆盖检查

待补充

## 五、聚类准确性检查

待补充

## 六、证据引用检查

待补充

## 七、指标匹配检查

禁止指标出现: ${result.summary.forbidden_metric_count}

## 八、报告格式检查

待补充

## 九、幻觉与过度推断检查

幻觉数量: ${result.summary.hallucination_count}
过度推断数量: ${result.summary.over_inference_count}

## 十、是否可进入训练/测试/回归集

- 可用于训练: ${result.training_decision.usable_for_training ? "是" : "否"}
- 可用于测试: ${result.training_decision.usable_for_testing ? "是" : "否"}
- 可用于回归: ${result.training_decision.usable_for_regression ? "是" : "否"}
- 需要人工复核: ${result.training_decision.requires_human_review ? "是" : "否"}

## 十一、修复建议

${result.recommendations.length > 0 ? result.recommendations.map((r) => `- ${r}`).join("\n") : "无"}
`;
}

// CLI entry point
if (require.main === module) {
  const dataset = process.argv[2];
  if (!dataset) {
    console.error("Usage: tsx validate-report-with-deepseek.ts <dataset>");
    process.exit(1);
  }

  validateReportWithDeepSeek(dataset)
    .then((result) => console.log(`${dataset}: ${result.status}, score ${result.score}`))
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}
