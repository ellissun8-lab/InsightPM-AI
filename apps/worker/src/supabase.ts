import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端（延迟初始化）
 */
export function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  _supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabase;
}

/**
 * Supabase client for Worker (兼容旧代码)
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    return (client as any)[prop];
  },
});

export interface RunRecord {
  id: string;
  case_name: string;
  scenario: string | null;
  status: string;
  feedback_count: number;
  hard_score: number | null;
  semantic_score: number | null;
  evidence_broken: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

/**
 * 查询 pending runs
 */
export async function getPendingRuns(): Promise<RunRecord[]> {
  const client = getSupabaseClient();
  console.log("[Supabase] Querying pending runs...");

  const { data, error } = await client
    .from("runs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("[Supabase] Error fetching pending runs:", error);
    return [];
  }

  console.log(`[Supabase] Found ${data?.length || 0} pending runs`);
  if (data && data.length > 0) {
    console.log(`[Supabase] First pending run: ${data[0].id} - ${data[0].case_name}`);
  }

  return data || [];
}

/**
 * 更新 run 状态
 */
export async function updateRunStatus(
  runId: string,
  status: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  const client = getSupabaseClient();
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (metadata) {
    updateData.metadata = metadata;
  }

  const { error } = await client
    .from("runs")
    .update(updateData)
    .eq("id", runId);

  if (error) {
    console.error(`Error updating run ${runId} status:`, error);
    return false;
  }

  return true;
}

/**
 * Create admin client (alias for compatibility)
 */
export function createAdminClient() {
  return getSupabaseClient();
}
