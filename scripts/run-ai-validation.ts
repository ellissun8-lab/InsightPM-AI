/**
 * AI 验证主流程脚本（Mock 模式）
 *
 * 运行: pnpm validate:ai
 *
 * 读取 fixtures/feedback 和 fixtures/expected，生成 mock 分析结果，
 * 然后执行 validate-clusters / validate-metrics / validate-report，
 * 最后在 validation-reports/ 下生成验证结果 JSON。
 *
 * 不依赖数据库、不依赖真实 AI pipeline。
 */

import * as fs from "fs";
import * as path from "path";
import { validateClusters, type ClusterInput } from "./validate-clusters";
import { validateMetrics } from "./validate-metrics";
import { validateReport } from "./validate-report";

// ===== 类型定义 =====

interface FeedbackItem {
  feedback_id: string;
  content: string;
  user_type: string;
  source: string;
  created_at: string;
  expected_theme: string;
}

interface ExpectedData {
  dataset: string;
  project: {
    name: string;
    product_type: string;
    business_goal: string;
    target_user: string;
    key_metric: string;
  };
  expected_top_themes: string[];
  allowed_metrics: string[];
  forbidden_metrics: string[];
  minimum_requirements: {
    min_feedback_count: number;
    min_cluster_count: number;
    max_cluster_count: number;
    min_evidence_per_cluster: number;
    min_top_theme_recall: number;
    max_hallucinated_metric_count: number;
  };
}

interface ValidationResult {
  dataset: string;
  status: "pass" | "fail";
  summary: {
    feedback_count: number;
    cluster_count: number;
    top_theme_recall: number;
    forbidden_metric_count: number;
    invalid_evidence_count: number;
    hallucination_count: number;
  };
  checks: any[];
  failed_checks: any[];
  recommendations: string[];
  error?: string;
}

// ===== 工具函数 =====

function parseCsv(filePath: string): FeedbackItem[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const items: FeedbackItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= 6) {
      items.push({
        feedback_id: values[0],
        content: values[1],
        user_type: values[2],
        source: values[3],
        created_at: values[4],
        expected_theme: values[5],
      });
    }
  }
  return items;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ===== Mock 分析结果生成 =====

function generateMockClusters(feedbacks: FeedbackItem[]): ClusterInput[] {
  // 按 expected_theme 分组
  const themeGroups = new Map<string, FeedbackItem[]>();
  for (const fb of feedbacks) {
    const theme = fb.expected_theme;
    if (!themeGroups.has(theme)) themeGroups.set(theme, []);
    themeGroups.get(theme)!.push(fb);
  }

  const clusters: ClusterInput[] = [];
  let priorityIndex = 0;
  const priorities = ["P0", "P0", "P1", "P1", "P2", "P2"];

  for (const [theme, items] of themeGroups) {
    // 取前 N 条作为 evidence
    const evidenceIds = items.slice(0, Math.min(items.length, 8)).map((f) => f.feedback_id);

    clusters.push({
      name: theme,
      summary: `用户反馈集中反映${theme}问题，共 ${items.length} 条反馈。`,
      feedback_count: items.length,
      evidence_feedback_ids: evidenceIds,
      priority: priorities[priorityIndex] || "P2",
      opportunity_score: Math.max(50, 100 - priorityIndex * 15),
    });
    priorityIndex++;
  }

  return clusters;
}

function generateMockReport(
  expected: ExpectedData,
  feedbacks: FeedbackItem[],
  clusters: ClusterInput[]
): string {
  const lines: string[] = [];
  lines.push(`# ${expected.project.name} 反馈分析报告`);
  lines.push("");
  // 总数放在最前面，确保 extractFeedbackCount 优先匹配
  lines.push(`总反馈数量：${feedbacks.length}`);
  lines.push(`实际分析数量：${feedbacks.length}`);
  lines.push("");
  lines.push(`## 概述`);
  lines.push(`本次分析共处理 ${feedbacks.length} 条反馈，识别出 ${clusters.length} 个核心问题。`);
  lines.push("");
  lines.push(`## Top 问题排序`);
  lines.push("");
  lines.push(`| 排名 | 问题名称 | 优先级 | 反馈数 | 建议动作 |`);
  lines.push(`| --- | --- | --- | --- | --- |`);

  const sorted = [...clusters].sort((a, b) => b.feedback_count - a.feedback_count);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    const action = c.priority === "P0" ? "立即修复" : c.priority === "P1" ? "改善体验" : "加入待办";
    lines.push(`| ${i + 1} | ${c.name} | ${c.priority} | ${c.feedback_count} | ${action} |`);
  }

  lines.push("");
  lines.push(`## 建议指标`);
  lines.push(`建议跟踪以下指标: ${expected.allowed_metrics.join("、")}`);
  lines.push("");

  // 详细问题
  for (const c of sorted) {
    lines.push(`### ${c.name}`);
    lines.push(c.summary);
    lines.push(`反馈数量: ${c.feedback_count}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ===== 主流程 =====

async function main() {
  const fixturesDir = path.join(__dirname, "..", "fixtures");
  const feedbackDir = path.join(fixturesDir, "feedback");
  const expectedDir = path.join(fixturesDir, "expected");
  const reportsDir = path.join(__dirname, "..", "validation-reports");

  fs.mkdirSync(reportsDir, { recursive: true });

  console.log("🔍 开始 AI 验证 (Mock 模式)...\n");

  // 获取所有 CSV 文件
  const csvFiles = fs.readdirSync(feedbackDir).filter((f) => f.endsWith(".csv"));
  if (csvFiles.length === 0) {
    console.error("❌ 未找到 CSV 文件，请先运行: pnpm generate:test-data");
    process.exit(1);
  }

  const results: ValidationResult[] = [];

  for (const csvFile of csvFiles) {
    const datasetName = csvFile.replace(".csv", "");
    const csvPath = path.join(feedbackDir, csvFile);
    const expectedPath = path.join(expectedDir, `${datasetName}.expected.json`);

    if (!fs.existsSync(expectedPath)) {
      console.log(`⚠️  跳过 ${datasetName}: 缺少 expected 文件`);
      continue;
    }

    console.log("=".repeat(60));
    console.log(`📊 验证数据集: ${datasetName}`);
    console.log("=".repeat(60));

    try {
      // 加载数据
      const feedbackItems = parseCsv(csvPath);
      const expected: ExpectedData = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));

      console.log(`   反馈数量: ${feedbackItems.length}`);

      // 生成 mock 分析结果
      const mockClusters = generateMockClusters(feedbackItems);
      const mockReport = generateMockReport(expected, feedbackItems, mockClusters);

      console.log(`   Mock 聚类数: ${mockClusters.length}`);

      // 执行验证
      console.log("   🔍 执行验证...");

      const allFeedbackIds = feedbackItems.map((f) => f.feedback_id);

      const clusterValidation = validateClusters(
        mockClusters,
        allFeedbackIds,
        expected.expected_top_themes,
        expected.minimum_requirements.min_evidence_per_cluster,
        expected.minimum_requirements.min_top_theme_recall
      );

      const metricsValidation = validateMetrics(
        mockReport,
        expected.allowed_metrics,
        expected.forbidden_metrics
      );

      const reportValidation = validateReport(mockReport, {
        productName: expected.project.name,
        productType: expected.project.product_type,
        feedbackCount: feedbackItems.length,
        clusterNames: mockClusters.map((c) => c.name),
      });

      // 合并结果
      const allChecks = [
        ...clusterValidation.checks,
        ...metricsValidation.checks,
        ...reportValidation.checks,
      ];
      const allFailedChecks = [
        ...clusterValidation.failed_checks,
        ...metricsValidation.failed_checks,
        ...reportValidation.failed_checks,
      ];

      // 生成建议
      const recommendations: string[] = [];
      if (clusterValidation.stats.top_theme_recall < 0.6) {
        recommendations.push("提高主题召回率，确保覆盖用户反馈的核心问题");
      }
      if (clusterValidation.stats.invalid_evidence_count > 0) {
        recommendations.push("修复无效的 evidence_feedback_ids");
      }
      if (metricsValidation.stats.forbidden_metric_count > 0) {
        recommendations.push("移除报告中禁止出现的指标");
      }
      if (metricsValidation.stats.hallucinated_metric_count > 0) {
        recommendations.push("确保报告中的指标来自允许列表");
      }
      if (reportValidation.stats.hallucination_count > 0) {
        recommendations.push("修复报告中的幻觉内容");
      }

      const status = allFailedChecks.length === 0 ? "pass" : "fail";

      results.push({
        dataset: datasetName,
        status,
        summary: {
          feedback_count: feedbackItems.length,
          cluster_count: clusterValidation.stats.cluster_count,
          top_theme_recall: clusterValidation.stats.top_theme_recall,
          forbidden_metric_count: metricsValidation.stats.forbidden_metric_count,
          invalid_evidence_count: clusterValidation.stats.invalid_evidence_count,
          hallucination_count: reportValidation.stats.hallucination_count,
        },
        checks: allChecks,
        failed_checks: allFailedChecks,
        recommendations,
      });

      // 输出结果
      if (status === "pass") {
        console.log("   ✅ PASS");
      } else {
        console.log(`   ❌ FAIL (${allFailedChecks.length} 个检查失败)`);
        for (const check of allFailedChecks) {
          console.log(`      - ${check.name}: ${check.message}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error(`   ❌ 错误: ${errorMessage}`);

      results.push({
        dataset: datasetName,
        status: "fail",
        summary: {
          feedback_count: 0,
          cluster_count: 0,
          top_theme_recall: 0,
          forbidden_metric_count: 0,
          invalid_evidence_count: 0,
          hallucination_count: 0,
        },
        checks: [],
        failed_checks: [{ name: "validation_error", passed: false, message: errorMessage }],
        recommendations: ["修复验证脚本执行错误"],
        error: errorMessage,
      });
    }

    console.log("");
  }

  // 输出总结
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  console.log("=".repeat(60));
  console.log("📋 验证总结");
  console.log("=".repeat(60));
  console.log(`总数据集: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`通过率: ${results.length > 0 ? ((passCount / results.length) * 100).toFixed(0) : 0}%`);

  // 输出失败详情
  if (failCount > 0) {
    console.log("\n❌ 失败详情:");
    for (const result of results.filter((r) => r.status === "fail")) {
      console.log(`\n   ${result.dataset}:`);
      if (result.error) {
        console.log(`     错误: ${result.error}`);
      }
      for (const check of result.failed_checks) {
        console.log(`     - ${check.name}: ${check.message}`);
      }
      if (result.recommendations.length > 0) {
        console.log("     建议:");
        for (const rec of result.recommendations) {
          console.log(`       * ${rec}`);
        }
      }
    }
  }

  // 保存验证报告
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const reportPath = path.join(reportsDir, `validation-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n📁 验证报告已保存: ${reportPath}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ 验证脚本执行失败:", error);
  process.exit(1);
});
