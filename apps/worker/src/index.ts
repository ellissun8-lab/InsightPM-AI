// 必须在最顶部加载环境变量
import { loadEnv } from "./load-env.js";
loadEnv();

// 调试：检查 DEEPSEEK_API_KEY
console.log("[Worker] DEBUG: DEEPSEEK_API_KEY =", process.env.DEESEEK_API_KEY ? "configured" : "NOT SET");

import { getPendingRuns } from "./supabase.js";
import { processRun } from "./process-run.js";

const POLL_INTERVAL_MS = parseInt(
  process.env.WORKER_POLL_INTERVAL_MS || "10000",
  10
);

console.log("[Worker] ProofLoop Cloud Worker started");
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
