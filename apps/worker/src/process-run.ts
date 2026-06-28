import { type RunRecord, updateRunStatus, supabase } from "./supabase.js";
import { runPipeline } from "./pipeline-runner.js";
import { discoverArtifacts, uploadAndRecordArtifacts } from "./artifacts.js";
import { downloadFromStorage } from "./storage-downloader.js";
import * as path from "path";
import * as os from "os";

const WORKER_TMP_DIR = process.env.WORKER_TMP_DIR || path.join(os.tmpdir(), "proofloop-worker");

/**
 * 处理单个 run
 */
export async function processRun(run: RunRecord, loadedVars?: Record<string, string>): Promise<void> {
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
    workerStep: "pipeline-and-artifacts",
    workerStartedAt: now,
  };

  const runningOk = await updateRunStatus(run.id, "running", runningMetadata);
  if (!runningOk) {
    console.error(`[Worker] failed to update run ${run.id} to running`);
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

    // Step 3: 下载 CSV（使用改进的下载逻辑）
    console.log(`[Worker] Downloading input CSV...`);
    const localDir = path.join(WORKER_TMP_DIR, run.id);

    const downloadResult = await downloadFromStorage(
      inputFile.bucket,
      inputFile.path,
      localDir,
      inputFile.originalName || "input.csv"
    );

    if (!downloadResult.success) {
      console.error(`[Worker] Failed to download CSV:`, downloadResult.error);
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        error: downloadResult.error,
        failedAt: now,
      });
      return;
    }

    const localInputPath = downloadResult.localPath!;
    console.log(`[Worker] Download successful: ${localInputPath}`);
    console.log(`[Worker] File size: ${downloadResult.fileSize} bytes`);

    // Step 4: 执行真实 pipeline
    const outputDir = path.join(WORKER_TMP_DIR, run.id, "output");
    const dataset = run.scenario || run.metadata?.dataset || "mixed-feedback";
    const feedbackCount = run.feedback_count || run.metadata?.feedbackCount || 0;

    console.log(`[Worker] Starting pipeline execution...`);
    console.log(`[Worker]   caseName: ${run.case_name}`);
    console.log(`[Worker]   dataset: ${dataset}`);
    console.log(`[Worker]   feedbackCount: ${feedbackCount}`);
    console.log(`[Worker]   inputPath: ${localInputPath}`);
    console.log(`[Worker]   outputDir: ${outputDir}`);

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
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        inputDownloaded: true,
        localInputPath,
        pipelineExecuted: false,
        pipelineStdoutPreview: pipelineResult.stdout,
        pipelineStderrPreview: pipelineResult.stderr,
        error: pipelineResult.error || {
          message: "Pipeline execution failed",
          stderr: pipelineResult.stderr,
        },
        failedAt: new Date().toISOString(),
      });
      return;
    }

    console.log(`[Worker] Pipeline completed successfully`);
    console.log(`[Worker] Output dir: ${pipelineResult.outputDir}`);
    console.log(`[Worker] Hard score: ${pipelineResult.hardScore}`);
    console.log(`[Worker] Semantic score: ${pipelineResult.semanticScore}`);

    // Step 5: 发现并上传 artifacts
    const artifacts = discoverArtifacts(outputDir, run.case_name);

    const artifactResult = await uploadAndRecordArtifacts(
      run.id,
      run.case_name,
      artifacts
    );

    if (!artifactResult.success) {
      console.error(`[Worker] Artifact upload failed: ${artifactResult.error}`);
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        inputDownloaded: true,
        localInputPath,
        pipelineExecuted: true,
        pipelineOutputDir: outputDir,
        pipelineStdoutPreview: pipelineResult.stdout,
        pipelineStderrPreview: pipelineResult.stderr,
        error: { message: artifactResult.error || "Artifact upload failed" },
        failedAt: new Date().toISOString(),
      });
      return;
    }

    console.log(`[Worker] Artifacts written: ${artifactResult.artifactTypes.join(", ")}`);

    // Step 6: 更新 run 为 completed
    const completedNow = new Date().toISOString();
    const completedMetadata = {
      ...runningMetadata,
      inputDownloaded: true,
      localInputPath,
      pipelineExecuted: true,
      pipelineOutputDir: outputDir,
      pipelineStdoutPreview: pipelineResult.stdout,
      pipelineStderrPreview: pipelineResult.stderr,
      hasReport: true,
      artifactWritten: true,
      artifactWrittenAt: completedNow,
      artifactTypes: artifactResult.artifactTypes,
      workerResult: "artifacts-written-ok",
      workerCompletedAt: completedNow,
    };

    // 构建更新数据
    const updateData: any = {
      status: "completed",
      finished_at: completedNow,
      updated_at: completedNow,
      metadata: completedMetadata,
    };

    // 只在有值时更新分数
    if (pipelineResult.hardScore !== null) {
      updateData.hard_score = pipelineResult.hardScore;
    }
    if (pipelineResult.semanticScore !== null) {
      updateData.semantic_score = pipelineResult.semanticScore;
    }
    if (pipelineResult.evidenceBroken !== null) {
      updateData.evidence_broken = pipelineResult.evidenceBroken;
    }
    if (pipelineResult.durationMs !== null) {
      if (pipelineResult.durationMs) completedMetadata.durationMs = pipelineResult.durationMs;
    }

    const { error: updateError } = await supabase
      .from("runs")
      .update(updateData)
      .eq("id", run.id);

    if (updateError) {
      console.error(`[Worker] failed to update run ${run.id}:`, updateError);
      await updateRunStatus(run.id, "failed", {
        ...runningMetadata,
        error: { message: `Failed to update run: ${updateError.message}` },
        failedAt: completedNow,
      });
      return;
    }

    console.log(`[Worker] Updated run ${run.id} to completed`);
    console.log(`[Worker] Run ${run.id} processing PASSED`);

  } catch (err: any) {
    const failedNow = new Date().toISOString();
    console.error(`[Worker] Error processing run ${run.id}:`, err.message);
    await updateRunStatus(run.id, "failed", {
      ...runningMetadata,
      error: { message: err.message, stack: err.stack },
      failedAt: failedNow,
    });
  }
}
