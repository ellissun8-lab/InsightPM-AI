import { type RunRecord, updateRunStatus } from "./supabase.js";

/**
 * 处理单个 run
 * Step 3: 状态流转验证 pending → running → completed
 */
export async function processRun(run: RunRecord): Promise<void> {
  const now = new Date().toISOString();

  console.log(`[Worker] Picked pending run: ${run.id}`);
  console.log(`[Worker]   caseName: ${run.case_name}`);
  console.log(`[Worker]   scenario: ${run.scenario}`);
  console.log(`[Worker]   feedback_count: ${run.feedback_count}`);

  // Step 1: 更新状态为 running
  console.log(`[Worker] Updating run ${run.id} to status: running`);
  const runningMetadata = {
    ...run.metadata,
    worker: "cloud-worker",
    workerStep: "state-transition-test",
    workerStartedAt: now,
  };

  const runningOk = await updateRunStatus(run.id, "running", runningMetadata);
  if (!runningOk) {
    console.error(`[Worker] Failed to update run ${run.id} to running`);
    await updateRunStatus(run.id, "failed", {
      ...run.metadata,
      error: { message: "Failed to update to running status" },
      failedAt: now,
    });
    return;
  }
  console.log(`[Worker] Updated run ${run.id} to running`);

  try {
    // Step 2: 模拟处理 2-3 秒
    console.log(`[Worker] Simulating processing for run ${run.id}...`);
    await sleep(2000 + Math.random() * 1000);
    console.log(`[Worker] Simulated processing complete`);

    // Step 3: 更新状态为 completed
    const completedNow = new Date().toISOString();
    console.log(`[Worker] Updating run ${run.id} to status: completed`);
    const completedMetadata = {
      ...runningMetadata,
      workerCompletedAt: completedNow,
      workerResult: "state-transition-ok",
      hasReport: false,
    };

    const completedOk = await updateRunStatus(run.id, "completed", completedMetadata);
    if (!completedOk) {
      console.error(`[Worker] Failed to update run ${run.id} to completed`);
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        error: { message: "Failed to update to completed status" },
        failedAt: completedNow,
      });
      return;
    }
    console.log(`[Worker] Updated run ${run.id} to completed`);
    console.log(`[Worker] Run ${run.id} state transition test PASSED`);

  } catch (err: any) {
    const failedNow = new Date().toISOString();
    console.error(`[Worker] Error processing run ${run.id}:`, err.message);
    await updateRunStatus(run.id, "failed", {
      ...runningMetadata,
      error: { message: err.message },
      failedAt: failedNow,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
