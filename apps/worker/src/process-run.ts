import { type RunRecord, updateRunStatus } from "./supabase.js";

/**
 * 处理单个 run
 * 当前只做日志输出，不执行实际分析
 */
export async function processRun(run: RunRecord): Promise<void> {
  console.log(`[Worker] Processing run: ${run.id}`);
  console.log(`[Worker]   caseName: ${run.case_name}`);
  console.log(`[Worker]   scenario: ${run.scenario}`);
  console.log(`[Worker]   feedback_count: ${run.feedback_count}`);
  console.log(`[Worker]   status: ${run.status}`);
  console.log(`[Worker]   metadata:`, JSON.stringify(run.metadata, null, 2));

  // TODO: Step 3 - 更新状态为 running
  // await updateRunStatus(run.id, "running", {
  //   ...run.metadata,
  //   worker: "cloud-worker",
  //   workerStartedAt: new Date().toISOString(),
  // });

  // TODO: Step 4 - 下载 input.csv
  // const inputFile = run.metadata?.inputFile;
  // if (inputFile) { ... }

  // TODO: Step 5 - 执行 pipeline
  // await runPipeline(run.case_name, inputPath);

  // TODO: Step 6 - 读取产物
  // const summary = readSummary(outputDir);

  // TODO: Step 7 - 写回 Supabase
  // await updateRunStatus(run.id, "completed", { ... });

  console.log(`[Worker] Run ${run.id} processing complete (dry run)`);
}
