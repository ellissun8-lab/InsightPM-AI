import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// 按优先级加载 .env 文件
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env.local"),
  path.resolve(process.cwd(), "../.env"),
];

console.log("[Worker] ProofLoop Cloud Worker starting...");
console.log(`[Worker] process.cwd(): ${process.cwd()}`);

let envLoaded = false;
for (const envPath of envPaths) {
  const exists = fs.existsSync(envPath);
  console.log(`[Worker] Checking ${envPath}: ${exists ? "exists" : "not found"}`);
  if (exists && !envLoaded) {
    dotenv.config({ path: envPath, override: false });
    console.log(`[Worker] Loaded env from: ${envPath}`);
    envLoaded = true;
  }
}

// 打印环境变量状态（不打印原文）
console.log("[Worker] Environment check:");
console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? "configured" : "NOT SET"}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "NOT SET"}`);
console.log(`  AI_PROVIDER: ${process.env.AI_PROVIDER || "NOT SET"}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "configured" : "NOT SET"}`);
console.log(`  OPENAI_BASE_URL: ${process.env.OPENAI_BASE_URL || "NOT SET"}`);
console.log(`  OPENAI_MODEL: ${process.env.OPENAI_MODEL || "NOT SET"}`);
console.log(`  VALIDATION_AI_PROVIDER: ${process.env.VALIDATION_AI_PROVIDER || "NOT SET"}`);
console.log(`  DEEPSEEK_API_KEY: ${process.env.DEESEEK_API_KEY ? "configured" : "NOT SET"}`);
console.log(`  DEEPSEEK_BASE_URL: ${process.env.DEESEEK_BASE_URL || "NOT SET"}`);
console.log(`  DEEPSEEK_VALIDATION_MODEL: ${process.env.DEESEEK_VALIDATION_MODEL || "NOT SET"}`);

import { getPendingRuns } from "./supabase.js";
import { processRun } from "./process-run.js";

const POLL_INTERVAL_MS = parseInt(
  process.env.WORKER_POLL_INTERVAL_MS || "10000",
  10
);

console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
console.log("[Worker] Waiting for pending runs...");

let isRunning = false;

async function poll() {
  if (isRunning) {
    console.log("[Worker] Previous poll still running, skipping...");
    return;
  }

  isRunning = true;

  try {
    const pendingRuns = await getPendingRuns();

    if (pendingRuns.length === 0) {
      console.log(`[Worker] No pending runs found. Checking again in ${POLL_INTERVAL_MS / 1000}s...`);
    } else {
      console.log(`[Worker] Found ${pendingRuns.length} pending run(s)`);

      for (const run of pendingRuns) {
        try {
          await processRun(run);
        } catch (err) {
          console.error(`[Worker] Error processing run ${run.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[Worker] Error during poll:", err);
  } finally {
    isRunning = false;
  }
}

// 首次立即执行
poll();

// 定时轮询
setInterval(poll, POLL_INTERVAL_MS);

// 优雅退出
process.on("SIGINT", () => {
  console.log("[Worker] Received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[Worker] Received SIGTERM, shutting down...");
  process.exit(0);
});
