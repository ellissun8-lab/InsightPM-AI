import { type RunRecord, updateRunStatus, markRunCompleted, markRunFailed } from "./supabase.js";
import { runPipeline } from "./pipeline-runner.js";
import { discoverArtifacts, uploadAndRecordArtifacts } from "./artifacts.js";
import { downloadFromStorage } from "./storage-downloader.js";
import { startHeartbeat, updateHeartbeat, stopHeartbeat } from "./heartbeat.js";
import * as path from "path";
import * as os from "os";

const WORKER_TMP_DIR = process.env.WORKER_TMP_DIR || path.join(os.tmpdir(), "proofloop-worker");

/**
 * 根据 stdout/stderr 分类错误
 *
 * 优先级：validation（summary 优先） > network > training > artifact > ai > unknown
 * summary 区域格式: "Semantic Validation: fail" / "Hard Validation: fail"
 * 步骤日志格式:   "[step] hard_validation" + "FAIL"
 */
function classifyError(stdout: string, stderr: string, message: string): { category: string; retryable: boolean } {
  const combined = `${stdout} ${stderr} ${message}`.toLowerCase();

  // ---- 1. Validation 失败（最高优先级） ----

  // semantic_validation: summary "Semantic Validation: fail" 或步骤日志 "[step] semantic_validation ... FAIL"
  if (
    (combined.includes("semantic validation") && combined.includes("fail")) ||
    (combined.includes("semantic_validation") && combined.includes("fail"))
  ) {
    return { category: "semantic_validation", retryable: false };
  }

  // hard_validation: summary "Hard Validation: fail" 或步骤日志 "[step] hard_validation ... FAIL"
  // 注意："Hard Validation: warning" 不包含 "fail"，不会命中
  if (
    (combined.includes("hard validation") && combined.includes("fail")) ||
    (combined.includes("hard_validation") && combined.includes("fail"))
  ) {
    return { category: "hard_validation", retryable: false };
  }

  // ---- 2. 网络错误 ----

  if (combined.includes("econnreset") || combined.includes("etimedout") || combined.includes("fetch failed") || combined.includes("timeout")) {
    return { category: "network", retryable: true };
  }

  if (combined.match(/\b5\d{2}\b/) || combined.includes("500") || combined.includes("502") || combined.includes("503") || combined.includes("504")) {
    return { category: "network", retryable: true };
  }

  // ---- 3. training/promote ----

  if (combined.includes("promote_to_training") || combined.includes("dataset_index_update")) {
    return { category: "training_data", retryable: false };
  }

  // ---- 4. artifact 写入 ----

  if (combined.includes("artifact")) {
    return { category: "artifact_write", retryable: true };
  }

  // ---- 5. AI 生成 ----

  if (combined.includes("ai_analysis") || combined.includes("ai generation")) {
    return { category: "ai_generation", retryable: true };
  }

  // ---- 6. 兜底 ----

  return { category: "unknown", retryable: false };
}

/**
 * 失败落库 - 通过 RPC 调用 mark_run_failed
 */
async function handleFailure(
  run: RunRecord,
  errorInfo: {
    message: string;
    category: string;
    retryable: boolean;
    stdoutPreview?: string;
    stderrPreview?: string;
    command?: string;
    inputPath?: string;
    outputDir?: string;
    workerStep?: string;
    exitCode?: number | null;
    signal?: string | null;
  }
) {
  const now = new Date().toISOString();

  const errorPayload = {
    message: errorInfo.message,
    category: errorInfo.category,
    retryable: errorInfo.retryable,
    failedAt: now,
    workerStep: errorInfo.workerStep || "unknown",
    source: "railway-worker",
    stdoutPreview: errorInfo.stdoutPreview?.slice(0, 2000) || null,
    stderrPreview: errorInfo.stderrPreview?.slice(0, 2000) || null,
    command: errorInfo.command || null,
    inputPath: errorInfo.inputPath || null,
    outputDir: errorInfo.outputDir || null,
    exitCode: errorInfo.exitCode ?? null,
    signal: errorInfo.signal ?? null,
  };

  const retryCount = run.metadata?.retry_count || 0;
  const maxRetry = run.metadata?.max_retry || 2;
  const retryable = errorInfo.retryable && retryCount < maxRetry;

  if (retryable) {
    console.log(`[Worker] Retrying run ${run.id} (retry ${retryCount + 1}/${maxRetry})`);
  } else {
    console.log(`[Worker] Marking run ${run.id} as failed (non-retryable or max retries reached)`);
  }

  const ok = await markRunFailed(run.id, errorPayload, retryable);
  if (!ok) {
    console.error(`[Worker] markRunFailed RPC failed for run ${run.id}`);
  }
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
      await handleFailure(run, {
        message: "Missing inputFile metadata",
        category: "storage",
        retryable: false,
        workerStep: "check-input-file",
      });
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
      await handleFailure(run, {
        message: downloadResult.error?.message || "Failed to download CSV",
        category: "storage",
        retryable: true,
        workerStep: "download-csv",
      });
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

      // 分类错误
      const { category, retryable } = classifyError(
        pipelineResult.stdout || "",
        pipelineResult.stderr || "",
        pipelineResult.error?.message || ""
      );

      await handleFailure(run, {
        message: pipelineResult.error?.message || "Pipeline execution failed",
        category,
        retryable,
        stdoutPreview: pipelineResult.stdout,
        stderrPreview: pipelineResult.stderr,
        command: pipelineResult.error?.command,
        inputPath: localInputPath,
        outputDir,
        workerStep: "execute-pipeline",
      });
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
      await handleFailure(run, {
        message: artifactResult.error || "Artifact upload failed",
        category: "artifact_write",
        retryable: true,
        workerStep: "upload-artifacts",
      });
      stopHeartbeat();
      return;
    }

    console.log(`[Worker] Artifacts written: ${artifactResult.artifactTypes.join(", ")}`);

    // Step 6: 标记完成
    const completedMetadata = {
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
      // 清理错误信息
      error: null,
      failedAt: null,
    };

    await markRunCompleted(
      run.id,
      pipelineResult.hardScore ?? undefined,
      pipelineResult.semanticScore ?? undefined,
      pipelineResult.evidenceBroken ?? undefined,
      completedMetadata
    );

    console.log(`[Worker] Run ${run.id} completed successfully`);

  } catch (err: any) {
    console.error(`[Worker] ==============================`);
    console.error(`[Worker] processRun EXCEPTION for ${run.id}`);
    console.error(`[Worker] Error: ${err.message}`);
    console.error(`[Worker] Stack: ${err.stack}`);
    console.error(`[Worker] Exit code: ${err.status}`);
    console.error(`[Worker] Signal: ${err.signal}`);
    console.error(`[Worker] ==============================`);

    const { category, retryable } = classifyError(
      err.stdout || "",
      err.stderr || "",
      err.message || ""
    );

    await handleFailure(run, {
      message: err.message || "Unknown error",
      category,
      retryable,
      stdoutPreview: err.stdout?.toString(),
      stderrPreview: err.stderr?.toString(),
      command: err.cmd,
      inputPath: path.join(WORKER_TMP_DIR, run.id, "input.csv"),
      outputDir: path.join(WORKER_TMP_DIR, run.id, "output"),
      workerStep: "process-run-exception",
      exitCode: err.status ?? null,
      signal: err.signal ?? null,
    });
  } finally {
    stopHeartbeat();
  }
}
