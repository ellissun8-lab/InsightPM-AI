/**
 * ProofLoop Cloud Worker 自检脚本
 * 运行: npx tsx scripts/verify-cloud-worker-ready.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

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

function checkOptional(name: string, value: string | undefined, desc: string): CheckResult {
  return { name, status: value ? "pass" : "warn", message: value ? `${desc}: configured` : `${desc}: NOT SET (optional)` };
}

async function main() {
  console.log("=".repeat(60));
  console.log("ProofLoop Cloud Worker Readiness Check");
  console.log("=".repeat(60));
  console.log("");

  const checks: CheckResult[] = [];

  checks.push(check("SUPABASE_URL", !!process.env.SUPABASE_URL, "Supabase URL configured", "SUPABASE_URL is NOT SET"));
  checks.push(check("SUPABASE_SERVICE_ROLE_KEY", !!process.env.SUPABASE_SERVICE_ROLE_KEY, "Service Role Key configured", "SUPABASE_SERVICE_ROLE_KEY is NOT SET"));
  checks.push(check("AI_PROVIDER", !!process.env.AI_PROVIDER, `AI Provider: ${process.env.AI_PROVIDER}`, "AI_PROVIDER is NOT SET"));
  checks.push(check("OPENAI_API_KEY", !!process.env.OPENAI_API_KEY, "OpenAI API Key configured", "OPENAI_API_KEY is NOT SET"));
  checks.push(check("OPENAI_BASE_URL", !!process.env.OPENAI_BASE_URL, `OpenAI Base URL: ${process.env.OPENAI_BASE_URL}`, "OPENAI_BASE_URL is NOT SET"));
  checks.push(check("OPENAI_MODEL", !!process.env.OPENAI_MODEL, `OpenAI Model: ${process.env.OPENAI_MODEL}`, "OPENAI_MODEL is NOT SET"));
  checks.push(checkOptional("DEEPSEEK_API_KEY", process.env.DEESEEK_API_KEY, "DeepSeek API Key"));
  checks.push(checkOptional("DEEPSEEK_BASE_URL", process.env.DEESEEK_BASE_URL, "DeepSeek Base URL"));
  checks.push(checkOptional("DEEPSEEK_VALIDATION_MODEL", process.env.DEESEEK_VALIDATION_MODEL, "DeepSeek Validation Model"));

  const storageMode = process.env.PROOFLOOP_STORAGE_MODE || "local";
  checks.push(check("PROOFLOOP_STORAGE_MODE", storageMode === "cloud", `Storage Mode: ${storageMode}`, `Storage Mode is "${storageMode}", should be "cloud"`));

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
    console.log("\n❌ Cloud Worker is NOT ready.");
    process.exit(1);
  } else {
    console.log("\n✅ Cloud Worker is ready!");
    process.exit(0);
  }
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
