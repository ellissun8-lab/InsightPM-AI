import { type RunRecord, updateRunStatus, supabase } from "./supabase.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const WORKER_TMP_DIR = process.env.WORKER_TMP_DIR || path.join(os.tmpdir(), "proofloop-worker");

/**
 * 处理单个 run
 * Step 4: 下载 CSV 到临时目录
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
    workerStep: "download-csv",
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
    // Step 2: 检查 inputFile metadata
    const inputFile = run.metadata?.inputFile;
    if (!inputFile || !inputFile.bucket || !inputFile.path) {
      console.error(`[Worker] Missing inputFile metadata for run ${run.id}`);
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        error: { message: "Missing inputFile metadata" },
        failedAt: now,
      });
      return;
    }

    console.log(`[Worker] inputFile bucket: ${inputFile.bucket}`);
    console.log(`[Worker] inputFile path: ${inputFile.path}`);
    console.log(`[Worker] inputFile originalName: ${inputFile.originalName}`);

    // Step 3: 下载 CSV
    console.log(`[Worker] Downloading input CSV...`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(inputFile.bucket)
      .download(inputFile.path);

    if (downloadError || !fileData) {
      console.error(`[Worker] Failed to download CSV:`, downloadError);
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        error: { message: `Failed to download CSV: ${downloadError?.message || "Unknown error"}` },
        failedAt: now,
      });
      return;
    }

    // Step 4: 保存到本地临时目录
    const localDir = path.join(WORKER_TMP_DIR, run.id);
    const localPath = path.join(localDir, "input.csv");

    fs.mkdirSync(localDir, { recursive: true });

    const buffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(localPath, buffer);

    console.log(`[Worker] Saved input to local path: ${localPath}`);
    console.log(`[Worker] File size: ${buffer.length} bytes`);

    // Step 5: 更新 metadata
    const downloadedNow = new Date().toISOString();
    console.log(`[Worker] Updating run ${run.id} metadata: download-input-ok`);
    const completedMetadata = {
      ...runningMetadata,
      inputDownloaded: true,
      localInputPath: localPath,
      downloadedAt: downloadedNow,
      workerResult: "download-input-ok",
      hasReport: false,
    };

    const completedOk = await updateRunStatus(run.id, "completed", completedMetadata);
    if (!completedOk) {
      console.error(`[Worker] Failed to update run ${run.id} to completed`);
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        error: { message: "Failed to update to completed status" },
        failedAt: downloadedNow,
      });
      return;
    }
    console.log(`[Worker] Updated run ${run.id} to completed`);
    console.log(`[Worker] Run ${run.id} Step 4 PASSED`);

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
