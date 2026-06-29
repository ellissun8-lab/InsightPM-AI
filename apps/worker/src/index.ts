// 必须在最顶部加载环境变量
import { loadEnv } from "./load-env.js";
const envVars = loadEnv();

import { execSync } from "child_process";
import { getPendingRuns, updateRunStatus } from "./supabase.js";
import { processRun } from "./process-run.js";

const POLL_INTERVAL_MS = parseInt(
  process.env.WORKER_POLL_INTERVAL_MS || "10000",
  10
);

// 检查 Python 版本
function checkPythonVersion() {
  const commands = ["python3 --version", "python --version", "py -3 --version"];
  for (const cmd of commands) {
    try {
      const output = execSync(cmd, { encoding: "utf-8", stdio: "pipe" }).trim();
      console.log(`[Worker] Python: ${output}`);
      return;
    } catch {}
  }
  console.warn("[Worker] Python: NOT FOUND (pipeline may fail)");
}

console.log("[Worker] ProofLoop Cloud Worker started");
console.log(`[Worker] Poll interval: ${POLL_INTERVAL_MS}ms`);
console.log(`[Worker] PYTHON_BIN: ${process.env.PYTHON_BIN || "not set"}`);
checkPythonVersion();
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
        console.log(`[Worker] ==============================`);
        console.log(`[Worker] Picked pending run: ${run.id}`);
        console.log(`[Worker]   caseName: ${run.case_name}`);
        console.log(`[Worker]   status: ${run.status}`);
        console.log(`[Worker]   feedback_count: ${run.feedback_count}`);
        console.log(`[Worker]   inputFile: ${JSON.stringify(run.metadata?.inputFile || null)}`);
        console.log(`[Worker] ==============================`);

        try {
          console.log(`[Worker] Starting processRun...`);
          await processRun(run, envVars);
          console.log(`[Worker] processRun completed for ${run.id}`);
        } catch (err: any) {
          console.error(`[Worker] ==============================`);
          console.error(`[Worker] processRun FAILED for ${run.id}`);
          console.error(`[Worker] Error: ${err.message}`);
          console.error(`[Worker] Stack: ${err.stack}`);
          console.error(`[Worker] ==============================`);

          // 写入失败状态到 Supabase
          try {
            await updateRunStatus(run.id, "failed", {
              ...run.metadata,
              error: {
                message: err.message || "Unknown error",
                stack: err.stack || "",
                name: err.name || "Error",
                failedAt: new Date().toISOString(),
                workerStep: "process-run-exception",
                source: "railway-worker",
              },
              failedAt: new Date().toISOString(),
            });
            console.log(`[Worker] Updated run ${run.id} to failed`);
          } catch (updateErr) {
            console.error(`[Worker] Failed to update run status:`, updateErr);
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[Worker] ==============================");
    console.error("[Worker] Error during poll:");
    console.error("[Worker] Error:", err.message);
    console.error("[Worker] Stack:", err.stack);
    console.error("[Worker] ==============================");
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
