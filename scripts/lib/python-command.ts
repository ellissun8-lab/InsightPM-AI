import { execSync } from "child_process";

/**
 * 解析 Python 命令
 * 优先级：PYTHON_BIN > python3 > python > py -3
 */
export function resolvePythonCommand(): string {
  // 1. 环境变量
  const envBin = process.env.PYTHON_BIN;
  if (envBin) {
    try {
      execSync(`${envBin} --version`, { stdio: "pipe" });
      console.log(`[Python] Using PYTHON_BIN: ${envBin}`);
      return envBin;
    } catch {
      console.warn(`[Python] PYTHON_BIN="${envBin}" not found, trying fallbacks...`);
    }
  }

  // 2. python3
  try {
    execSync("python3 --version", { stdio: "pipe" });
    console.log(`[Python] Using: python3`);
    return "python3";
  } catch {}

  // 3. python
  try {
    execSync("python --version", { stdio: "pipe" });
    console.log(`[Python] Using: python`);
    return "python";
  } catch {}

  // 4. Windows: py -3
  if (process.platform === "win32") {
    try {
      execSync("py -3 --version", { stdio: "pipe" });
      console.log(`[Python] Using: py -3`);
      return "py -3";
    } catch {}
  }

  throw new Error(
    "Python runtime not found. Set PYTHON_BIN environment variable or install python3."
  );
}
