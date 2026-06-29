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
 * 原子抽数 - 使用 Supabase RPC
 */
export async function claimNextRun(workerId: string): Promise<RunRecord | null> {
  const client = getSupabaseClient();
  console.log(`[Supabase] Claiming next run for worker: ${workerId}`);

  const { data, error } = await client.rpc("claim_next_run", {
    worker_id: workerId,
  });

  if (error) {
    console.error("[Supabase] Error claiming run:", error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log("[Supabase] No pending or stale runs found");
    return null;
  }

  console.log(`[Supabase] Claimed run: ${data[0].run_id} - ${data[0].case_name}`);
  return data[0] as RunRecord;
}

/**
 * 更新 heartbeat
 */
export async function updateHeartbeat(
  runId: string,
  workerStep: string
): Promise<boolean> {
  const client = getSupabaseClient();

  const { error } = await client.rpc("update_run_heartbeat", {
    run_id: runId,
    worker_step: workerStep,
  });

  if (error) {
    console.warn(`[Supabase] Heartbeat update failed:`, error.message);
    return false;
  }

  return true;
}

/**
 * 标记 run 完成
 */
export async function markRunCompleted(
  runId: string,
  hardScore?: number,
  semanticScore?: number,
  evidenceBroken?: number,
  metadata?: Record<string, any>
): Promise<boolean> {
  const client = getSupabaseClient();

  const { error } = await client.rpc("mark_run_completed", {
    run_id: runId,
    p_hard_score: hardScore ?? null,
    p_semantic_score: semanticScore ?? null,
    p_evidence_broken: evidenceBroken ?? null,
    p_metadata: metadata ?? null,
  });

  if (error) {
    console.error(`[Supabase] Mark run completed failed:`, error);
    return false;
  }

  return true;
}

/**
 * 标记 run 失败
 */
export async function markRunFailed(
  runId: string,
  errorMessage: string,
  errorCategory: string = "unknown",
  retryable: boolean = false
): Promise<boolean> {
  const client = getSupabaseClient();

  const { error } = await client.rpc("mark_run_failed", {
    run_id: runId,
    error_message: errorMessage,
    error_category: errorCategory,
    retryable,
  });

  if (error) {
    console.error(`[Supabase] Mark run failed:`, error);
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
