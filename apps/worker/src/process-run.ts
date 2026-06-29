import { type RunRecord, updateRunStatus, markRunCompleted, markRunFailed } from "./supabase.js";
import { runPipeline } from "./pipeline-runner.js";
import { discoverArtifacts, uploadAndRecordArtifacts } from "./artifacts.js";
import { downloadFromStorage } from "./storage-downloader.js";
import { startHeartbeat, updateHeartbeat, stopHeartbeat } from "./heartbeat.js";
import * as path from "path";
import * as os from "os";

const WORKER_TMP_DIR = process.env.WORKER_TMP_DIR || path.join(os.tmpdir(), "proofloop-worker");

/**
 * 判断错误是否可重试
 */
function isRetryableError(err: any): boolean {
  const retryableMessages = [
    "fetch failed",
    "ECONNRESET",
    "ETIMEDOUT",
    "timeout",
    "500",
    "502",
    "503",
    "504",
  ];

  const message = err.message || "";
  return retryableMessages.some((msg) => message.includes(msg));
}

/**
 * 获取错误分类
 */
function getErrorCategory(err: any, workerStep: string): string {
  const message = err.message || "";

  if (message.includes("fetch failed") || message.includes("ECONNRESET")) {
    return "storage";
  }
  if (message.includes("AI") || message.includes("model")) {
    return "ai_generation";
  }
  if (message.includes("validation")) {
    return "hard_validation";
  }
  if (message.includes("timeout")) {
    return "timeout";
  }

  return "unknown";
}

/**
 * 处理单个 run
 */
export async function processRun(run: RunRecord, loadedVars?: Record<string, string>): Promise<void> {
  const now = new Date().toISOString();

  console.log(`[Worker] ==============================`);
  console.log(`[Worker] Starting processRun...`);
  console.log(`[Worker]   run.id: ${run.id}`);
  console.log(`[Worker]   caseName: ${run.case_name}`);
  console.log(`[Worker]   scenario: ${run.scenario}`);
  console.log(`[Worker]   feedback_count: ${run.feedback_count}`);
  console.log(`[Worker]   inputFile: ${JSON.stringify(run.metadata?.inputFile || null)}`);
  console.log(`[Worker] ==============================`);

  // 启动 heartbeat
  startHeartbeat(run.id, 30000);

  try {
    // Step 1: 更新 metadata
    await updateHeartbeat(run.id, "process-run-started");

    // Step 2: 检查 inputFile metadata
    const inputFile = run.metadata?.inputFile;
    if (!inputFile || !inputFile.bucket || !inputFile.path) {
      console.error(`[Worker] Missing inputFile metadata for run ${run.id}`);
      await markRunFailed(run.id, "Missing inputFile metadata", "storage", false);
      stopHeartbeat();
      return;
    }

    console.log(`[Worker] inputFile bucket: ${inputFile.bucket}`);
    console.log(`[Worker] inputFile path: ${inputFile.path}`);

    // Step 3: 下载 CSV
    await updateHeartbeat(run.id, "downloading-csv");
    console.log(`[Worker] Downloading input CSV...`);
    const localDir = path.join(WORKER_TMP_DIR, run.id);

    const downloadResult = await downloadFromStorage(
      inputFile.bucket,
      inputFile.path,
      localDir,
      inputFile.originalName || "input.csv"
    );

    if (!downloadResult.success) {
      console.error(`[Worker] failed to download CSV:`, downloadResult.error);
      await markRunFailed(
        run.id,
        downloadResult.error?.message || "Failed to download CSV",
        "storage",
        true // transient error, retryable
      );
      stopHeartbeat();
      return;
    }

    const localInputPath = downloadResult.localPath!;
    console.log(`[Worker] Download successful: ${localInputPath}`);

    // Step 4: 执行 pipeline
    await updateHeartbeat(run.id, "executing-pipeline");
    const outputDir = path.join(WORKER_TMP_DIR, run.id, "output");
    const dataset = run.scenario || run.metadata?.dataset || "mixed-feedback";
    const feedbackCount = run.feedback_count || run.metadata?.feedbackCount || 0;

    console.log(`[Worker] Starting pipeline execution...`);
    const pipelineResult = await runPipeline(
      run.case_name,
      dataset,
      feedbackCount,
      localInputPath,
      outputDir,
      loadedVars
    );

    if (!pipelineResult.success) {
      console.error(`[Worker] Pipeline failed for run ${run.id}`);
      const errorCategory = getErrorCategory(pipelineResult.error, "pipeline");
      const retryable = isRetryableError(pipelineResult.error);

      await markRunFailed(
        run.id,
        pipelineResult.error?.message || "Pipeline execution failed",
        errorCategory,
        retryable
      );
      stopHeartbeat();
      return;
    }

    console.log(`[Worker] Pipeline completed successfully`);
    console.log(`[Worker] Hard score: ${pipelineResult.hardScore}`);
    console.log(`[Worker] Semantic score: ${pipelineResult.semanticScore}`);

    // Step 5: 上传 artifacts
    await updateHeartbeat(run.id, "uploading-artifacts");
    const artifacts = discoverArtifacts(outputDir, run.case_name);

    const artifactResult = await uploadAndRecordArtifacts(
      run.id,
      run.case_name,
      artifacts
    );

    if (!artifactResult.success) {
      console.error(`[Worker] Artifact upload failed: ${artifactResult.error}`);
      await markRunFailed(
        run.id,
        artifactResult.error || "Artifact upload failed",
        "artifact_write",
        true // transient error, retryable
      );
      stopHeartbeat();
      return;
    }

    console.log(`[Worker] Artifacts written: ${artifactResult.artifactTypes.join(", ")}`);

    // Step 6: 标记完成
    await markRunCompleted(
      run.id,
      pipelineResult.hardScore ?? undefined,
      pipelineResult.semanticScore ?? undefined,
      pipelineResult.evidenceBroken ?? undefined,
      {
        ...run.metadata,
        worker: "railway-worker",
        workerStep: "completed",
        workerResult: "artifacts-written-ok",
        pipelineExecuted: true,
        artifactWritten: true,
        artifactWrittenAt: now,
        artifactTypes: artifactResult.artifactTypes,
        hasReport: true,
        workerCompletedAt: now,
      }
    );

    console.log(`[Worker] Run ${run.id} completed successfully`);

  } catch (err: any) {
    console.error(`[Worker] ==============================`);
    console.error(`[Worker] processRun EXCEPTION for ${run.id}`);
    console.error(`[Worker] Error: ${err.message}`);
    console.error(`[Worker] Stack: ${err.stack}`);
    console.error(`[Worker] ==============================`);

    const errorCategory = getErrorCategory(err, "process-run");
    const retryable = isRetryableError(err);

    await markRunFailed(
      run.id,
      err.message || "Unknown error",
      errorCategory,
      retryable
    );
  } finally {
    stopHeartbeat();
  }
}
