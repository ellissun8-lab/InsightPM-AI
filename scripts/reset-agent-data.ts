/**
 * 一键重置 Agent 训练数据
 * 运行: pnpm reset-agent-data
 *
 * 1. 归档旧数据到 _legacy/{timestamp}/
 * 2. 清空当前 fixtures/raw-inputs, normalized, analysis
 * 3. 清空 validation-reports 和 training-reports
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(__dirname, "..");
const FIXTURES = path.join(ROOT, "fixtures");
const LEGACY = path.join(FIXTURES, "_legacy");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function moveDirContents(src: string, dest: string) {
  if (!fs.existsSync(src)) return 0;
  ensureDir(dest);
  const items = fs.readdirSync(src);
  let count = 0;
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    try {
      fs.renameSync(srcPath, destPath);
    } catch {
      // On Windows, rename may fail for dirs with many files - use copy + delete
      if (fs.statSync(srcPath).isDirectory()) {
        copyDirRecursive(srcPath, destPath);
        fs.rmSync(srcPath, { recursive: true, force: true });
      } else {
        fs.copyFileSync(srcPath, destPath);
        fs.rmSync(srcPath, { force: true });
      }
    }
    count++;
  }
  return count;
}

function copyDirRecursive(src: string, dest: string) {
  ensureDir(dest);
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDirContents(dir: string) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const p = path.join(dir, item);
    if (fs.statSync(p).isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      fs.rmSync(p, { force: true });
    }
  }
}

function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + "_" +
    new Date().toISOString().replace(/[:.]/g, "-").split("T")[1].replace(/-/g, "").substring(0, 6);

  console.log("=".repeat(60));
  console.log("InsightPM Agent Data Reset");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${timestamp}`);
  console.log("");

  // Step 1: Create legacy directory
  const legacyDir = path.join(LEGACY, timestamp);
  ensureDir(legacyDir);
  console.log("Step 1: Archiving old data...");

  const archiveDirs = [
    path.join(FIXTURES, "raw-inputs"),
    path.join(FIXTURES, "normalized"),
    path.join(FIXTURES, "analysis"),
  ];

  for (const dir of archiveDirs) {
    if (fs.existsSync(dir)) {
      const destDir = path.join(legacyDir, path.basename(dir));
      const count = moveDirContents(dir, destDir);
      console.log(`  📦 Archived ${path.basename(dir)}/ (${count} items)`);
    }
  }

  // Archive validation-reports
  const valDir = path.join(ROOT, "validation-reports");
  if (fs.existsSync(valDir)) {
    const destDir = path.join(legacyDir, "validation-reports");
    const count = moveDirContents(valDir, destDir);
    console.log(`  📦 Archived validation-reports/ (${count} items)`);
  }

  // Archive training-reports
  const trainDir = path.join(ROOT, "training-reports");
  if (fs.existsSync(trainDir)) {
    const destDir = path.join(legacyDir, "training-reports");
    const count = moveDirContents(trainDir, destDir);
    console.log(`  📦 Archived training-reports/ (${count} items)`);
  }

  console.log(`  ✅ Archived to fixtures/_legacy/${timestamp}/`);
  console.log("");

  // Step 2: Ensure clean directories exist
  console.log("Step 2: Ensuring clean directories...");
  ensureDir(path.join(FIXTURES, "raw-inputs"));
  ensureDir(path.join(FIXTURES, "normalized"));
  ensureDir(path.join(FIXTURES, "analysis", "mixed-feedback", "segments"));
  ensureDir(valDir);
  ensureDir(trainDir);
  console.log("  ✅ Clean directories ready");
  console.log("");

  // Step 3: Verify no old structured CSVs in raw-inputs
  console.log("Step 3: Verifying no legacy structured CSVs...");
  const legacyCsvs = [
    "b2b-saas-renewal.csv", "b2b-saas-activation.csv", "ai-product-experience.csv",
    "bi-tool-renewal.csv", "ecommerce-conversion.csv", "internal-system-cost.csv",
  ];
  const rawDir = path.join(FIXTURES, "raw-inputs");
  let clean = true;
  for (const csv of legacyCsvs) {
    const p = path.join(rawDir, csv);
    if (fs.existsSync(p)) {
      console.log(`  ❌ Found legacy CSV: ${csv} - removing`);
      fs.rmSync(p, { force: true });
      clean = false;
    }
  }
  // Also check feedback/ directory
  const feedbackDir = path.join(FIXTURES, "feedback");
  if (fs.existsSync(feedbackDir)) {
    console.log(`  ❌ Found feedback/ directory - archiving`);
    const destDir = path.join(legacyDir, "feedback");
    moveDirContents(feedbackDir, destDir);
    clean = false;
  }
  if (clean) console.log("  ✅ No legacy structured CSVs found");
  console.log("");

  console.log("=".repeat(60));
  console.log("Reset complete! Ready for: pnpm train-agent");
  console.log("=".repeat(60));
}

main();
