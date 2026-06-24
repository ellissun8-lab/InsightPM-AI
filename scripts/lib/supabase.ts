/**
 * 验证脚本专用的 Supabase 客户端
 * 使用 service_role key 以绕过 RLS
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ 缺少 Supabase 环境变量");
  console.error("请确保 .env.local 中配置了:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL");
  console.error("  SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// After the check above, we know these are defined
const validatedUrl = supabaseUrl!;
const validatedKey = supabaseServiceKey!;

export function createValidationClient() {
  return createSupabaseClient(validatedUrl, validatedKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * 创建测试用户（如果不存在）
 */
export async function getOrCreateTestUser(): Promise<string> {
  const supabase = createValidationClient();
  const testEmail = "validation-test@insightpm.ai";
  const testPassword = "validation-test-password-123";

  // Try to sign in first
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

  if (signInData.user) {
    return signInData.user.id;
  }

  // Create new user
  const { data: signUpData, error: signUpError } =
    await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

  if (signUpError) {
    throw new Error(`创建测试用户失败: ${signUpError.message}`);
  }

  return signUpData.user.id;
}

/**
 * 清理测试数据
 */
export async function cleanupTestData(userId: string): Promise<void> {
  const supabase = createValidationClient();

  console.log("   🧹 清理测试数据...");

  // Delete in order (respecting foreign key constraints)
  await supabase.from("reports").delete().eq("owner_id", userId);
  await supabase.from("issue_clusters").delete().eq("owner_id", userId);
  await supabase.from("analysis_runs").delete().eq("owner_id", userId);
  await supabase.from("feedback_items").delete().eq("owner_id", userId);
  await supabase.from("feedback_batches").delete().eq("owner_id", userId);
  await supabase.from("projects").delete().eq("owner_id", userId);
}
