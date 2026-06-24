/**
 * 验证数据填充脚本
 * 运行: pnpm dev:with-fixtures
 *
 * 如果 fixtures/feedback 为空，自动生成测试数据
 */

import * as fs from "fs";
import * as path from "path";

const feedbackDir = path.join(__dirname, "..", "fixtures", "feedback");

// Check if fixtures already exist
const existingFiles = fs.existsSync(feedbackDir)
  ? fs.readdirSync(feedbackDir).filter((f) => f.endsWith(".csv"))
  : [];

if (existingFiles.length > 0) {
  console.log(`✅ Fixtures 已存在 (${existingFiles.length} 个文件)，跳过生成`);
  process.exit(0);
}

console.log("📦 Fixtures 不存在，开始生成测试数据...");

// Run the generate script
const { execSync } = require("child_process");
try {
  execSync("tsx scripts/generate-test-datasets.ts", {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });
  console.log("✅ 测试数据生成完成");
} catch (error) {
  console.error("❌ 测试数据生成失败:", error);
  process.exit(1);
}
