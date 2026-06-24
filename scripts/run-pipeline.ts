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

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--case" && args[i + 1]) caseName = args[++i];
    if (args[i] === "--count" && args[i + 1]) count = parseInt(args[++i], 10);
    if (args[i] === "--generate") generate = true;
    if (args[i] === "--baseline" && args[i + 1]) baseline = args[++i];
    if (args[i] === "--dataset" && args[i + 1]) dataset = args[++i];
    if (args[i] === "--skip-semantic") skipSemantic = true;
    if (args[i] === "--resume") resume = true;
    if (args[i] === "--stage" && args[i + 1]) stage = args[++i] as any;
  }

  if (!dataset) {
    const match = baseline.match(/^(.+)-v\d+$/);
    dataset = match ? match[1] : baseline;
  }

  return { caseName, dataset, count, generate, baseline, skipSemantic, resume, stage };
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
  const runDir = path.join(RUNS_DIR, config.caseName);
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
  const inputCsv = path.join(inputDir, `${config.dataset}.csv`);
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
  console.log("=".repeat(60));
  console.log("");

  ensureDir(inputDir);
  ensureDir(normalizedDir);
  ensureDir(segDir);
  ensureDir(segMdDir);
  ensureDir(validationDir);

  // ── Step 1: generate_raw_feedback ──────────────────────────────
  const step1 = await runStep("generate_raw_feedback", async () => {
    const baselineInput = path.join(BASELINE_DIR, config.baseline, "input");
    if (!config.generate && fs.existsSync(baselineInput)) {
      copyDir(baselineInput, inputDir);
      return `Copied from baseline (${config.count} rows)`;
    }
    throw new Error("AI generation not implemented yet. Use baseline copy.");
  }, {
    resume: config.resume,
    resumeCheckFile: inputCsv,
  });
  steps.push(step1);
  if (step1.status === "fail") return writeSummaryAndExit(config, runDir, steps, startedAt, null, null, false);

  // ── Step 2: normalize_feedback ─────────────────────────────────
  const step2 = await runStep("normalize_feedback", async () => {
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
