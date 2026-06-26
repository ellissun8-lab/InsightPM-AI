/**
 * ProofLoop Cloud Final Verification
 * 运行: npx tsx scripts/verify-cloud-final.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { execSync } from "child_process";

dotenv.config({ path: path.join(__dirname, "../apps/worker/.env") });
dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

function check(name: string, condition: boolean, passMsg: string, failMsg: string): CheckResult {
  return { name, status: condition ? "pass" : "fail", message: condition ? passMsg : failMsg };
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

  // 3. Storage Mode
  const storageMode = process.env.PROOFLOOP_STORAGE_MODE || "local";
  checks.push({ name: "PROOFLOOP_STORAGE_MODE", status: storageMode === "cloud" ? "pass" : "warn", message: storageMode });

  // 4. TypeScript 语法检查
  try {
    execSync("npx tsc --noEmit scripts/lib/ai-analysis-generator.ts", { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    checks.push({ name: "TypeScript syntax", status: "pass", message: "ai-analysis-generator.ts OK" });
  } catch {
    checks.push({ name: "TypeScript syntax", status: "fail", message: "ai-analysis-generator.ts has errors" });
  }

  // 5. Build 检查
  try {
    execSync("cd apps/web && npm run build", { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    checks.push({ name: "Build", status: "pass", message: "npm run build OK" });
  } catch {
    checks.push({ name: "Build", status: "fail", message: "npm run build failed" });
  }

  // 输出结果
  let passCount = 0, failCount = 0;
  for (const c of checks) {
    const icon = c.status === "pass" ? "✅" : c.status === "fail" ? "❌" : "⚠️";
    console.log(`${icon} ${c.name}: ${c.message}`);
    if (c.status === "pass") passCount++;
    else if (c.status === "fail") failCount++;
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Summary: ${passCount} pass, ${failCount} fail`);
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
