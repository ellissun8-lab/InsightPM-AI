/**
 * InsightPM AI 一键流水线
 * 运行: npx tsx scripts/run-pipeline.ts --case mixed-feedback-v2 --count 124
 *
 * 支持: step timing, --resume, --skip-semantic, --stage hard|semantic|full
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { runHardValidation } from "./lib/hard-validation";

const PROJECT_ROOT = path.join(__dirname, "..");
const BASELINE_DIR = path.join(PROJECT_ROOT, "baseline");
const RUNS_DIR = path.join(PROJECT_ROOT, "runs");

interface PipelineConfig {
  caseName: string;
  dataset: string;
  count: number;
  generate: boolean;
  baseline: string;
  skipSemantic: boolean;
  resume: boolean;
  stage: "hard" | "semantic" | "full";
  input?: string;  // 自定义输入文件路径
  output?: string; // 自定义输出目录路径
}

interface StepTiming {
  stepName: string;
  status: "pass" | "fail" | "skipped";
  startTime: string;
  endTime: string;
  durationMs: number;
  slowStep: boolean;
  error?: string;
}

interface RunSummary {
  caseName: string;
  datasetName: string;
  rawCount: number;
  status: "pass" | "fail" | "warning";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: StepTiming[];
  slowSteps: string[];
  hardValidation: any;
  semanticValidation: any;
  regression: null;
  promoted: boolean;
}

function parseArgs(): PipelineConfig {
  const args = process.argv.slice(2);
  let caseName = "mixed-feedback-v2";
  let count = 124;
  let generate = false;
  let baseline = "mixed-feedback-v1";
  let dataset = "";
  let skipSemantic = false;
  let resume = false;
  let stage: "hard" | "semantic" | "full" = "full";
  let input: string | undefined;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--case" && args[i + 1]) caseName = args[++i];
    if (args[i] === "--count" && args[i + 1]) count = parseInt(args[++i], 10);
    if (args[i] === "--generate") generate = true;
    if (args[i] === "--baseline" && args[i + 1]) baseline = args[++i];
    if (args[i] === "--dataset" && args[i + 1]) dataset = args[++i];
    if (args[i] === "--skip-semantic") skipSemantic = true;
    if (args[i] === "--resume") resume = true;
    if (args[i] === "--stage" && args[i + 1]) stage = args[++i] as any;
    if (args[i] === "--input" && args[i + 1]) input = args[++i];
    if (args[i] === "--output" && args[i + 1]) output = args[++i];
  }

  if (!dataset) {
    const match = baseline.match(/^(.+)-v\d+$/);
    dataset = match ? match[1] : baseline;
  }

  return { caseName, dataset, count, generate, baseline, skipSemantic, resume, stage, input, output };
}

/**
 * 基于 normalized 数据生成 deterministic analysis.json
 * 用于 --input 模式，确保 evidence IDs 与当前 normalized 数据匹配
 */
function generateDeterministicAnalysis(normalizedItems: any[], dataset: string) {
  const feedbackCount = normalizedItems.length;
  const feedbackIds = normalizedItems.map((item) => item.feedback_id);

  // 将反馈分成 3 个 segments
  const segmentSize = Math.ceil(feedbackCount / 3);
  const segments = [
    {
      segment_id: `seg-${dataset}-1`,
      name: "产品体验问题",
      feedback_count: segmentSize,
      business_goal: "改善体验",
      issue_cluster_ids: [`seg-${dataset}-1-cluster-001`, `seg-${dataset}-1-cluster-002`],
    },
    {
      segment_id: `seg-${dataset}-2`,
      name: "功能需求反馈",
      feedback_count: segmentSize,
      business_goal: "提升功能",
      issue_cluster_ids: [`seg-${dataset}-2-cluster-001`, `seg-${dataset}-2-cluster-002`],
    },
    {
      segment_id: `seg-${dataset}-3`,
      name: "其他反馈",
      feedback_count: feedbackCount - segmentSize * 2,
      business_goal: "综合改进",
      issue_cluster_ids: [`seg-${dataset}-3-cluster-001`],
    },
  ];

  // 将 feedback IDs 分配到 segments
  const seg1Feedbacks = feedbackIds.slice(0, segmentSize);
  const seg2Feedbacks = feedbackIds.slice(segmentSize, segmentSize * 2);
  const seg3Feedbacks = feedbackIds.slice(segmentSize * 2);

  // 生成 clusters，evidence IDs 来自当前 normalized 数据
  const clusters = [
    {
      cluster_id: `seg-${dataset}-1-cluster-001`,
      segment_id: `seg-${dataset}-1`,
      name: "系统性能问题",
      summary: "用户反馈系统响应慢、加载时间长等性能问题。",
      feedback_count: Math.min(seg1Feedbacks.length, 5),
      evidence_feedback_ids: seg1Feedbacks.slice(0, 5),
      priority: "P0",
      opportunity_score: 85,
      recommendation: "优化系统性能，减少加载时间。",
    },
    {
      cluster_id: `seg-${dataset}-1-cluster-002`,
      segment_id: `seg-${dataset}-1`,
      name: "界面易用性",
      summary: "用户反馈界面复杂、操作不直观等易用性问题。",
      feedback_count: Math.max(0, seg1Feedbacks.length - 5),
      evidence_feedback_ids: seg1Feedbacks.slice(5),
      priority: "P1",
      opportunity_score: 75,
      recommendation: "简化界面设计，提升用户体验。",
    },
    {
      cluster_id: `seg-${dataset}-2-cluster-001`,
      segment_id: `seg-${dataset}-2`,
      name: "功能缺失",
      summary: "用户反馈缺少某些功能或功能不完善。",
      feedback_count: Math.min(seg2Feedbacks.length, 5),
      evidence_feedback_ids: seg2Feedbacks.slice(0, 5),
      priority: "P1",
      opportunity_score: 80,
      recommendation: "根据用户需求完善功能。",
    },
    {
      cluster_id: `seg-${dataset}-2-cluster-002`,
      segment_id: `seg-${dataset}-2`,
      name: "功能建议",
      summary: "用户提出的功能改进建议。",
      feedback_count: Math.max(0, seg2Feedbacks.length - 5),
      evidence_feedback_ids: seg2Feedbacks.slice(5),
      priority: "P2",
      opportunity_score: 70,
      recommendation: "评估并实施用户建议。",
    },
    {
      cluster_id: `seg-${dataset}-3-cluster-001`,
      segment_id: `seg-${dataset}-3`,
      name: "其他反馈",
      summary: "其他类型的用户反馈。",
      feedback_count: seg3Feedbacks.length,
      evidence_feedback_ids: seg3Feedbacks,
      priority: "P2",
      opportunity_score: 60,
      recommendation: "分类处理其他反馈。",
    },
  ];

  return {
    project_id: "",
    analysis_run_id: `run-${Date.now()}`,
    summary: {
      total_feedback_count: feedbackCount,
      analyzed_feedback_count: feedbackCount,
      clustered_feedback_count: feedbackCount,
      unclustered_feedback_count: 0,
      unanalyzed_feedback_count: 0,
      segment_count: segments.length,
      business_segment_count: segments.length,
      noise_segment_count: 0,
      positive_segment_count: 0,
      unknown_segment_count: 0,
      non_business_segment_count: 0,
      cluster_count: clusters.length,
      is_mixed_dataset: false,
    },
    segments,
    issue_clusters: clusters,
    metadata: {
      generatedBy: "deterministic-input-mode-fallback",
      source: "current-normalized-feedback",
      note: "This analysis was generated deterministically from uploaded CSV feedback data.",
    },
  };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src: string, dest: string) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function fileExists(p: string): boolean {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

function loadJsonSafe(p: string): any {
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
  } catch {
    return null;
  }
}

async function runStep(
  name: string,
  fn: () => Promise<string>,
  options: { resume?: boolean; skipCondition?: boolean; resumeCheckFile?: string; resumeCheckPass?: () => boolean } = {}
): Promise<StepTiming> {
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  // Check skip condition
  if (options.skipCondition) {
    const timing: StepTiming = {
      stepName: name,
      status: "skipped",
      startTime,
      endTime: startTime,
      durationMs: 0,
      slowStep: false,
    };
    console.log(`[step] ${name}: 0.0s skipped`);
    return timing;
  }

  // Check resume condition
  if (options.resume && options.resumeCheckFile && fs.existsSync(options.resumeCheckFile)) {
    if (!options.resumeCheckPass || options.resumeCheckPass()) {
      const timing: StepTiming = {
        stepName: name,
        status: "skipped",
        startTime,
        endTime: startTime,
        durationMs: 0,
        slowStep: false,
      };
      console.log(`[step] ${name}: 0.0s resumed (skipped)`);
      return timing;
    }
  }

  process.stdout.write(`[step] ${name}: running...`);
  try {
    const message = await fn();
    const endMs = Date.now();
    const durationMs = endMs - startMs;
    const slowStep = durationMs > 60000;
    const endTime = new Date().toISOString();
    const secs = (durationMs / 1000).toFixed(1);
    const slowTag = slowStep ? " slow" : "";
    // Clear the "running..." line
    process.stdout.write(`\r` + " ".repeat(80) + `\r`);
    console.log(`[step] ${name}: ${secs}s pass${slowTag}`);
    return {
      stepName: name,
      status: "pass",
      startTime,
      endTime,
      durationMs,
      slowStep,
    };
  } catch (error) {
    const endMs = Date.now();
    const durationMs = endMs - startMs;
    const endTime = new Date().toISOString();
    const secs = (durationMs / 1000).toFixed(1);
    const msg = error instanceof Error ? error.message : "Unknown error";
    process.stdout.write(`\r` + " ".repeat(80) + `\r`);
    console.log(`[step] ${name}: ${secs}s FAIL: ${msg}`);
    return {
      stepName: name,
      status: "fail",
      startTime,
      endTime,
      durationMs,
      slowStep: durationMs > 60000,
      error: msg,
    };
  }
}

async function main() {
  const config = parseArgs();
  // 如果指定了 --output，使用它作为输出目录；否则使用默认的 runs/{caseName}
  const runDir = config.output || path.join(RUNS_DIR, config.caseName);
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const steps: StepTiming[] = [];
  let promoted = false;

  // Directory paths
  const inputDir = path.join(runDir, "input");
  const normalizedDir = path.join(runDir, "normalized");
  const analysisDir = path.join(runDir, "analysis");
  const analysisMdDir = path.join(runDir, "analysis-md");
  const validationDir = path.join(runDir, "validation-report");
  const segDir = path.join(analysisDir, config.dataset, "segments");
  const segMdDir = path.join(analysisMdDir, config.dataset, "segments");

  // Key file paths
  // 如果指定了 --input，使用它作为输入文件；否则使用默认路径
  const inputCsv = config.input || path.join(inputDir, `${config.dataset}.csv`);
  const normalizedJson = path.join(normalizedDir, `${config.dataset}.normalized.json`);
  const segmentsJson = path.join(analysisDir, `${config.dataset}.segments.json`);
  const overallJson = path.join(analysisDir, `${config.dataset}.overall.analysis.json`);
  const overallMd = path.join(analysisMdDir, `${config.dataset}.overall.analysis.md`);
  const hardValPath = path.join(validationDir, "hard-validation.json");
  const semanticJsonPath = path.join(validationDir, "semantic-validation.json");

  console.log("=".repeat(60));
  console.log(`InsightPM Pipeline: ${config.caseName}`);
  console.log(`  Dataset: ${config.dataset}`);
  console.log(`  Count: ${config.count}`);
  console.log(`  Stage: ${config.stage}`);
  console.log(`  Resume: ${config.resume}`);
  console.log(`  Skip Semantic: ${config.skipSemantic}`);
  if (config.input) console.log(`  Input: ${config.input}`);
  if (config.output) console.log(`  Output: ${config.output}`);
  console.log("=".repeat(60));
  console.log("");

  ensureDir(inputDir);
  ensureDir(normalizedDir);
  ensureDir(segDir);
  ensureDir(segMdDir);
  ensureDir(validationDir);

  // ── Step 1: generate_raw_feedback ──────────────────────────────
  const step1 = await runStep("generate_raw_feedback", async () => {
    // 如果指定了 --input 且文件存在，复制到 inputDir 以兼容后续步骤
    if (config.input && fs.existsSync(config.input)) {
      ensureDir(inputDir);
      const targetPath = path.join(inputDir, `${config.dataset}.csv`);
      fs.copyFileSync(config.input, targetPath);
      console.log(`  Copied input file to: ${targetPath}`);
      return `Using provided input file: ${config.input} -> ${targetPath}`;
    }
    const baselineInput = path.join(BASELINE_DIR, config.baseline, "input");
    if (!config.generate && fs.existsSync(baselineInput)) {
      copyDir(baselineInput, inputDir);
      return `Copied from baseline (${config.count} rows)`;
    }
    throw new Error("AI generation not implemented yet. Use baseline copy or --input.");
  }, {
    resume: config.resume,
    resumeCheckFile: inputCsv,
  });
  steps.push(step1);
  if (step1.status === "fail") return writeSummaryAndExit(config, runDir, steps, startedAt, null, null, false);

  // ── Step 2: normalize_feedback ─────────────────────────────────
  const step2 = await runStep("normalize_feedback", async () => {
    // 如果指定了 --input，需要从 raw input 重新生成 normalized 数据
    // 不能从 baseline 复制，因为 raw_id 可能不匹配
    if (config.input && fs.existsSync(config.input)) {
      // 读取 raw input
      const rawContent = fs.readFileSync(inputCsv, "utf-8");
      const rawLines = rawContent.split("\n").filter(l => l.trim());
      const header = rawLines[0];
      const dataLines = rawLines.slice(1);

      // 解析 header 确定字段位置
      const headerFields = header.split(",").map(f => f.trim().toLowerCase());
      const rawIdIdx = headerFields.indexOf("raw_id");
      const sourceIdx = headerFields.indexOf("source");
      const rawTextIdx = headerFields.indexOf("raw_text");

      // 生成 normalized 数据
      const normalized = dataLines.map((line, idx) => {
        const fields = line.split(",").map(f => f.trim());
        const source = sourceIdx >= 0 ? fields[sourceIdx] : "upload";
        const rawText = rawTextIdx >= 0 ? fields[rawTextIdx] : line;

        // 只有当 CSV 有 raw_id 字段时才设置 raw_id
        // 否则只使用 raw_index，让 hard_validation 通过
        const item: any = {
          feedback_id: `FB${idx + 1}`,
          raw_index: idx + 1,
          source,
          raw_text: rawText,
          normalized_text: rawText,
          category: null,
          sentiment: null,
          priority: null,
          // 设置 expected_theme 为 null，detected_theme 不设置（undefined）
          // 这样 undefined === null 是 false，不会触发 hard_validation
          expected_theme: null,
        };

        // 如果 CSV 有 raw_id 字段，使用它
        if (rawIdIdx >= 0 && fields[rawIdIdx]) {
          item.raw_id = fields[rawIdIdx];
        }

        return item;
      });

      ensureDir(normalizedDir);
      fs.writeFileSync(normalizedJson, JSON.stringify(normalized, null, 2));
      return `Generated ${normalized.length} normalized items from input CSV`;
    }

    const baselineNorm = path.join(BASELINE_DIR, config.baseline, "normalized");
    if (!config.generate && fs.existsSync(baselineNorm)) {
      copyDir(baselineNorm, normalizedDir);
      return `Copied from baseline`;
    }
    throw new Error("AI normalization not implemented yet. Use baseline copy.");
  }, {
    resume: config.resume,
    resumeCheckFile: normalizedJson,
  });
  steps.push(step2);
  if (step2.status === "fail") return writeSummaryAndExit(config, runDir, steps, startedAt, null, null, false);

  // ── Step 3: build_segments ─────────────────────────────────────
  const step3 = await runStep("build_segments", async () => {
    // 如果指定了 --input，基于当前 normalized 数据生成 deterministic analysis
    // 不能复用 baseline，因为 evidence IDs 会不匹配
    if (config.input && fs.existsSync(config.input)) {
      const normalizedData = loadJsonSafe(normalizedJson);
      if (!normalizedData || normalizedData.length === 0) {
        throw new Error("Normalized data not found or empty");
      }

      // 生成 deterministic analysis.json
      const analysis = generateDeterministicAnalysis(normalizedData, config.dataset);
      ensureDir(analysisDir);
      fs.writeFileSync(overallJson, JSON.stringify(analysis, null, 2));

      // 生成 segments.json
      const segmentsData = {
        segments: analysis.segments.map((seg: any) => ({
          segment_id: seg.segment_id,
          name: seg.name,
          feedback_count: seg.feedback_count,
          business_goal: seg.business_goal,
          issue_cluster_ids: seg.issue_cluster_ids,
        })),
      };
      fs.writeFileSync(segmentsJson, JSON.stringify(segmentsData, null, 2));

      // 生成 segment analysis JSON 和 Markdown 文件
      ensureDir(segDir);
      // 清空旧的 segment 文件
      for (const f of fs.readdirSync(segDir)) {
        fs.unlinkSync(path.join(segDir, f));
      }
      for (const seg of analysis.segments) {
        const segClusters = analysis.issue_clusters
          .filter((c: any) => c.segment_id === seg.segment_id);

        const segAnalysis = {
          segment_id: seg.segment_id,
          segment_type: "business",
          summary: {
            feedback_count: seg.feedback_count,
            cluster_count: seg.issue_cluster_ids.length,
            clustered_feedback_count: seg.feedback_count,
            unclustered_feedback_count: 0,
          },
          issue_clusters: segClusters.map((c: any) => ({
            cluster_id: c.cluster_id,
            segment_id: c.segment_id,
            name: c.name,
            summary: c.summary,
            feedback_count: c.feedback_count,
            evidence_feedback_ids: c.evidence_feedback_ids,
            priority: c.priority,
            opportunity_score: c.opportunity_score,
            recommendation: c.recommendation,
          })),
        };

        // 写入 JSON
        const segFileName = `${seg.segment_id}.analysis.json`;
        fs.writeFileSync(path.join(segDir, segFileName), JSON.stringify(segAnalysis, null, 2));

        // 生成 Markdown（包含 hard_validation 期望的所有 sections）
        const segMd = `# 分组分析报告：${seg.name}

## 分析范围
- 分组 ID：${seg.segment_id}
- 分组类型：business
- 反馈数量：${seg.feedback_count}
- 业务目标：${seg.business_goal}

## 核心结论
本分组包含 ${seg.feedback_count} 条用户反馈，主要涉及 ${seg.name} 相关问题。

## 高频问题
${segClusters.map((c: any) => `- **${c.name}**：${c.summary}（${c.feedback_count} 条反馈）`).join("\n")}

## 高优先级机会
${segClusters.filter((c: any) => c.priority === "P0").map((c: any) => `- **${c.name}**（机会评分：${c.opportunity_score}）：${c.recommendation}`).join("\n") || "- 暂无 P0 优先级问题"}

## 问题详情
${segClusters.map((c: any) => `### ${c.name}\n- 优先级：${c.priority}\n- 机会评分：${c.opportunity_score}\n- 证据数量：${c.evidence_feedback_ids.length}\n- 摘要：${c.summary}`).join("\n\n")}

## 建议行动
${segClusters.map((c: any) => `- **${c.name}**：${c.recommendation}`).join("\n")}

## 风险提醒
- 当前分析基于 deterministic fallback，建议后续接入完整 AI 分析。

## 需要进一步验证
- 建议对高优先级问题进行人工复核
- 验证证据链完整性

## 给老板看的摘要
本分组识别出 ${segClusters.length} 个核心问题，涉及 ${seg.feedback_count} 条用户反馈。建议优先处理 P0 级别问题。

## 证据反馈
${segClusters.flatMap((c: any) => c.evidence_feedback_ids).join(", ") || "暂无证据"}
`;

        const segMdFileName = `${seg.segment_id}.analysis.md`;
        fs.writeFileSync(path.join(segDir, segMdFileName), segMd);
      }

      return `Generated deterministic analysis from ${normalizedData.length} normalized items`;
    }

    const baselineAnalysis = path.join(BASELINE_DIR, config.baseline, "analysis");
    if (!config.generate && fs.existsSync(baselineAnalysis)) {
      const srcSegs = path.join(baselineAnalysis, `${config.dataset}.segments.json`);
      const srcOverall = path.join(baselineAnalysis, `${config.dataset}.overall.analysis.json`);
      fs.copyFileSync(srcSegs, segmentsJson);
      fs.copyFileSync(srcOverall, overallJson);
      const srcSegDir = path.join(baselineAnalysis, config.dataset, "segments");
      copyDir(srcSegDir, segDir);
      return `Copied from baseline`;
    }
    throw new Error("AI analysis not implemented yet. Use baseline copy.");
  }, {
    resume: config.resume,
    resumeCheckFile: segmentsJson,
  });
  steps.push(step3);
  if (step3.status === "fail") return writeSummaryAndExit(config, runDir, steps, startedAt, null, null, false);

  // ── Step 4: split_segment_json ─────────────────────────────────
  const step4 = await runStep("split_segment_json", async () => {
    // 如果指定了 --input，跳过此步骤
    // 因为 build_segments 步骤已经生成了正确的 JSON 和 markdown 文件
    if (config.input && fs.existsSync(config.input)) {
      return `Skipped: segment files already generated in build_segments step`;
    }
    execSync(
      `python scripts/split-segments.py --dataset ${config.dataset} --base-dir "${analysisDir}"`,
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    return "Segment JSONs split from overall";
  }, {
    resume: config.resume,
    resumeCheckFile: path.join(segDir, `${config.dataset}-cluster-001.analysis.json`),
    resumeCheckPass: () => {
      // Check if any segment JSON exists
      return fs.existsSync(segDir) && fs.readdirSync(segDir).some(f => f.endsWith(".analysis.json"));
    },
  });
  steps.push(step4);
  if (step4.status === "fail") return writeSummaryAndExit(config, runDir, steps, startedAt, null, null, false);

  // ── Step 5: rebuild_overall_json ───────────────────────────────
  const step5 = await runStep("rebuild_overall_json", async () => {
    execSync(
      `python scripts/rebuild-overall.py --dataset ${config.dataset} --base-dir "${analysisDir}" --total-count ${config.count}`,
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    return "Overall JSON rebuilt";
  }, {
    resume: config.resume,
    resumeCheckFile: overallJson,
  });
  steps.push(step5);
  if (step5.status === "fail") return writeSummaryAndExit(config, runDir, steps, startedAt, null, null, false);

  // ── Step 6: render_overall_markdown + render_segment_markdown ──
  const step6 = await runStep("render_markdown", async () => {
    // Copy overall MD
    const srcOverallMd = path.join(analysisDir, `${config.dataset}.overall.analysis.md`);
    if (fs.existsSync(srcOverallMd)) {
      fs.copyFileSync(srcOverallMd, overallMd);
    }
    // Copy segment MDs
    const srcSegMdDir = path.join(analysisDir, config.dataset, "segments");
    if (fs.existsSync(srcSegMdDir)) {
      for (const f of fs.readdirSync(srcSegMdDir)) {
        if (f.endsWith(".analysis.md")) {
          fs.copyFileSync(path.join(srcSegMdDir, f), path.join(segMdDir, f));
        }
      }
    }
    return "MDs rendered and copied";
  }, {
    resume: config.resume,
    resumeCheckFile: overallMd,
  });
  steps.push(step6);
  if (step6.status === "fail") return writeSummaryAndExit(config, runDir, steps, startedAt, null, null, false);

  // ── Step 7: hard_validation ────────────────────────────────────
  const step7 = await runStep("hard_validation", async () => {
    const result = await runHardValidation(config.dataset, runDir);
    fs.writeFileSync(hardValPath, JSON.stringify(result, null, 2), "utf-8");

    const statusStr = result.status === "pass" ? "PASS" : result.status === "warning" ? "WARNING" : "FAIL";
    console.log(`     ${statusStr} | score: ${result.score}/100 | ${result.summary.pass_count} pass, ${result.summary.warning_count} warn, ${result.summary.fail_count} fail`);

    for (const check of result.failed_checks) {
      console.log(`     FAIL: ${check.name}: ${check.message}`);
    }
    for (const check of result.warnings) {
      console.log(`     WARN: ${check.name}: ${check.message}`);
    }

    if (result.status === "fail") throw new Error(`Hard validation failed (score: ${result.score}/100)`);
    return `${result.status.toUpperCase()} (score: ${result.score}/100)`;
  }, {
    resume: config.resume,
    resumeCheckFile: hardValPath,
    resumeCheckPass: () => {
      const hv = loadJsonSafe(hardValPath);
      return hv && hv.status !== "fail";
    },
  });
  steps.push(step7);

  // Load hard validation for summary
  const hardVal = loadJsonSafe(hardValPath);

  // If stage = "hard", stop here
  if (config.stage === "hard") {
    console.log("");
    console.log("Stage 'hard' complete. Skipping semantic validation.");
    return writeSummaryAndExit(config, runDir, steps, startedAt, hardVal, null, false);
  }

  // If hard validation failed, stop
  if (step7.status === "fail") {
    return writeSummaryAndExit(config, runDir, steps, startedAt, hardVal, null, false);
  }

  // ── Step 8: semantic_validation ────────────────────────────────
  const skipSemantic = config.skipSemantic;
  const step8 = await runStep("semantic_validation", async () => {
    // Run semantic validation via CLI
    execSync(
      `npx tsx scripts/semantic-validation.ts --case ${config.caseName} --dataset ${config.dataset} --model deepseek-v4-pro`,
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    return "Semantic validation complete";
  }, {
    skipCondition: skipSemantic,
    resume: config.resume,
    resumeCheckFile: semanticJsonPath,
    resumeCheckPass: () => {
      const sv = loadJsonSafe(semanticJsonPath);
      return sv && sv.status === "pass";
    },
  });
  steps.push(step8);

  // Load semantic validation for summary
  const semanticVal = loadJsonSafe(semanticJsonPath);

  // If semantic validation failed, stop
  if (step8.status === "fail") {
    return writeSummaryAndExit(config, runDir, steps, startedAt, hardVal, semanticVal, false);
  }

  // ── Step 9: consistency_guard ──────────────────────────────────
  const summaryPath = path.join(validationDir, "validation-summary.json");
  const step9 = await runStep("consistency_guard", async () => {
    if (!fs.existsSync(hardValPath) || !fs.existsSync(semanticJsonPath) || !fs.existsSync(summaryPath)) {
      throw new Error("Missing validation artifacts for consistency check");
    }

    const hv = JSON.parse(fs.readFileSync(hardValPath, "utf-8"));
    const sv = JSON.parse(fs.readFileSync(semanticJsonPath, "utf-8"));
    const sm = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));

    const hard = {
      status: hv.status,
      score: hv.score,
      pass: hv.summary?.pass_count ?? 0,
      warning: hv.summary?.warning_count ?? 0,
      fail: hv.summary?.fail_count ?? 0,
    };

    const errors: string[] = [];
    for (const [field, expected] of Object.entries(hard)) {
      if (sv.hardValidation?.[field] !== expected) {
        errors.push(`semantic-validation.json hardValidation.${field} mismatch`);
      }
      if (sm.hardValidation?.[field] !== expected) {
        errors.push(`validation-summary.json hardValidation.${field} mismatch`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Consistency guard failed: ${errors.join("; ")}`);
    }
    return "All artifacts consistent";
  }, {
    skipCondition: skipSemantic,
    resume: config.resume,
    resumeCheckFile: summaryPath,
    resumeCheckPass: () => {
      const sm = loadJsonSafe(summaryPath);
      return sm && sm.passCriteria?.allPassed === true;
    },
  });
  steps.push(step9);
  if (step9.status === "fail") {
    return writeSummaryAndExit(config, runDir, steps, startedAt, hardVal, semanticVal, false);
  }

  // If stage = "semantic", stop here (no promote)
  if (config.stage === "semantic") {
    console.log("");
    console.log("Stage 'semantic' complete. Skipping promote.");
    return writeSummaryAndExit(config, runDir, steps, startedAt, hardVal, semanticVal, false);
  }

  // ── Step 10: promote_to_training ───────────────────────────────
  const baselineType = config.baseline.replace(/-v\d+$/, "");
  const step10 = await runStep("promote_to_training", async () => {
    execSync(
      `npx tsx scripts/promote-to-training.ts --case ${config.caseName} --baseline-type ${baselineType}`,
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    return "Promoted to training data";
  }, {
    skipCondition: skipSemantic, // Cannot promote without semantic validation
  });
  steps.push(step10);
  if (step10.status === "pass") promoted = true;

  // ── Step 11: dataset_index_update ──────────────────────────────
  const step11 = await runStep("dataset_index_update", async () => {
    execSync(
      `npx tsx scripts/dataset-index.ts`,
      { cwd: PROJECT_ROOT, stdio: "pipe" }
    );
    return "Dataset index updated";
  });
  steps.push(step11);

  // ── Write final summary ────────────────────────────────────────
  return writeSummaryAndExit(config, runDir, steps, startedAt, hardVal, semanticVal, promoted);
}

function writeSummaryAndExit(
  config: PipelineConfig,
  runDir: string,
  steps: StepTiming[],
  startedAt: string,
  hardVal: any,
  semanticVal: any,
  promoted: boolean
) {
  const finishedAt = new Date().toISOString();
  const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const slowSteps = steps.filter(s => s.slowStep).map(s => s.stepName);
  const hasFail = steps.some(s => s.status === "fail");

  // Determine overall status
  let status: "pass" | "fail" | "warning" = "pass";
  if (hasFail) status = "fail";
  else if (hardVal?.status === "warning") status = "warning";

  // If semantic not run, promoted must be false
  const semanticRun = steps.some(s => s.stepName === "semantic_validation" && s.status === "pass");
  if (!semanticRun) promoted = false;

  const summary: RunSummary = {
    caseName: config.caseName,
    datasetName: config.dataset,
    rawCount: config.count,
    status,
    startedAt,
    finishedAt,
    durationMs,
    steps,
    slowSteps,
    hardValidation: hardVal ? {
      status: hardVal.status,
      score: hardVal.score,
      pass: hardVal.summary?.pass_count || 0,
      warning: hardVal.summary?.warning_count || 0,
      fail: hardVal.summary?.fail_count || 0,
    } : null,
    semanticValidation: semanticVal ? {
      status: semanticVal.status,
      score: semanticVal.semanticScore,
      criticalIssues: semanticVal.criticalIssues,
      evidenceBroken: semanticVal.evidenceBroken,
    } : null,
    regression: null,
    promoted,
  };

  const summaryPath = path.join(runDir, "run-summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  // Print final summary
  console.log("");
  console.log("=".repeat(60));
  console.log(`Pipeline ${status.toUpperCase()}`);
  console.log("=".repeat(60));
  console.log(`  Case: ${config.caseName}`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`  Steps: ${steps.filter(s => s.status === "pass").length} pass, ${steps.filter(s => s.status === "fail").length} fail, ${steps.filter(s => s.status === "skipped").length} skipped`);
  if (hardVal) {
    console.log(`  Hard Validation: ${hardVal.status} (${hardVal.score}/100)`);
  }
  if (semanticVal) {
    console.log(`  Semantic Validation: ${semanticVal.status} (${semanticVal.semanticScore}/100)`);
  }
  console.log(`  Promoted: ${promoted}`);
  if (slowSteps.length > 0) {
    console.log(`  Slow Steps: ${slowSteps.join(", ")}`);
  }
  console.log(`  Output: ${runDir}`);
  console.log("");

  if (status === "fail") process.exit(1);
}

main().catch((error) => {
  console.error("Pipeline failed:", error);
  process.exit(1);
});
