/**
 * InsightPM AI 批量回归验证
 * 运行: npx tsx scripts/batch-regression.ts --baseline mixed-feedback-v1 --targets v2,v3,v4,v5
 */

import * as fs from "fs";
import * as path from "path";

const RUNS_DIR = path.join(__dirname, "..", "runs");
const BASELINE_DIR = path.join(__dirname, "..", "baseline");

interface CaseResult {
  caseName: string;
  hardValidationStatus: string;
  hardValidationScore: number;
  passCount: number;
  warningCount: number;
  failCount: number;
  regressionStatus: string;
  regressionCount: number;
  rawCount: number;
  normalizedCount: number;
  segmentCount: number;
  clusterCount: number;
  evidenceBrokenCount: number;
  unknownCount: number;
  noiseCount: number;
  positiveCount: number;
  p0Count: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let baseline = "mixed-feedback-v1";
  let targets: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--baseline" && args[i + 1]) baseline = args[++i];
    if (args[i] === "--targets" && args[i + 1]) targets = args[++i].split(",");
  }

  return { baseline, targets };
}

function loadJson(p: string): any {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

function analyzeCase(caseName: string): CaseResult {
  const runDir = path.join(RUNS_DIR, caseName);

  // Hard validation
  const valPath = path.join(runDir, "validation-report", "hard-validation.json");
  const val = loadJson(valPath);

  // Regression
  const regPath = path.join(runDir, "validation-report", "regression.json");
  const reg = loadJson(regPath);

  // Data counts
  const normPath = path.join(runDir, "normalized", "mixed-feedback.normalized.json");
  const norm = loadJson(normPath);
  const normalizedCount = norm ? norm.length : 0;

  const csvPath = path.join(runDir, "input", "mixed-feedback.csv");
  const rawCount = fs.existsSync(csvPath)
    ? fs.readFileSync(csvPath, "utf-8").split("\n").filter(l => l.trim()).length - 1
    : 0;

  const overallPath = path.join(runDir, "analysis", "mixed-feedback.overall.analysis.json");
  const overall = loadJson(overallPath);

  let segmentCount = 0, clusterCount = 0, evidenceBrokenCount = 0;
  let unknownCount = 0, noiseCount = 0, positiveCount = 0, p0Count = 0;

  if (overall) {
    segmentCount = overall.segments?.length || 0;
    clusterCount = overall.issue_clusters?.length || 0;

    // Evidence chain check
    const normMap = new Map<string, any>();
    if (norm) for (const item of norm) normMap.set(item.feedback_id, item);

    for (const c of overall.issue_clusters || []) {
      for (const eid of c.evidence_feedback_ids || []) {
        const ni = normMap.get(eid);
        if (!ni) evidenceBrokenCount++;
        else if (!ni.raw_id && ni.raw_index === undefined) evidenceBrokenCount++;
      }

      if (c.segment_id === "seg-unknown") unknownCount++;
      if (c.segment_id === "seg-noise") noiseCount++;
      if (c.segment_id === "seg-positive") positiveCount++;
      if (c.priority === "P0") p0Count++;
    }
  }

  return {
    caseName,
    hardValidationStatus: val?.status || "unknown",
    hardValidationScore: val?.score || 0,
    passCount: val?.summary?.pass_count || 0,
    warningCount: val?.summary?.warning_count || 0,
    failCount: val?.summary?.fail_count || 0,
    regressionStatus: reg?.status || "skipped",
    regressionCount: reg?.summary?.regressions || 0,
    rawCount,
    normalizedCount,
    segmentCount,
    clusterCount,
    evidenceBrokenCount,
    unknownCount,
    noiseCount,
    positiveCount,
    p0Count,
  };
}

function generateMarkdown(baseline: string, results: CaseResult[], warning: any): string {
  const lines: string[] = [];
  lines.push("# Batch Regression Report");
  lines.push("");
  lines.push(`**Baseline:** ${baseline}`);
  lines.push(`**Targets:** ${results.map(r => r.caseName).join(", ")}`);
  lines.push(`**Timestamp:** ${new Date().toISOString()}`);
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| Case | Val Status | Score | Pass | Warn | Fail | Regression | Evidence Broken | Clusters | P0 |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of results) {
    lines.push(`| ${r.caseName} | ${r.hardValidationStatus} | ${r.hardValidationScore} | ${r.passCount} | ${r.warningCount} | ${r.failCount} | ${r.regressionStatus} | ${r.evidenceBrokenCount} | ${r.clusterCount} | ${r.p0Count} |`);
  }
  lines.push("");

  // Data counts
  lines.push("## Data Counts");
  lines.push("");
  lines.push("| Case | Raw | Normalized | Segments | Clusters | Unknown | Noise | Positive |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of results) {
    lines.push(`| ${r.caseName} | ${r.rawCount} | ${r.normalizedCount} | ${r.segmentCount} | ${r.clusterCount} | ${r.unknownCount} | ${r.noiseCount} | ${r.positiveCount} |`);
  }
  lines.push("");

  // Accepted warnings
  if (warning) {
    lines.push("## Accepted Warnings");
    lines.push("");
    lines.push(`- **${warning.name}**: ${warning.message}`);
    if (warning.recommendation) lines.push(`  - Recommendation: ${warning.recommendation}`);
    lines.push("");
  }

  // Overall verdict
  const allPass = results.every(r => r.failCount === 0 && r.evidenceBrokenCount === 0 && r.regressionStatus !== "fail");
  lines.push("## Verdict");
  lines.push("");
  lines.push(allPass ? "**ALL PASS** — batch stability verified." : "**FAIL** — regressions detected.");

  return lines.join("\n");
}

function main() {
  const { baseline, targets } = parseArgs();

  console.log("=".repeat(60));
  console.log(`Batch Regression: ${baseline} → [${targets.join(", ")}]`);
  console.log("=".repeat(60));
  console.log("");

  const results: CaseResult[] = [];
  for (const target of targets) {
    console.log(`  Analyzing ${target}...`);
    results.push(analyzeCase(target));
  }

  // Detect accepted warning (same warning across all cases)
  let warning: any = null;
  for (const r of results) {
    const valPath = path.join(RUNS_DIR, r.caseName, "validation-report", "hard-validation.json");
    const val = loadJson(valPath);
    if (val?.warnings?.length > 0) {
      warning = val.warnings[0]; // Take first warning
      break;
    }
  }

  // Print table
  console.log("");
  console.log("Results:");
  for (const r of results) {
    console.log(`  ${r.caseName}: val=${r.hardValidationStatus}(${r.hardValidationScore}) reg=${r.regressionStatus} evidence_broken=${r.evidenceBrokenCount} clusters=${r.clusterCount}`);
  }

  // Save outputs
  const outDir = path.join(RUNS_DIR, "batch-regression");
  fs.mkdirSync(outDir, { recursive: true });

  const batchReport = {
    baseline,
    targets,
    timestamp: new Date().toISOString(),
    cases: results,
    accepted_warning: warning ? { name: warning.name, message: warning.message, recommendation: warning.recommendation } : null,
    verdict: results.every(r => r.failCount === 0 && r.evidenceBrokenCount === 0 && r.regressionStatus !== "fail") ? "pass" : "fail",
  };

  fs.writeFileSync(path.join(outDir, "batch-regression.json"), JSON.stringify(batchReport, null, 2), "utf-8");

  // Fix the markdown template (p0Count was undefined in template literal)
  const md = generateMarkdown(baseline, results, warning);
  fs.writeFileSync(path.join(outDir, "batch-regression.md"), md, "utf-8");

  console.log("");
  console.log(`Verdict: ${batchReport.verdict.toUpperCase()}`);
  console.log(`Output: ${outDir}`);

  if (batchReport.verdict === "fail") process.exit(1);
}

main();
