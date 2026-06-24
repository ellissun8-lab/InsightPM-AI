/**
 * InsightPM AI 回归对比
 * 运行: npx tsx scripts/regression.ts --baseline mixed-feedback-v1 --target mixed-feedback-v2
 *
 * 对比两次运行的 validation report，检测回归问题。
 */

import * as fs from "fs";
import * as path from "path";

const RUNS_DIR = path.join(__dirname, "..", "runs");
const BASELINE_DIR = path.join(__dirname, "..", "baseline");

interface RegressionResult {
  baseline: string;
  target: string;
  timestamp: string;
  status: "pass" | "fail";
  checks: {
    name: string;
    baseline_status: string;
    target_status: string;
    regression: boolean;
  }[];
  summary: {
    total_checks: number;
    regressions: number;
    improvements: number;
    unchanged: number;
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let baseline = "mixed-feedback-v1";
  let target = "mixed-feedback-v2";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--baseline" && args[i + 1]) baseline = args[++i];
    if (args[i] === "--target" && args[i + 1]) target = args[++i];
  }

  return { baseline, target };
}

function loadValidation(caseName: string): any {
  // Try runs/ directory first, then baseline/
  const runPath = path.join(RUNS_DIR, caseName, "validation-report", "hard-validation.json");
  const baselinePath = path.join(BASELINE_DIR, caseName, "validation-report", "hard-validation.json");

  if (fs.existsSync(runPath)) return JSON.parse(fs.readFileSync(runPath, "utf-8"));
  if (fs.existsSync(baselinePath)) return JSON.parse(fs.readFileSync(baselinePath, "utf-8"));

  throw new Error(`Validation report not found for ${caseName}. Checked:\n  ${runPath}\n  ${baselinePath}`);
}

function main() {
  const { baseline, target } = parseArgs();

  console.log("=".repeat(60));
  console.log(`Regression: ${baseline} → ${target}`);
  console.log("=".repeat(60));
  console.log("");

  const baselineVal = loadValidation(baseline);
  const targetVal = loadValidation(target);

  // Build check maps
  const baselineChecks = new Map<string, string>();
  for (const c of baselineVal.checks) baselineChecks.set(c.name, c.status);
  const targetChecks = new Map<string, string>();
  for (const c of targetVal.checks) targetChecks.set(c.name, c.status);

  // Compare
  const allNames = new Set([...baselineChecks.keys(), ...targetChecks.keys()]);
  const checkResults: RegressionResult["checks"] = [];

  for (const name of allNames) {
    const baseStatus = baselineChecks.get(name) || "missing";
    const targetStatus = targetChecks.get(name) || "missing";

    // Regression: target is worse than baseline
    const statusOrder = { pass: 0, warning: 1, fail: 2, missing: 3 };
    const regression = (statusOrder[targetStatus as keyof typeof statusOrder] || 3)
      > (statusOrder[baseStatus as keyof typeof statusOrder] || 3);

    checkResults.push({
      name,
      baseline_status: baseStatus,
      target_status: targetStatus,
      regression,
    });
  }

  const regressions = checkResults.filter(c => c.regression).length;
  const improvements = checkResults.filter(c => {
    const statusOrder = { pass: 0, warning: 1, fail: 2, missing: 3 };
    return (statusOrder[c.target_status as keyof typeof statusOrder] || 3)
      < (statusOrder[c.baseline_status as keyof typeof statusOrder] || 3);
  }).length;
  const unchanged = checkResults.length - regressions - improvements;

  const result: RegressionResult = {
    baseline,
    target,
    timestamp: new Date().toISOString(),
    status: regressions > 0 ? "fail" : "pass",
    checks: checkResults,
    summary: {
      total_checks: checkResults.length,
      regressions,
      improvements,
      unchanged,
    },
  };

  // Print results
  console.log(`Baseline: ${baseline} (score: ${baselineVal.score}, ${baselineVal.summary.pass_count}/${baselineVal.summary.total_checks} pass)`);
  console.log(`Target:   ${target} (score: ${targetVal.score}, ${targetVal.summary.pass_count}/${targetVal.summary.total_checks} pass)`);
  console.log("");

  if (regressions > 0) {
    console.log("REGRESSIONS:");
    for (const c of checkResults.filter(c => c.regression)) {
      console.log(`  ${c.name}: ${c.baseline_status} → ${c.target_status}`);
    }
    console.log("");
  }

  if (improvements > 0) {
    console.log("IMPROVEMENTS:");
    for (const c of checkResults.filter(c => !c.regression)) {
      const statusOrder = { pass: 0, warning: 1, fail: 2, missing: 3 };
      if ((statusOrder[c.target_status as keyof typeof statusOrder] || 3)
        < (statusOrder[c.baseline_status as keyof typeof statusOrder] || 3)) {
        console.log(`  ${c.name}: ${c.baseline_status} → ${c.target_status}`);
      }
    }
    console.log("");
  }

  console.log(`Result: ${result.status.toUpperCase()} | ${regressions} regressions, ${improvements} improvements, ${unchanged} unchanged`);

  // Save report
  const reportDir = path.join(RUNS_DIR, target, "validation-report");
  if (fs.existsSync(reportDir)) {
    const reportPath = path.join(reportDir, "regression.json");
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`Report saved to ${reportPath}`);
  }

  if (result.status === "fail") process.exit(1);
}

main();
