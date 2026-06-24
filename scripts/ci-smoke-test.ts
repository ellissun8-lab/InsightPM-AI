import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const BASE_DIR = path.join(__dirname, "..");
const TRAINING_DIR = path.join(BASE_DIR, "training-data");
const EVAL_DIR = path.join(BASE_DIR, "evaluation-data");

interface SmokeCheck {
  name: string;
  status: "pass" | "fail";
  message: string;
  durationMs: number;
}

function runCheck(name: string, fn: () => void): SmokeCheck {
  const start = Date.now();
  try {
    fn();
    return {
      name,
      status: "pass",
      message: "OK",
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      name,
      status: "fail",
      message: err.message || String(err),
      durationMs: Date.now() - start,
    };
  }
}

function checkHardValidationZero(): void {
  const csvPath = path.join(TRAINING_DIR, "validation-summary.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").slice(1); // Skip header

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    // CSV: caseName,status,rawCount,normalizedCount,segmentCount,clusterCount,hardValidationStatus,hardValidationScore,semanticScore,criticalIssues,evidenceBroken,consistencyGuard,acceptedAt,baselineType
    // Index:                     0       1      2         3               4             5              6                    7                   8             9              10             11                 12          13
    if (parts[1] === "accepted") {
      // Check hardValidationStatus is not "fail"
      if (parts[6] === "fail") {
        throw new Error(`${parts[0]} has hard validation status: fail`);
      }
    }
  }
}

function checkSemanticScoreMin85(): void {
  const indexPath = path.join(TRAINING_DIR, "dataset-index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  for (const ds of index.datasets) {
    if (ds.status !== "accepted") continue;
    if (ds.semanticScore < 85) {
      throw new Error(`${ds.caseName} has semanticScore ${ds.semanticScore} < 85`);
    }
  }
}

function checkCriticalIssuesZero(): void {
  const indexPath = path.join(TRAINING_DIR, "dataset-index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  for (const ds of index.datasets) {
    if (ds.status !== "accepted") continue;
    // Check semantic validation files in runs directory
    const runDir = path.join(BASE_DIR, "runs", ds.caseName);
    const semanticPath = path.join(runDir, "validation-report", "semantic-validation.json");
    if (fs.existsSync(semanticPath)) {
      const validation = JSON.parse(fs.readFileSync(semanticPath, "utf-8"));
      if (validation.criticalIssues > 0) {
        throw new Error(`${ds.caseName} has ${validation.criticalIssues} critical issues`);
      }
    }
  }
}

function checkEvidenceBrokenZero(): void {
  const csvPath = path.join(TRAINING_DIR, "validation-summary.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").slice(1); // Skip header

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    if (parts[1] === "accepted" && parts[10] !== "0") {
      throw new Error(`${parts[0]} has evidenceBroken: ${parts[10]}`);
    }
  }
}

function checkConsistencyGuardPassed(): void {
  const csvPath = path.join(TRAINING_DIR, "validation-summary.csv");
  const csv = fs.readFileSync(csvPath, "utf-8");
  const lines = csv.split("\n").slice(1); // Skip header

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    if (parts[1] === "accepted" && parts[11] !== "passed") {
      throw new Error(`${parts[0]} has consistencyGuard: ${parts[11]}`);
    }
  }
}

function checkDatasetIndexGeneratable(): void {
  // Run dataset-index script
  execSync("npm run insightpm:dataset-index", {
    cwd: BASE_DIR,
    stdio: "pipe",
  });

  // Verify the index was generated
  const indexPath = path.join(TRAINING_DIR, "dataset-index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error("dataset-index.json was not generated");
  }

  const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  if (!index.datasets || index.datasets.length === 0) {
    throw new Error("dataset-index.json has no datasets");
  }
}

function checkEvaluationSmoke(): void {
  // Check if heldout datasets exist
  const heldoutDir = path.join(EVAL_DIR, "heldout");
  if (!fs.existsSync(heldoutDir)) {
    throw new Error("evaluation-data/heldout directory not found");
  }

  const heldoutDatasets = fs.readdirSync(heldoutDir);
  if (heldoutDatasets.length === 0) {
    throw new Error("No heldout datasets found");
  }

  // Run evaluation on first heldout dataset as smoke test
  const testCase = heldoutDatasets[0];
  execSync(`npm run insightpm:evaluate -- --case ${testCase}`, {
    cwd: BASE_DIR,
    stdio: "pipe",
  });

  // Verify evaluation result exists
  const resultPath = path.join(EVAL_DIR, "results", `${testCase}.evaluation.json`);
  if (!fs.existsSync(resultPath)) {
    throw new Error(`Evaluation result not generated for ${testCase}`);
  }

  const result = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
  if (result.averageScore < 50) {
    throw new Error(`Evaluation smoke test failed: averageScore ${result.averageScore} < 50`);
  }
}

function main() {
  console.log("=== CI Smoke Test ===\n");

  const checks: SmokeCheck[] = [];

  checks.push(runCheck("hard_fail_zero", checkHardValidationZero));
  checks.push(runCheck("semantic_score_min_85", checkSemanticScoreMin85));
  checks.push(runCheck("critical_issues_zero", checkCriticalIssuesZero));
  checks.push(runCheck("evidence_broken_zero", checkEvidenceBrokenZero));
  checks.push(runCheck("consistency_guard_passed", checkConsistencyGuardPassed));
  checks.push(runCheck("dataset_index_generatable", checkDatasetIndexGeneratable));
  checks.push(runCheck("evaluation_smoke", checkEvaluationSmoke));

  // Print results
  let allPassed = true;
  for (const check of checks) {
    const icon = check.status === "pass" ? "PASS" : "FAIL";
    console.log(`[${icon}] ${check.name} (${check.durationMs}ms)`);
    if (check.status === "fail") {
      console.log(`  Error: ${check.message}`);
      allPassed = false;
    }
  }

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Total: ${checks.length} checks`);
  console.log(`Passed: ${checks.filter(c => c.status === "pass").length}`);
  console.log(`Failed: ${checks.filter(c => c.status === "fail").length}`);
  console.log(`Status: ${allPassed ? "PASS" : "FAIL"}`);

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    status: allPassed ? "pass" : "fail",
    checks,
    passedCount: checks.filter(c => c.status === "pass").length,
    failedCount: checks.filter(c => c.status === "fail").length,
  };

  const reportPath = path.join(BASE_DIR, "ci-smoke-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to: ${reportPath}`);

  process.exit(allPassed ? 0 : 1);
}

main();
