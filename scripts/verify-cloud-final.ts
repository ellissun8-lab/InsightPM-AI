/**
 * ProofLoop Cloud Final Verification
 * 运行: npx tsx scripts/verify-cloud-final.ts
 */

import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

// 强制加载环境变量（从文件手动解析）
function loadEnvVars() {
  const envFiles = [
    path.join(__dirname, "../apps/worker/.env"),
    path.join(__dirname, "../.env.local"),
  ];

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) continue;
    
    const content = fs.readFileSync(envFile, "utf-8");
    const lines = content.split("\n");
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;
      
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      
      if (key && value) {
        // 强制设置（覆盖已有值）
        process.env[key] = value;
      }
    }
  }
}

loadEnvVars();

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

function check(name: string, condition: boolean, passMsg: string, failMsg: string): CheckResult {
  return { name, status: condition ? "pass" : "fail", message: condition ? passMsg : failMsg };
}

function resolvePythonCommand(): string {
  const envBin = process.env.PYTHON_BIN;
  if (envBin) {
    try {
      execSync(`${envBin} --version`, { stdio: "pipe" });
      return envBin;
    } catch {}
  }
  try {
    execSync("python3 --version", { stdio: "pipe" });
    return "python3";
  } catch {}
  try {
    execSync("python --version", { stdio: "pipe" });
    return "python";
  } catch {}
  if (process.platform === "win32") {
    try {
      execSync("py -3 --version", { stdio: "pipe" });
      return "py -3";
    } catch {}
  }
  throw new Error("Python runtime not found. Set PYTHON_BIN or install python3.");
}

async function main() {
  console.log("=".repeat(60));
  console.log("ProofLoop Cloud Final Verification");
  console.log("=".repeat(60));
  console.log("");

  const checks: CheckResult[] = [];

  // 1. Supabase 配置
  checks.push(check("SUPABASE_URL", !!process.env.SUPABASE_URL, "configured", "NOT SET"));
  checks.push(check("SUPABASE_SERVICE_ROLE_KEY", !!process.env.SUPABASE_SERVICE_ROLE_KEY, "configured", "NOT SET"));

  // 2. AI 配置
  checks.push(check("AI_PROVIDER", !!process.env.AI_PROVIDER, process.env.AI_PROVIDER || "configured", "NOT SET"));
  checks.push(check("OPENAI_API_KEY", !!process.env.OPENAI_API_KEY, "configured", "NOT SET"));
  checks.push(check("OPENAI_BASE_URL", !!process.env.OPENAI_BASE_URL, process.env.OPENAI_BASE_URL || "configured", "NOT SET"));
  checks.push(check("OPENAI_MODEL", !!process.env.OPENAI_MODEL, process.env.OPENAI_MODEL || "configured", "NOT SET"));

  // 3. DeepSeek 配置
  checks.push(check("DEEPSEEK_API_KEY", !!process.env.DEESEEK_API_KEY, "configured", "NOT SET"));
  checks.push(check("DEEPSEEK_BASE_URL", !!process.env.DEESEEK_BASE_URL, process.env.DEESEEK_BASE_URL || "configured", "NOT SET"));
  checks.push(check("DEEPSEEK_VALIDATION_MODEL", !!process.env.DEESEEK_VALIDATION_MODEL, process.env.DEESEEK_VALIDATION_MODEL || "configured", "NOT SET"));

  // 4. Storage Mode
  const storageMode = process.env.PROOFLOOP_STORAGE_MODE || "local";
  checks.push({ name: "PROOFLOOP_STORAGE_MODE", status: storageMode === "cloud" ? "pass" : "warn", message: storageMode });

  // 5. Python command
  try {
    const pythonCmd = resolvePythonCommand();
    checks.push({ name: "Python command", status: "pass", message: pythonCmd });
  } catch (err: any) {
    checks.push({ name: "Python command", status: "fail", message: err.message });
  }

  // 6. TypeScript 语法检查
  try {
    execSync("npx tsc --noEmit scripts/lib/ai-analysis-generator.ts", { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    checks.push({ name: "TypeScript syntax", status: "pass", message: "ai-analysis-generator.ts OK" });
  } catch {
    checks.push({ name: "TypeScript syntax", status: "fail", message: "ai-analysis-generator.ts has errors" });
  }

  // 7. Build 检查
  try {
    execSync("cd apps/web && npm run build", { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    checks.push({ name: "Build", status: "pass", message: "npm run build OK" });
  } catch {
    checks.push({ name: "Build", status: "fail", message: "npm run build failed" });
  }

  // 输出结果
  let passCount = 0, failCount = 0, warnCount = 0;
  for (const c of checks) {
    const icon = c.status === "pass" ? "✅" : c.status === "fail" ? "❌" : "⚠️";
    console.log(`${icon} ${c.name}: ${c.message}`);
    if (c.status === "pass") passCount++;
    else if (c.status === "fail") failCount++;
    else warnCount++;
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Summary: ${passCount} pass, ${failCount} fail, ${warnCount} warn`);
  console.log("=".repeat(60));

  if (failCount > 0) {
    console.log("\n❌ Cloud Final Verification FAILED");
    process.exit(1);
  } else {
    console.log("\n✅ Cloud Final Verification PASSED");
    process.exit(0);
  }
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
