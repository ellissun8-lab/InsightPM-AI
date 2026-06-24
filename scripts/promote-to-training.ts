/**
 * InsightPM AI - Promote Run to Training Data
 * 运行: npx tsx scripts/promote-to-training.ts --case mixed-feedback-realism-v1
 *
 * 验证标准:
 *   - hardValidation.fail = 0
 *   - semanticScore >= 85
 *   - criticalIssues = 0
 *   - evidenceBroken = 0
 *   - consistencyGuard = passed
 */

import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.join(__dirname, "..");
const RUNS_DIR = path.join(PROJECT_ROOT, "runs");
const TRAINING_DIR = path.join(PROJECT_ROOT, "training-data");

interface Manifest {
  caseName: string;
  status: "accepted" | "rejected";
  rawCount: number;
  normalizedCount: number;
  segmentCount: number;
  clusterCount: number;
  hardValidationStatus: string;
  hardValidationScore: number;
  semanticScore: number;
  criticalIssues: number;
  evidenceBroken: number;
  consistencyGuard: "passed" | "failed";
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReasons: string[];
  baselineType: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let caseName = "";
  let baselineType = "unknown";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--case" && args[i + 1]) caseName = args[++i];
    if (args[i] === "--baseline-type" && args[i + 1]) baselineType = args[++i];
  }

  if (!caseName) {
    console.error("Usage: tsx scripts/promote-to-training.ts --case <caseName> [--baseline-type <type>]");
    process.exit(1);
  }

  return { caseName, baselineType };
}

function loadJson(p: string): any {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

function copyDir(src: string, dest: string) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
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

function assertConsistency(hardValPath: string, semanticJsonPath: string, summaryPath: string): boolean {
  if (!fs.existsSync(hardValPath) || !fs.existsSync(semanticJsonPath) || !fs.existsSync(summaryPath)) {
    return false;
  }

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

  for (const [field, expected] of Object.entries(hard)) {
    if (fromSemantic[field] !== expected) return false;
    if (fromSummary[field] !== expected) return false;
  }

  return true;
}

function main() {
  const { caseName, baselineType } = parseArgs();
  const runDir = path.join(RUNS_DIR, caseName);

  if (!fs.existsSync(runDir)) {
    console.error(`Run directory not found: ${runDir}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log(`Promote to Training Data: ${caseName}`);
  console.log("=".repeat(60));

  // Load validation artifacts
  const hardValPath = path.join(runDir, "validation-report", "hard-validation.json");
  const semanticJsonPath = path.join(runDir, "validation-report", "semantic-validation.json");
  const summaryPath = path.join(runDir, "validation-report", "validation-summary.json");

  const hardVal = loadJson(hardValPath);
  const semanticVal = loadJson(semanticJsonPath);
  const valSummary = loadJson(summaryPath);

  if (!hardVal || !semanticVal || !valSummary) {
    console.error("Missing validation artifacts. Run pipeline + semantic validation first.");
    process.exit(1);
  }

  // Load data counts
  const normalizedPath = path.join(runDir, "normalized");
  const normalizedCount = fs.existsSync(normalizedPath)
    ? (loadJson(path.join(normalizedPath, fs.readdirSync(normalizedPath).find(f => f.endsWith(".normalized.json")) || "")) || []).length
    : 0;

  const analysisPath = path.join(runDir, "analysis");
  const overallJsonPath = fs.existsSync(analysisPath)
    ? fs.readdirSync(analysisPath).find(f => f.endsWith(".overall.analysis.json"))
    : null;
  const overallJson = overallJsonPath ? loadJson(path.join(analysisPath, overallJsonPath)) : null;
  const clusterCount = overallJson?.issue_clusters?.length || 0;
  const segmentCount = overallJson?.segments?.length || 0;

  const inputPath = path.join(runDir, "input");
  const rawCount = fs.existsSync(inputPath)
    ? (() => {
        const csvFile = fs.readdirSync(inputPath).find(f => f.endsWith(".csv"));
        if (!csvFile) return 0;
        const lines = fs.readFileSync(path.join(inputPath, csvFile), "utf-8").split("\n").filter(l => l.trim());
        return Math.max(0, lines.length - 1); // exclude header
      })()
    : 0;

  // Check promotion criteria
  const rejectionReasons: string[] = [];

  const hardFail = hardVal.summary?.fail_count || 0;
  if (hardFail > 0) rejectionReasons.push(`hardValidation.fail = ${hardFail} (required 0)`);

  const semScore = semanticVal.semanticScore || 0;
  if (semScore < 85) rejectionReasons.push(`semanticScore = ${semScore} (required >= 85)`);

  const critIssues = semanticVal.criticalIssues || 0;
  if (critIssues > 0) rejectionReasons.push(`criticalIssues = ${critIssues} (required 0)`);

  const evidBroken = semanticVal.evidenceBroken || 0;
  if (evidBroken > 0) rejectionReasons.push(`evidenceBroken = ${evidBroken} (required 0)`);

  const consistencyOk = assertConsistency(hardValPath, semanticJsonPath, summaryPath);
  if (!consistencyOk) rejectionReasons.push("consistencyGuard = failed (artifacts disagree)");

  const accepted = rejectionReasons.length === 0;
  const status = accepted ? "accepted" : "rejected";
  const now = new Date().toISOString();

  console.log("");
  console.log(`  hardValidation.fail: ${hardFail} ${hardFail === 0 ? "PASS" : "FAIL"}`);
  console.log(`  semanticScore: ${semScore} ${semScore >= 85 ? "PASS" : "FAIL"}`);
  console.log(`  criticalIssues: ${critIssues} ${critIssues === 0 ? "PASS" : "FAIL"}`);
  console.log(`  evidenceBroken: ${evidBroken} ${evidBroken === 0 ? "PASS" : "FAIL"}`);
  console.log(`  consistencyGuard: ${consistencyOk ? "passed" : "failed"} ${consistencyOk ? "PASS" : "FAIL"}`);
  console.log("");

  // Build manifest
  const manifest: Manifest = {
    caseName,
    status,
    rawCount,
    normalizedCount,
    segmentCount,
    clusterCount,
    hardValidationStatus: hardVal.status || "unknown",
    hardValidationScore: hardVal.score || 0,
    semanticScore: semScore,
    criticalIssues: critIssues,
    evidenceBroken: evidBroken,
    consistencyGuard: consistencyOk ? "passed" : "failed",
    acceptedAt: accepted ? now : null,
    rejectedAt: accepted ? null : now,
    rejectionReasons,
    baselineType,
  };

  // Copy to appropriate directory
  const destDir = path.join(TRAINING_DIR, status, caseName);
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }

  if (accepted) {
    // Copy full run data for accepted
    console.log(`  Promoting to training-data/accepted/${caseName}/`);
    copyDir(runDir, destDir);
  } else {
    // Copy only validation report for rejected
    console.log(`  Moving to training-data/rejected/${caseName}/`);
    fs.mkdirSync(destDir, { recursive: true });
    const valDir = path.join(runDir, "validation-report");
    if (fs.existsSync(valDir)) {
      copyDir(valDir, path.join(destDir, "validation-report"));
    }
    // Copy run-summary if exists
    const runSummary = path.join(runDir, "run-summary.json");
    if (fs.existsSync(runSummary)) {
      fs.copyFileSync(runSummary, path.join(destDir, "run-summary.json"));
    }
  }

  // Save manifest
  const manifestPath = path.join(TRAINING_DIR, "manifests", `${caseName}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`  Manifest: ${manifestPath}`);

  // Append to validation-summary.csv
  const csvPath = path.join(TRAINING_DIR, "validation-summary.csv");
  const csvRow = [
    caseName,
    status,
    rawCount,
    normalizedCount,
    segmentCount,
    clusterCount,
    hardVal.status || "unknown",
    hardVal.score || 0,
    semScore,
    critIssues,
    evidBroken,
    consistencyOk ? "passed" : "failed",
    accepted ? now : "",
    baselineType,
  ].join(",");

  fs.appendFileSync(csvPath, csvRow + "\n", "utf-8");
  console.log(`  CSV updated: ${csvPath}`);

  // Print result
  console.log("");
  console.log("=".repeat(60));
  if (accepted) {
    console.log(`PROMOTED: ${caseName} → training-data/accepted/`);
  } else {
    console.log(`REJECTED: ${caseName} → training-data/rejected/`);
    console.log("Rejection reasons:");
    for (const r of rejectionReasons) {
      console.log(`  - ${r}`);
    }
  }
  console.log("=".repeat(60));

  if (!accepted) process.exit(1);
}

main();
