import fs from "fs";
import path from "path";
import { isCloudMode } from "./storage-mode";

const ROOT = path.resolve(process.cwd(), "../..");

export interface RunRecord {
  case_name: string;
  dataset: string;
  count: number;
  status: string;
  validation: any;
  hardValidation: any;
  semanticValidation: any;
  timestamp: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  duration_ms: number | null;
}

/**
 * Get all runs from the current storage mode.
 * Returns data compatible with /api/runs response format.
 */
export async function getRuns(): Promise<RunRecord[]> {
  if (isCloudMode()) {
    return getRunsFromSupabase();
  }
  return getRunsFromLocal();
}

/**
 * Get a single run by case name
 */
export async function getRunByCaseName(
  caseName: string
): Promise<RunRecord | null> {
  if (isCloudMode()) {
    return getRunByCaseNameFromSupabase(caseName);
  }
  return getRunByCaseNameFromLocal(caseName);
}

/**
 * Create a new run record
 */
export async function createRun(input: {
  case_name: string;
  dataset?: string;
  count?: number;
  status?: string;
  workspace_id?: string;
  metadata?: Record<string, any>;
}): Promise<RunRecord | null> {
  if (isCloudMode()) {
    return createRunInSupabase(input);
  }
  // Local mode: runs are created by pipeline, not API
  return null;
}

/**
 * Update a run record
 */
export async function updateRun(
  caseName: string,
  input: Partial<RunRecord>
): Promise<boolean> {
  if (isCloudMode()) {
    return updateRunInSupabase(caseName, input);
  }
  // Local mode: runs are updated by pipeline, not API
  return false;
}

// ===========================================
// Local Mode Implementation
// ===========================================

function getRunsFromLocal(): RunRecord[] {
  const runsDir = path.join(ROOT, "runs");
  const runs: RunRecord[] = [];

  if (!fs.existsSync(runsDir)) return runs;

  for (const d of fs.readdirSync(runsDir)) {
    const summaryPath = path.join(runsDir, d, "run-summary.json");
    if (!fs.existsSync(summaryPath)) continue;
    try {
      const s = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
      const name = s.case_name || s.caseName;
      if (!name) continue;

      const createdAt = s.startedAt || s.timestamp || s.date || null;
      const updatedAt =
        s.finishedAt || s.startedAt || s.timestamp || s.date || null;

      runs.push({
        case_name: name,
        dataset: s.dataset || s.datasetName,
        count: s.count || s.rawCount,
        status: s.status,
        validation: s.validation,
        hardValidation: s.hardValidation,
        semanticValidation: s.semanticValidation,
        timestamp: createdAt,
        createdAt,
        updatedAt,
        duration_ms: s.duration_ms || s.durationMs,
      });
    } catch {}
  }

  return runs.sort(
    (a, b) =>
      new Date(b.updatedAt || 0).getTime() -
      new Date(a.updatedAt || 0).getTime()
  );
}

function getRunByCaseNameFromLocal(caseName: string): RunRecord | null {
  const runs = getRunsFromLocal();
  return runs.find((r) => r.case_name === caseName) || null;
}

// ===========================================
// Supabase Mode Implementation
// ===========================================

async function getSupabaseClient() {
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

async function getRunsFromSupabase(): Promise<RunRecord[]> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching runs from Supabase:", error);
    return [];
  }

  return (data || []).map(mapSupabaseRunToRecord);
}

async function getRunByCaseNameFromSupabase(
  caseName: string
): Promise<RunRecord | null> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("case_name", caseName)
    .single();

  if (error || !data) {
    return null;
  }

  return mapSupabaseRunToRecord(data);
}

async function createRunInSupabase(input: {
  case_name: string;
  dataset?: string;
  count?: number;
  status?: string;
  workspace_id?: string;
  metadata?: Record<string, any>;
}): Promise<RunRecord | null> {
  const supabase = await getSupabaseClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("runs")
    .insert({
      case_name: input.case_name,
      scenario: input.dataset || null,
      feedback_count: input.count || 0,
      status: input.status || "pending",
      hard_score: null,
      semantic_score: null,
      evidence_broken: 0,
      workspace_id: input.workspace_id || null,
      started_at: now,
      created_at: now,
      updated_at: now,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating run in Supabase:", error);
    return null;
  }

  return mapSupabaseRunToRecord(data);
}

async function updateRunInSupabase(
  caseName: string,
  input: Partial<RunRecord>
): Promise<boolean> {
  const supabase = await getSupabaseClient();

  const updateData: any = {};
  if (input.status) updateData.status = input.status;
  if (input.count) updateData.feedback_count = input.count;
  if (input.hardValidation?.score)
    updateData.hard_score = input.hardValidation.score;
  if (input.semanticValidation?.score)
    updateData.semantic_score = input.semanticValidation.score;
  if (input.semanticValidation?.evidenceBroken !== undefined)
    updateData.evidence_broken = input.semanticValidation.evidenceBroken;
  if (input.updatedAt) updateData.updated_at = input.updatedAt;

  const { error } = await supabase
    .from("runs")
    .update(updateData)
    .eq("case_name", caseName);

  return !error;
}

// ===========================================
// Helpers
// ===========================================

function mapSupabaseRunToRecord(row: any): RunRecord {
  return {
    case_name: row.case_name,
    dataset: row.scenario || "",
    count: row.feedback_count || 0,
    status: row.status || "pending",
    validation: null,
    hardValidation: row.hard_score
      ? { score: row.hard_score, status: "pass" }
      : null,
    semanticValidation: row.semantic_score
      ? {
          score: row.semantic_score,
          evidenceBroken: row.evidence_broken || 0,
          criticalIssues: 0,
          status: "pass",
        }
      : null,
    timestamp: row.started_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    duration_ms: row.metadata?.duration_ms || null,
  };
}
