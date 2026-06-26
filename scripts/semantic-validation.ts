/**
 * InsightPM AI DeepSeek Semantic Validation
 * 运行: npx tsx scripts/semantic-validation.ts --case mixed-feedback-realism-v1 --model deepseek-v4-pro
 *
 * 对 analysis JSON 和 Markdown 报告进行语义质量评分。
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const RUNS_DIR = path.join(__dirname, "..", "runs");

interface SemanticCheckResult {
  name: string;
  status: "pass" | "warning" | "fail";
  score: number;
  maxScore: number;
  message: string;
  details?: string[];
}

interface SemanticValidationResult {
  caseName: string;
  model: string;
  timestamp: string;
  semanticScore: number;
  status: "pass" | "warning" | "fail";
  criticalIssues: number;
  warnings: string[];
  passedChecks: number;
  failedChecks: number;
  checks: SemanticCheckResult[];
  recommendations: string[];
  hardValidation: {
    status: string;
    score: number;
    fail: number;
    warning: number;
    pass: number;
  };
  evidenceBroken: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let caseName = "mixed-feedback-realism-v1";
  let model = process.env.DEEPSEEK_VALIDATION_MODEL || "deepseek-v4-pro";
  let dataset = "";
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--case" && args[i + 1]) caseName = args[++i];
    if (args[i] === "--model" && args[i + 1]) model = args[++i];
    if (args[i] === "--dataset" && args[i + 1]) dataset = args[++i];
    if (args[i] === "--output" && args[i + 1]) output = args[++i];
    if (args[i] === "--run-dir" && args[i + 1]) output = args[++i];
  }

  // Derive dataset from caseName if not specified:
  // "mixed-feedback-realism-v1" → "mixed-feedback", "enterprise-saas-renewal-v1" → "enterprise-saas-renewal"
  if (!dataset) {
    const match = caseName.match(/^(.+)-v\d+$/);
    dataset = match ? match[1] : "mixed-feedback";
  }

  return { caseName, model, dataset, output };
}

function loadJson(p: string): any {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

function readText(p: string): string {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + "\n... [truncated]";
}

async function callDeepSeek(
  apiKey: string,
  baseUrl: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
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
  return data.choices[0]?.message?.content || "";
}

function buildSystemPrompt(): string {
  return `你是一个产品分析报告的语义验证专家。你的任务是对 AI 生成的产品分析报告进行 10 项语义检查，每项给出 pass/warning/fail 评分。

## 10 项检查维度

1. **evidence_support** (10分): 结论是否有 evidence_feedback_ids 支撑。每条结论必须引用真实 feedback ID。
2. **recommendation_match** (10分): 建议是否匹配发现的问题。建议必须针对已识别的问题，不能凭空建议。
3. **priority合理性** (10分): priority (P0/P1/P2) 是否合理。P0=高频+高影响，P1=中频或需验证，P2=低频或建议性。
4. **opportunity_score合理性** (10分): opportunity_score (0-100) 是否与 feedback_count 和 priority 匹配。
5. **过度推断** (10分): 是否存在从少量反馈中得出过于宽泛结论的情况。
6. **boss_summary准确性** (10分): 老板摘要是否准确反映核心问题，不夸大不遗漏。
7. **高频问题遗漏** (10分): 是否遗漏了高频问题（feedback_count >= 5 的问题必须出现在报告中）。
8. **非业务内容隔离** (10分): noise/positive/unknown 是否被错误归入业务机会分析。
9. **low_confidence标记** (10分): feedback_count=1 的问题是否被标记为 needs_validation 或 low_confidence。
10. **JSON_MD一致性** (10分): Markdown 报告是否忠实反映 JSON 数据，不添加 JSON 中不存在的信息。

## 输出格式

你必须输出严格 JSON，不要包含任何其他文本：
{
  "checks": [
    {
      "name": "evidence_support",
      "status": "pass/warning/fail",
      "score": 0-10,
      "maxScore": 10,
      "message": "简要说明",
      "details": ["具体问题1", "具体问题2"]
    }
  ],
  "criticalIssues": ["严重问题描述"],
  "warnings": ["警告描述"],
  "recommendations": ["改进建议"]
}

## 评分规则
- pass: 该维度得分 >= 8
- warning: 该维度得分 5-7
- fail: 该维度得分 < 5
- criticalIssue: 任何维度 fail 或 evidence 断链`;
}

function buildUserPrompt(
  caseName: string,
  overallJson: any,
  overallMd: string,
  segmentJsons: { id: string; json: any }[],
  segmentMds: { id: string; md: string }[],
  normalized: any[],
  hardVal: any
): string {
  // Truncate MDs to fit context
  const overallMdTruncated = truncate(overallMd, 8000);
  const segmentMdsTruncated = segmentMds
    .map(s => `### ${s.id}\n${truncate(s.md, 2000)}`)
    .join("\n\n");

  // Summarize normalized data - 传递所有 feedback，以便 AI 验证 evidence_feedback_ids
  const feedbackSummary = normalized.map(n => ({
    feedback_id: n.feedback_id,
    text: (n.cleaned_content || n.text || n.normalized_text || "").substring(0, 80),
    detected_theme: n.detected_theme,
  }));

  // Summarize clusters
  const clusterSummary = (overallJson.issue_clusters || []).map((c: any) => ({
    cluster_id: c.cluster_id,
    name: c.name,
    segment_id: c.segment_id,
    feedback_count: c.feedback_count,
    priority: c.priority,
    opportunity_score: c.opportunity_score,
    evidence_count: c.evidence_feedback_ids?.length || 0,
    recommendation: (c.recommendation || "").substring(0, 100),
  }));

  return `数据集: ${caseName}
Hard Validation: ${hardVal?.status || "unknown"} (score: ${hardVal?.score || 0}, fail: ${hardVal?.summary?.fail_count || 0})
Normalized 反馈数: ${normalized.length}
Issue Clusters 数: ${clusterSummary.length}

## Overall Analysis JSON (summary)
${JSON.stringify({ segments: overallJson.segments?.map((s: any) => ({ segment_id: s.segment_id, name: s.name, type: s.type })), cluster_count: clusterSummary.length }, null, 2)}

## Issue Clusters 摘要
${JSON.stringify(clusterSummary, null, 2)}

## Normalized 反馈样本 (前10条)
${JSON.stringify(feedbackSummary, null, 2)}

## Segment JSONs 摘要
${segmentJsons.map(s => `### ${s.id}: ${s.json.issue_clusters?.length || 0} clusters`).join("\n")}

## Overall Markdown 报告
${overallMdTruncated}

## Segment Markdown 报告
${segmentMdsTruncated}

请对以上报告进行 10 项语义检查，输出 JSON 结果。`;
}

/**
 * Consistency guard: ensures hard-validation.json, semantic-validation.json,
 * and validation-summary.json all agree on hard validation fields.
 */
function assertValidationConsistency(
  hardValPath: string,
  semanticJsonPath: string,
  summaryPath: string
): void {
  const hardVal = JSON.parse(fs.readFileSync(hardValPath, "utf-8"));
  const semanticVal = JSON.parse(fs.readFileSync(semanticJsonPath, "utf-8"));
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));

  const hard = {
    status: hardVal.status,
    score: hardVal.score,
    pass: hardVal.summary?.pass_count ?? hardVal.summary?.pass ?? 0,
    warning: hardVal.summary?.warning_count ?? hardVal.summary?.warning ?? 0,
    fail: hardVal.summary?.fail_count ?? hardVal.summary?.fail ?? 0,
  };

  const fromSemantic = semanticVal.hardValidation;
  const fromSummary = summary.hardValidation;

  const errors: string[] = [];

  for (const [field, expected] of Object.entries(hard)) {
    if (fromSemantic[field] !== expected) {
      errors.push(`semantic-validation.json hardValidation.${field} = ${fromSemantic[field]}, expected ${expected}`);
    }
    if (fromSummary[field] !== expected) {
      errors.push(`validation-summary.json hardValidation.${field} = ${fromSummary[field]}, expected ${expected}`);
    }
  }

  if (errors.length > 0) {
    console.error("");
    console.error("FATAL: Validation artifact inconsistency detected:");
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    // Delete the inconsistent files so they don't get used
    try { fs.unlinkSync(summaryPath); } catch {}
    try { fs.unlinkSync(semanticJsonPath); } catch {}
    const mdPath = semanticJsonPath.replace(".json", ".md");
    try { fs.unlinkSync(mdPath); } catch {}
    console.error("Deleted inconsistent artifacts. Fix the generation logic and re-run.");
    process.exit(1);
  }
}

async function main() {
  const { caseName, model, dataset, output } = parseArgs();
  // 如果指定了 --output / --run-dir，使用该目录；否则使用默认的 runs/{caseName}
  const runDir = output || path.join(RUNS_DIR, caseName);
  const validationDir = path.join(runDir, "validation-report");

  if (!fs.existsSync(runDir)) {
    console.error(`Run directory not found: ${runDir}`);
    process.exit(1);
  }

  // Load DeepSeek config
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  if (!apiKey) {
    console.error("DEEPSEEK_API_KEY is required");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log(`Semantic Validation: ${caseName}`);
  console.log(`Model: ${model}`);
  console.log(`Dataset: ${dataset}`);
  console.log("=".repeat(60));

  // Load all input files
  const overallJsonPath = path.join(runDir, "analysis", `${dataset}.overall.analysis.json`);
  const overallMdPath = path.join(runDir, "analysis-md", `${dataset}.overall.analysis.md`);
  const normalizedPath = path.join(runDir, "normalized", `${dataset}.normalized.json`);
  const hardValPath = path.join(runDir, "validation-report", "hard-validation.json");
  const segJsonDir = path.join(runDir, "analysis", dataset, "segments");
  const segMdDir = path.join(runDir, "analysis-md", dataset, "segments");

  const overallJson = loadJson(overallJsonPath);
  const overallMd = readText(overallMdPath);
  const normalized = loadJson(normalizedPath) || [];
  const hardVal = loadJson(hardValPath);

  if (!overallJson) {
    console.error("Overall analysis JSON not found");
    process.exit(1);
  }

  // Load segment files
  const segmentJsons: { id: string; json: any }[] = [];
  const segmentMds: { id: string; md: string }[] = [];

  if (fs.existsSync(segJsonDir)) {
    for (const f of fs.readdirSync(segJsonDir)) {
      if (f.endsWith(".analysis.json")) {
        const id = f.replace(".analysis.json", "");
        segmentJsons.push({ id, json: loadJson(path.join(segJsonDir, f)) });
      }
    }
  }
  if (fs.existsSync(segMdDir)) {
    for (const f of fs.readdirSync(segMdDir)) {
      if (f.endsWith(".analysis.md")) {
        const id = f.replace(".analysis.md", "");
        segmentMds.push({ id, md: readText(path.join(segMdDir, f)) });
      }
    }
  }

  console.log(`  Loaded: overall JSON, overall MD, ${segmentJsons.length} segment JSONs, ${segmentMds.length} segment MDs`);
  console.log(`  Normalized: ${normalized.length} feedbacks`);
  console.log(`  Hard validation: ${hardVal?.status || "unknown"} (score: ${hardVal?.score || 0})`);

  // Count evidence broken (from hard validation or compute)
  let evidenceBroken = 0;
  if (hardVal) {
    const evidenceCheck = hardVal.checks?.find((c: any) => c.name === "evidence_trace_check");
    if (evidenceCheck && evidenceCheck.status === "fail") {
      const match = evidenceCheck.message.match(/(\d+)/);
      if (match) evidenceBroken = parseInt(match[1], 10);
    }
  }

  // Call DeepSeek
  console.log("");
  console.log("  Calling DeepSeek for semantic validation...");
  const startTime = Date.now();

  const system = buildSystemPrompt();
  const user = buildUserPrompt(caseName, overallJson, overallMd, segmentJsons, segmentMds, normalized, hardVal);

  let aiResponse: string;
  try {
    aiResponse = await callDeepSeek(apiKey, baseUrl, model, system, user);
  } catch (error) {
    console.error("DeepSeek API call failed:", error);
    process.exit(1);
  }

  const duration = Date.now() - startTime;
  console.log(`  Response received (${duration}ms, ${aiResponse.length} chars)`);

  // Parse response
  let aiResult: any;
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    aiResult = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to parse DeepSeek response:", error);
    console.error("Response:", aiResponse.substring(0, 500));
    process.exit(1);
  }

  // Compute overall score
  const checks: SemanticCheckResult[] = (aiResult.checks || []).map((c: any) => ({
    name: c.name,
    status: c.status,
    score: c.score,
    maxScore: c.maxScore || 10,
    message: c.message,
    details: c.details,
  }));

  const semanticScore = checks.reduce((sum, c) => sum + c.score, 0);
  const maxPossible = checks.reduce((sum, c) => sum + c.maxScore, 0);
  const normalizedScore = maxPossible > 0 ? Math.round((semanticScore / maxPossible) * 100) : 0;

  // Derive criticalIssues from actual check scores, not from AI's count.
  // A critical issue is any check that scores below the fail threshold (< 5).
  const criticalIssues = checks.filter(c => c.score < 5).length;
  const passedChecksCount = checks.filter(c => c.status === "pass").length;
  const failedChecksCount = checks.filter(c => c.status === "fail").length;

  let status: "pass" | "warning" | "fail" = "pass";
  if (normalizedScore < 70 || criticalIssues > 0) status = "fail";
  else if (normalizedScore < 85) status = "warning";

  const result: SemanticValidationResult = {
    caseName,
    model,
    timestamp: new Date().toISOString(),
    semanticScore: normalizedScore,
    status,
    criticalIssues,
    warnings: aiResult.warnings || [],
    passedChecks: passedChecksCount,
    failedChecks: failedChecksCount,
    checks,
    recommendations: aiResult.recommendations || [],
    hardValidation: {
      status: hardVal?.status || "unknown",
      score: hardVal?.score || 0,
      fail: hardVal?.summary?.fail_count || 0,
      warning: hardVal?.summary?.warning_count || 0,
      pass: hardVal?.summary?.pass_count || 0,
    },
    evidenceBroken,
  };

  // Save outputs
  fs.mkdirSync(validationDir, { recursive: true });

  // semantic-validation.json
  const jsonPath = path.join(validationDir, "semantic-validation.json");
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`  Saved: ${jsonPath}`);

  // semantic-validation.md
  const mdPath = path.join(validationDir, "semantic-validation.md");
  fs.writeFileSync(mdPath, generateMarkdown(result), "utf-8");
  console.log(`  Saved: ${mdPath}`);

  // validation-summary.json (combines hard + semantic)
  const summaryPath = path.join(validationDir, "validation-summary.json");
  const summary = {
    caseName,
    timestamp: new Date().toISOString(),
    hardValidation: hardVal ? {
      status: hardVal.status,
      score: hardVal.score,
      pass: hardVal.summary?.pass_count || 0,
      warning: hardVal.summary?.warning_count || 0,
      fail: hardVal.summary?.fail_count || 0,
    } : null,
    semanticValidation: {
      status: result.status,
      score: result.semanticScore,
      criticalIssues: result.criticalIssues,
      passedChecks: result.passedChecks,
      failedChecks: result.failedChecks,
    },
    overallStatus: (result.status === "pass" && (hardVal?.status === "pass" || hardVal?.status === "warning")) ? "pass" : "fail",
    passCriteria: {
      semanticScoreGte85: result.semanticScore >= 85,
      criticalIssuesZero: result.criticalIssues === 0,
      hardValidationFailZero: (hardVal?.summary?.fail_count || 0) === 0,
      evidenceBrokenZero: evidenceBroken === 0,
      allPassed: result.semanticScore >= 85 && result.criticalIssues === 0 && (hardVal?.summary?.fail_count || 0) === 0 && evidenceBroken === 0,
    },
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
  console.log(`  Saved: ${summaryPath}`);

  // --- Consistency guard ---
  assertValidationConsistency(hardValPath, jsonPath, summaryPath);

  // Print summary
  console.log("");
  console.log("=".repeat(60));
  console.log(`Hard Validation: ${result.hardValidation.status} (${result.hardValidation.score}/100, ${result.hardValidation.pass} pass, ${result.hardValidation.warning} warn, ${result.hardValidation.fail} fail)`);
  console.log(`Semantic Score: ${result.semanticScore}/100`);
  console.log(`Semantic Status: ${result.status.toUpperCase()}`);
  console.log(`Checks: ${passedChecksCount} pass, ${failedChecksCount} fail, ${checks.length - passedChecksCount - failedChecksCount} warn`);
  console.log(`Critical Issues: ${criticalIssues}`);
  console.log("");
  for (const c of checks) {
    const icon = c.status === "pass" ? "PASS" : c.status === "warning" ? "WARN" : "FAIL";
    console.log(`  ${icon} ${c.name}: ${c.score}/${c.maxScore} — ${c.message}`);
  }
  if (result.recommendations.length > 0) {
    console.log("");
    console.log("Recommendations:");
    for (const r of result.recommendations) {
      console.log(`  - ${r}`);
    }
  }
  console.log("");

  if (result.status === "fail") process.exit(1);
}

function generateMarkdown(result: SemanticValidationResult): string {
  const statusIcon = result.status === "pass" ? "PASS" : result.status === "warning" ? "WARNING" : "FAIL";

  const lines: string[] = [];
  lines.push("# DeepSeek Semantic Validation Report");
  lines.push("");
  lines.push(`**Case:** ${result.caseName}`);
  lines.push(`**Model:** ${result.model}`);
  lines.push(`**Timestamp:** ${result.timestamp}`);
  lines.push(`**Hard Validation:** ${result.hardValidation.status} (${result.hardValidation.score}/100)`);
  lines.push(`**Semantic Score:** ${result.semanticScore}/100`);
  lines.push(`**Semantic Status:** ${statusIcon}`);
  lines.push("");

  // Pass criteria
  lines.push("## Pass Criteria");
  lines.push("");
  lines.push(`| Criterion | Result |`);
  lines.push(`| --- | --- |`);
  lines.push(`| semanticScore >= 85 | ${result.semanticScore >= 85 ? "PASS" : "FAIL"} (${result.semanticScore}) |`);
  lines.push(`| criticalIssues = 0 | ${result.criticalIssues === 0 ? "PASS" : "FAIL"} (${result.criticalIssues}) |`);
  lines.push(`| hardValidation.fail = 0 | ${result.hardValidation.fail === 0 ? "PASS" : "FAIL"} (${result.hardValidation.fail}) |`);
  lines.push(`| evidenceBroken = 0 | ${result.evidenceBroken === 0 ? "PASS" : "FAIL"} (${result.evidenceBroken}) |`);
  lines.push("");

  // Check details
  lines.push("## Check Details");
  lines.push("");
  lines.push("| # | Check | Score | Status | Message |");
  lines.push("| --- | --- | --- | --- | --- |");
  result.checks.forEach((c, i) => {
    const icon = c.status === "pass" ? "PASS" : c.status === "warning" ? "WARN" : "FAIL";
    lines.push(`| ${i + 1} | ${c.name} | ${c.score}/${c.maxScore} | ${icon} | ${c.message} |`);
  });
  lines.push("");

  // Critical issues
  if (result.criticalIssues > 0) {
    lines.push("## Critical Issues");
    lines.push("");
    lines.push(`${result.criticalIssues} critical issue(s) detected.`);
    lines.push("");
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of result.warnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push("## Recommendations");
    lines.push("");
    for (const r of result.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

main().catch((error) => {
  console.error("Semantic validation failed:", error);
  process.exit(1);
});
