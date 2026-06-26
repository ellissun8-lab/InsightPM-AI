import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

/**
 * Supabase client for Worker
 * Uses service role key to bypass RLS
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create admin client (alias for supabase, for compatibility)
 */
export function createAdminClient() {
  return supabase;
}

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
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Error fetching pending runs:", error);
    return [];
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
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (metadata) {
    updateData.metadata = metadata;
  }

  const { error } = await supabase
    .from("runs")
    .update(updateData)
    .eq("id", runId);

  if (error) {
    console.error(`Error updating run ${runId} status:`, error);
    return false;
  }

  return true;
}
