import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// 计算仓库根目录
// 在 apps/worker/src/ 下，需要向上 3 级到 insightpm-ai/
const WORKER_DIR = path.resolve(import.meta.dirname, "..");
const PROJECT_ROOT = path.resolve(WORKER_DIR, "../..");

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
  error?: {
    message: string;
    command: string;
    cwd: string;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    stack: string;
    nodeVersion: string;
    inputPath: string;
    outputDir: string;
    envPresence: Record<string, boolean>;
  };
}

/**
 * 检查环境变量是否存在（不打印值）
 */
function checkEnvPresence(): Record<string, boolean> {
  return {
    AI_PROVIDER: !!process.env.AI_PROVIDER,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: !!process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: !!process.env.OPENAI_MODEL,
    DEEPSEEK_API_KEY: !!process.env.DEESEEK_API_KEY,
    DEEPSEEK_BASE_URL: !!process.env.DEESEEK_BASE_URL,
    DEEPSEEK_VALIDATION_MODEL: !!process.env.DEESEEK_VALIDATION_MODEL,
  };
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
  const nodeVersion = process.version;
  const envPresence = checkEnvPresence();

  console.log(`[PipelineRunner] ==============================`);
  console.log(`[PipelineRunner] Pipeline Execution Start`);
  console.log(`[PipelineRunner] ==============================`);
  console.log(`[PipelineRunner] PROJECT_ROOT: ${PROJECT_ROOT}`);
  console.log(`[PipelineRunner] scriptPath: ${scriptPath}`);
  console.log(`[PipelineRunner] scriptExists: ${fs.existsSync(scriptPath)}`);
  console.log(`[PipelineRunner] inputPath: ${inputPath}`);
  console.log(`[PipelineRunner] inputExists: ${fs.existsSync(inputPath)}`);
  console.log(`[PipelineRunner] outputDir: ${outputDir}`);
  console.log(`[PipelineRunner] nodeVersion: ${nodeVersion}`);
  console.log(`[PipelineRunner] platform: ${os.platform()}`);
  console.log(`[PipelineRunner] envPresence:`, JSON.stringify(envPresence));

  // 确保输出目录存在
  fs.mkdirSync(outputDir, { recursive: true });

  // 构建命令 - Windows 兼容
  const isWindows = os.platform() === "win32";
  const npxCmd = isWindows ? "npx.cmd" : "npx";

  const cmd = [
    npxCmd,
    "tsx",
    scriptPath,
    "--case", caseName,
    "--dataset", dataset,
    "--count", String(feedbackCount),
    "--input", inputPath,
    "--output", outputDir,
  ];

  const cmdString = cmd.join(" ");

  console.log(`[PipelineRunner] Command: ${cmdString}`);
  console.log(`[PipelineRunner] CWD: ${PROJECT_ROOT}`);
  console.log(`[PipelineRunner] ==============================`);

  let stdout = "";
  let stderr = "";

  try {
    stdout = execSync(cmdString, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 600000, // 10 minutes
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        // 确保 Node.js 能找到 tsx
        PATH: `${path.join(PROJECT_ROOT, "node_modules/.bin")}${isWindows ? ";" : ":"}${process.env.PATH}`,
      },
      windowsHide: true,
    });

    console.log(`[PipelineRunner] ==============================`);
    console.log(`[PipelineRunner] Pipeline Completed Successfully`);
    console.log(`[PipelineRunner] ==============================`);
    console.log(`[PipelineRunner] stdout preview: ${stdout.slice(0, 500)}`);
    if (stderr) {
      console.log(`[PipelineRunner] stderr preview: ${stderr.slice(0, 500)}`);
    }

  } catch (err: any) {
    stderr = err.stderr || "";
    stdout = err.stdout || "";

    console.error(`[PipelineRunner] ==============================`);
    console.error(`[PipelineRunner] Pipeline FAILED`);
    console.error(`[PipelineRunner] ==============================`);
    console.error(`[PipelineRunner] Error: ${err.message}`);
    console.error(`[PipelineRunner] Exit code: ${err.status}`);
    console.error(`[PipelineRunner] stdout preview: ${stdout.slice(0, 1000)}`);
    console.error(`[PipelineRunner] stderr preview: ${stderr.slice(0, 1000)}`);

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
      error: {
        message: `Pipeline execution failed: ${err.message}`,
        command: cmdString,
        cwd: PROJECT_ROOT,
        exitCode: err.status || null,
        stdout: stdout.slice(-2000),
        stderr: stderr.slice(-2000),
        stack: err.stack || "",
        nodeVersion,
        inputPath,
        outputDir,
        envPresence,
      },
    };
  }

  // 尝试读取 run-summary.json
  const summaryPath = path.join(outputDir, "run-summary.json");
  let summary: any = null;

  if (fs.existsSync(summaryPath)) {
    console.log(`[PipelineRunner] Found run-summary.json at: ${summaryPath}`);
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
      console.log(`[PipelineRunner] Summary keys: ${Object.keys(summary).join(", ")}`);
    } catch (err) {
      console.error(`[PipelineRunner] Failed to parse run-summary.json:`, err);
    }
  } else {
    console.log(`[PipelineRunner] run-summary.json NOT found at: ${summaryPath}`);
    // 列出 outputDir 内容
    try {
      const files = fs.readdirSync(outputDir);
      console.log(`[PipelineRunner] Output dir contents: ${files.join(", ")}`);
    } catch {}
  }

  // 从 summary 中提取分数
  const hardScore = summary?.hardValidation?.score ?? summary?.hard_score ?? null;
  const semanticScore = summary?.semanticValidation?.score ?? summary?.semantic_score ?? null;
  const evidenceBroken = summary?.semanticValidation?.evidenceBroken ?? summary?.evidence_broken ?? 0;
  const durationMs = summary?.durationMs ?? summary?.duration_ms ?? null;

  console.log(`[PipelineRunner] Extracted scores:`);
  console.log(`[PipelineRunner]   hardScore: ${hardScore}`);
  console.log(`[PipelineRunner]   semanticScore: ${semanticScore}`);
  console.log(`[PipelineRunner]   evidenceBroken: ${evidenceBroken}`);
  console.log(`[PipelineRunner]   durationMs: ${durationMs}`);

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
