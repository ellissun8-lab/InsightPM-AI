import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");

export interface PipelineResult {
  success: boolean;
  stdout: string;
  stderr: string;
  outputDir: string;
  summary: any | null;
  hardScore: number | null;
  semanticScore: number | null;
  evidenceBroken: number | null;
  durationMs: number | null;
}

/**
 * 执行真实 pipeline
 */
export async function runPipeline(
  caseName: string,
  dataset: string,
  feedbackCount: number,
  inputPath: string,
  outputDir: string
): Promise<PipelineResult> {
  const scriptPath = path.join(PROJECT_ROOT, "scripts", "run-pipeline.ts");

  // 确保输出目录存在
  fs.mkdirSync(outputDir, { recursive: true });

  const cmd = [
    "npx tsx",
    `"${scriptPath}"`,
    `--case "${caseName}"`,
    `--dataset "${dataset}"`,
    `--count ${feedbackCount}`,
    `--input "${inputPath}"`,
    `--output "${outputDir}"`,
  ].join(" ");

  console.log(`[PipelineRunner] Executing: ${cmd}`);
  console.log(`[PipelineRunner] Project root: ${PROJECT_ROOT}`);

  let stdout = "";
  let stderr = "";

  try {
    stdout = execSync(cmd, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 600000, // 10 minutes
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        // 确保 Node.js 能找到 tsx
        PATH: `${path.join(PROJECT_ROOT, "node_modules/.bin")}:${process.env.PATH}`,
      },
    });
  } catch (err: any) {
    stderr = err.stderr || "";
    stdout = err.stdout || "";
    console.error(`[PipelineRunner] Pipeline failed:`, err.message);

    return {
      success: false,
      stdout: stdout.slice(-2000),
      stderr: stderr.slice(-2000),
      outputDir,
      summary: null,
      hardScore: null,
      semanticScore: null,
      evidenceBroken: null,
      durationMs: null,
    };
  }

  console.log(`[PipelineRunner] Pipeline completed successfully`);

  // 尝试读取 run-summary.json
  const summaryPath = path.join(outputDir, "run-summary.json");
  let summary: any = null;

  if (fs.existsSync(summaryPath)) {
    console.log(`[PipelineRunner] Found run-summary.json`);
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    } catch (err) {
      console.error(`[PipelineRunner] Failed to parse run-summary.json:`, err);
    }
  } else {
    console.log(`[PipelineRunner] run-summary.json not found`);
  }

  // 从 summary 中提取分数
  const hardScore = summary?.hardValidation?.score ?? summary?.hard_score ?? null;
  const semanticScore = summary?.semanticValidation?.score ?? summary?.semantic_score ?? null;
  const evidenceBroken = summary?.semanticValidation?.evidenceBroken ?? summary?.evidence_broken ?? 0;
  const durationMs = summary?.durationMs ?? summary?.duration_ms ?? null;

  return {
    success: true,
    stdout: stdout.slice(-2000),
    stderr: stderr.slice(-2000),
    outputDir,
    summary,
    hardScore,
    semanticScore,
    evidenceBroken,
    durationMs,
  };
}
