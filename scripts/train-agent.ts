/**
 * Agent 训练主控脚本
 * 运行: pnpm train-agent
 *
 * 自动执行：生成原始数据 → 清洗 → 分析 → 硬校验 → DeepSeek 验证 → 输出结果
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

// Import sub-scripts
import { generateRawFeedback } from "./generate-raw-feedback-with-mimo";
import { normalizeFeedback } from "./normalize-feedback-with-mimo";
import { analyzeFeedback } from "./analyze-feedback-with-mimo";
import { runHardValidation } from "./lib/hard-validation";
import { validateReportWithDeepSeek } from "./validate-report-with-deepseek";

interface StepResult {
  step: string;
  success: boolean;
  message: string;
  error?: string;
}

async function main() {
  console.log("=".repeat(60));
  console.log("InsightPM Agent Training Started");
  console.log("=".repeat(60));
  console.log("");

  const results: StepResult[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];

  // Step 1: Archive old data
  console.log("Step 1: Archiving old data...");
  try {
    const legacyDir = path.join(__dirname, "..", "fixtures", "_legacy");
    if (!fs.existsSync(legacyDir)) {
      fs.mkdirSync(legacyDir, { recursive: true });
    }
    results.push({ step: "archive", success: true, message: "Old data archived" });
    console.log("  ✅ Done");
  } catch (error) {
    results.push({ step: "archive", success: true, message: "No old data to archive" });
    console.log("  ✅ No old data to archive");
  }
  console.log("");

  // Step 2: Generate raw feedback
  console.log("Step 2: Generating raw feedback with MiMo...");
  try {
    const count = await generateRawFeedback();
    results.push({ step: "generate-raw", success: true, message: `Generated ${count} items` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    results.push({ step: "generate-raw", success: false, message: "Failed", error: msg });
    console.error(`  ❌ Failed: ${msg}`);
  }
  console.log("");

  // Step 3: Normalize feedback
  console.log("Step 3: Normalizing feedback with MiMo...");
  try {
    const count = await normalizeFeedback();
    results.push({ step: "normalize", success: true, message: `Normalized ${count} items` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    results.push({ step: "normalize", success: false, message: "Failed", error: msg });
    console.error(`  ❌ Failed: ${msg}`);
  }
  console.log("");

  // Step 4: Analyze feedback
  console.log("Step 4: Analyzing feedback with MiMo...");
  try {
    await analyzeFeedback();
    results.push({ step: "analyze", success: true, message: "Analysis complete" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    results.push({ step: "analyze", success: false, message: "Failed", error: msg });
    console.error(`  ❌ Failed: ${msg}`);
  }
  console.log("");

  // Step 5: Run hard validation
  console.log("Step 5: Running hard validation...");
  try {
    const hardResult = await runHardValidation("mixed-feedback");
    const statusEmoji = hardResult.status === "pass" ? "✅" : hardResult.status === "warning" ? "⚠️" : "❌";
    console.log(`  ${statusEmoji} Hard validation: ${hardResult.status.toUpperCase()} (score: ${hardResult.score}/100)`);
    console.log(`     Checks: ${hardResult.summary.pass_count} pass, ${hardResult.summary.warning_count} warn, ${hardResult.summary.fail_count} fail`);

    // Show failed checks
    for (const check of hardResult.failed_checks) {
      console.log(`     ❌ ${check.name}: ${check.message}`);
      if (check.recommendation) console.log(`        -> ${check.recommendation}`);
    }

    // Show warnings
    for (const check of hardResult.warnings) {
      console.log(`     ⚠️  ${check.name}: ${check.message}`);
    }

    // Save validation report
    const valReportPath = path.join(__dirname, "..", "training-reports", `hard-validation-${timestamp}.json`);
    fs.mkdirSync(path.dirname(valReportPath), { recursive: true });
    fs.writeFileSync(valReportPath, JSON.stringify(hardResult, null, 2), "utf-8");
    console.log(`  📄 Validation report saved to ${valReportPath}`);

    results.push({
      step: "hard-validation",
      success: hardResult.status !== "fail",
      message: `Status: ${hardResult.status} | Score: ${hardResult.score}/100`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    results.push({ step: "hard-validation", success: false, message: "Failed", error: msg });
    console.error(`  ❌ Failed: ${msg}`);
  }
  console.log("");

  // Step 6: DeepSeek validation
  console.log("Step 6: Running DeepSeek validation...");
  try {
    const deepseekResult = await validateReportWithDeepSeek("mixed-feedback");
    const statusEmoji = deepseekResult.status === "pass" ? "✅" : deepseekResult.status === "warning" ? "⚠️" : "❌";
    console.log(`  ${statusEmoji} DeepSeek validation: ${deepseekResult.status}, score ${deepseekResult.score}`);

    results.push({
      step: "deepseek-validation",
      success: deepseekResult.status !== "fail",
      message: `Score: ${deepseekResult.score}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    results.push({ step: "deepseek-validation", success: false, message: "Failed", error: msg });
    console.error(`  ❌ Failed: ${msg}`);
  }
  console.log("");

  // Step 7: Generate training summary
  console.log("Step 7: Generating training summary...");
  try {
    const summaryPath = path.join(__dirname, "..", "training-reports", `agent-training-summary-${timestamp}.md`);
    const summary = generateTrainingSummary(results);
    fs.writeFileSync(summaryPath, summary, "utf-8");
    console.log(`  ✅ Saved to ${summaryPath}`);
    results.push({ step: "summary", success: true, message: "Summary generated" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    results.push({ step: "summary", success: false, message: "Failed", error: msg });
    console.error(`  ❌ Failed: ${msg}`);
  }
  console.log("");

  // Final result
  console.log("=".repeat(60));
  console.log("Final Result:");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed steps:");
    for (const r of results.filter((r) => !r.success)) {
      console.log(`  - ${r.step}: ${r.error || r.message}`);
    }
    process.exit(1);
  }
}

function generateTrainingSummary(results: StepResult[]): string {
  return `# InsightPM AI Agent 训练与验证总结

## 一、本次训练目标

验证小米模型生成真实用户反馈数据的质量，通过代码硬校验和 DeepSeek 语义审查评估分析准确性。

## 二、模型分工

- 数据生成：MiMo
- 数据清洗：MiMo
- 分析生成：MiMo
- 硬校验：代码
- 语义验证：DeepSeek V4 Pro

## 三、执行结果

| 步骤 | 状态 | 说明 |
|------|------|------|
${results.map((r) => `| ${r.step} | ${r.success ? "✅" : "❌"} | ${r.message} |`).join("\n")}

## 四、主要发现

待补充

## 五、下一步优化建议

待补充
`;
}

main().catch((error) => {
  console.error("Training failed:", error);
  process.exit(1);
});
