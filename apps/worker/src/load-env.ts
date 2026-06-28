import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

/**
 * 统一环境变量加载
 * 优先级：apps/worker/.env > 项目根目录 .env.local > 项目根目录 .env
 */
export function loadEnv(): Record<string, string> {
  console.log("[load-env] Starting environment variable loading...");
  console.log(`[load-env] process.cwd(): ${process.cwd()}`);

  const loadedVars: Record<string, string> = {};

  // 按优先级加载 .env 文件（后面的文件不覆盖前面的）
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env.local"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  for (const envPath of envPaths) {
    const exists = fs.existsSync(envPath);
    console.log(`[load-env] ${envPath}: ${exists ? "exists" : "not found"}`);

    if (exists) {
      // 先手动解析关键变量（确保一定加载）
      const content = fs.readFileSync(envPath, "utf-8");
      const criticalVars = [
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "AI_PROVIDER",
        "OPENAI_API_KEY",
        "OPENAI_BASE_URL",
        "OPENAI_MODEL",
        "VALIDATION_AI_PROVIDER",
        "DEEPSEEK_API_KEY",
        "DEEPSEEK_BASE_URL",
        "DEEPSEEK_VALIDATION_MODEL",
      ];

      for (const varName of criticalVars) {
        if (!loadedVars[varName]) {
          const match = content.match(new RegExp(`^${varName}=(.+)$`, "m"));
          if (match) {
            const value = match[1].trim();
            loadedVars[varName] = value;
            process.env[varName] = value;
            console.log(`[load-env] Set ${varName}: ${value ? "configured" : "FAILED"}`);
          }
        }
      }

      // 再用 dotenv 加载其他变量（不覆盖已存在的）
      dotenv.config({ path: envPath, override: false });
      console.log(`[load-env] Loaded env from: ${envPath}`);
    }
  }

  // 打印环境变量状态（不打印原文）
  console.log("[load-env] Environment check:");
  const varsToCheck = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AI_PROVIDER",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_MODEL",
    "VALIDATION_AI_PROVIDER",
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_BASE_URL",
    "DEEPSEEK_VALIDATION_MODEL",
  ];

  for (const varName of varsToCheck) {
    const value = loadedVars[varName] || process.env[varName];
    console.log(`  ${varName}: ${value ? "configured" : "NOT SET"}`);
  }

  return loadedVars;
}
