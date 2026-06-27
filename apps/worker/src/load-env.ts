import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

/**
 * 统一环境变量加载
 * 优先级：apps/worker/.env > 项目根目录 .env.local > 项目根目录 .env
 */
export function loadEnv(): void {
  console.log("[load-env] Starting environment variable loading...");
  console.log(`[load-env] process.cwd(): ${process.cwd()}`);

  // 按优先级加载 .env 文件
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env.local"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  let envLoaded = false;
  for (const envPath of envPaths) {
    const exists = fs.existsSync(envPath);
    console.log(`[load-env] ${envPath}: ${exists ? "exists" : "not found"}`);

    if (exists && !envLoaded) {
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
        if (!process.env[varName] || process.env[varName] === "") {
          const match = content.match(new RegExp(`^${varName}=(.+)$`, "m"));
          if (match) {
            process.env[varName] = match[1].trim();
          }
        }
      }

      // 再用 dotenv 加载其他变量
      dotenv.config({ path: envPath, override: false });
      console.log(`[load-env] Loaded env from: ${envPath}`);
      envLoaded = true;
    }
  }

  // 打印环境变量状态（不打印原文）
  console.log("[load-env] Environment check:");
  console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? "configured" : "NOT SET"}`);
  console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "NOT SET"}`);
  console.log(`  AI_PROVIDER: ${process.env.AI_PROVIDER || "NOT SET"}`);
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "configured" : "NOT SET"}`);
  console.log(`  OPENAI_BASE_URL: ${process.env.OPENAI_BASE_URL || "NOT SET"}`);
  console.log(`  OPENAI_MODEL: ${process.env.OPENAI_MODEL || "NOT SET"}`);
  console.log(`  VALIDATION_AI_PROVIDER: ${process.env.VALIDATION_AI_PROVIDER || "NOT SET"}`);
  console.log(`  DEEPSEEK_API_KEY: ${process.env.DEESEEK_API_KEY ? "configured" : "NOT SET"}`);
  console.log(`  DEEPSEEK_BASE_URL: ${process.env.DEESEEK_BASE_URL || "NOT SET"}`);
  console.log(`  DEEPSEEK_VALIDATION_MODEL: ${process.env.DEESEEK_VALIDATION_MODEL || "NOT SET"}`);
}
