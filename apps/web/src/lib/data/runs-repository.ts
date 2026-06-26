import fs from "fs";
import path from "path";
import { isCloudMode } from "./storage-mode";

const ROOT = path.resolve(process.cwd(), "../..");

type RunArtifacts = {
  markdown: boolean;
  report: boolean;
  json: boolean;
};

export interface RunRecord {
  // Primary camelCase fields
  id: string;
  caseName: string;
  scenario: string;
  dataset: string;
  status: string;
  feedbackCount: number;
  hardScore: number | null;
  semanticScore: number | null;
  evidenceBroken: number | null;
  hardValidation: any | null;
  semanticValidation: any | null;
  artifacts: RunArtifacts | null;
  createdAt: string | null;
  updatedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  metadata: any | null;

  // Legacy compatibility fields
  case_name: string;
  count: number;
  timestamp: string | null;
  duration_ms: number | null;
  validation: any;
}

/**
 * Get all runs from the current storage mode.
 */
export async function getRuns(): Promise<{ data: RunRecord[]; error: any }> {
  if (isCloudMode()) {
    return getRunsFromSupabase();
  }
  return { data: getRunsFromLocal(), error: null };
}

/**
 * Get a single run by case name
 */
export async function getRunByCaseName(caseName: string): Promise<RunRecord | null> {
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
}): Promise<{ data: RunRecord | null; error: any }> {
  if (isCloudMode()) {
    return createRunInSupabase(input);
  }
  return { data: null, error: null };
}

/**
 * Update a run record by case name
 */
export async function updateRun(caseName: string, input: Partial<RunRecord>): Promise<boolean> {
  if (isCloudMode()) {
    return updateRunByCaseNameInSupabase(caseName, input);
  }
  return false;
}

/**
 * Update a run record by id
 */
export async function updateRunById(id: string, input: Partial<RunRecord>): Promise<{ data: RunRecord | null; error: any }> {
  if (isCloudMode()) {
    return updateRunByIdInSupabase(id, input);
  }
  return { data: null, error: null };
}

// Local Mode
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
      const updatedAt = s.finishedAt || s.startedAt || s.timestamp || s.date || null;
      const feedbackCount = s.count || s.rawCount || 0;
      const dataset = s.dataset || s.datasetName || "";
      const runDir = path.join(runsDir, d);
      const artifacts = getLocalRunArtifacts(runDir);
      const metadata = {
        ...(s.metadata && typeof s.metadata === "object" ? s.metadata : {}),
        artifacts,
        hasReport: artifacts.markdown || artifacts.report || artifacts.json,
      };

      runs.push({
        // Primary camelCase fields
        id: d,
        caseName: name,
        scenario: dataset,
        dataset,
        status: s.status || "pending",
        feedbackCount,
        hardScore: s.hardValidation?.score ?? null,
        semanticScore: s.semanticValidation?.score ?? null,
        evidenceBroken: s.semanticValidation?.evidenceBroken ?? null,
        hardValidation: s.hardValidation || null,
        semanticValidation: s.semanticValidation || null,
        artifacts,
        createdAt,
        updatedAt,
        startedAt: createdAt,
        finishedAt: s.finishedAt || null,
        durationMs: s.duration_ms || s.durationMs || null,
        metadata,

        // Legacy compatibility
        case_name: name,
        count: feedbackCount,
        timestamp: updatedAt,
        duration_ms: s.duration_ms || s.durationMs || null,
        validation: s.validation || null,
      });
    } catch {}
  }

  return runs.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
}

function getLocalRunArtifacts(runDir: string): RunArtifacts {
  const artifactDirs = ["analysis", "analysis-md", "insights", "validation-report"]
    .map((name) => path.join(runDir, name))
    .filter((dir) => fs.existsSync(dir));

  const markdown = artifactDirs.some((dir) => directoryHasFile(dir, [".md"]));
  const json = artifactDirs.some((dir) => directoryHasFile(dir, [".json"]));
  const report = artifactDirs.some((dir) => directoryHasFile(dir, [".md", ".json", ".html", ".pdf"]));

  return { markdown, report, json };
}

function directoryHasFile(dir: string, extensions: string[]): boolean {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && directoryHasFile(fullPath, extensions)) {
        return true;
      }
      if (entry.isFile() && extensions.includes(path.extname(entry.name).toLowerCase())) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function getRunByCaseNameFromLocal(caseName: string): RunRecord | null {
  const runs = getRunsFromLocal();
  return runs.find((r) => r.case_name === caseName) || null;
}

// Supabase Mode
async function getSupabaseClient() {
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

async function getAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function getRunsFromSupabase(): Promise<{ data: RunRecord[]; error: any }> {
  console.log("getRunsFromSupabase: PROOFLOOP_STORAGE_MODE =", process.env.PROOFLOOP_STORAGE_MODE);

  // Use admin client to bypass RLS
  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .order("updated_at", { ascending: false });

  console.log("getRunsFromSupabase: data length =", data?.length);
  if (error) {
    console.error("getRunsFromSupabase error:", error);
    return { data: [], error };
  }

  return { data: (data || []).map(mapSupabaseRunToRecord), error: null };
}

async function getRunByCaseNameFromSupabase(caseName: string): Promise<RunRecord | null> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.from("runs").select("*").eq("case_name", caseName).single();
  if (error || !data) return null;
  return mapSupabaseRunToRecord(data);
}

async function createRunInSupabase(input: {
  case_name: string;
  dataset?: string;
  count?: number;
  status?: string;
  workspace_id?: string;
  metadata?: Record<string, any>;
}): Promise<{ data: RunRecord | null; error: any }> {
  // Use admin client to bypass RLS
  const supabase = await getAdminClient();
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

  if (error) {
    console.error("createRun failed:", error);
    return { data: null, error };
  }

  return { data: mapSupabaseRunToRecord(data), error: null };
}

async function updateRunByCaseNameInSupabase(caseName: string, input: Partial<RunRecord>): Promise<boolean> {
  const supabase = await getSupabaseClient();
  const updateData: any = {};
  if (input.status) updateData.status = input.status;
  if (input.count) updateData.feedback_count = input.count;
  if (input.hardValidation?.score) updateData.hard_score = input.hardValidation.score;
  if (input.semanticValidation?.score) updateData.semantic_score = input.semanticValidation.score;
  if (input.semanticValidation?.evidenceBroken !== undefined) updateData.evidence_broken = input.semanticValidation.evidenceBroken;
  if (input.updatedAt) updateData.updated_at = input.updatedAt;

  const { error } = await supabase.from("runs").update(updateData).eq("case_name", caseName);
  return !error;
}

async function updateRunByIdInSupabase(id: string, input: Partial<RunRecord>): Promise<{ data: RunRecord | null; error: any }> {
  // Use admin client to bypass RLS
  const supabase = await getAdminClient();

  const updateData: any = {};
  if (input.status !== undefined) updateData.status = input.status;
  if (input.hardScore !== undefined) updateData.hard_score = input.hardScore;
  if (input.semanticScore !== undefined) updateData.semantic_score = input.semanticScore;
  if (input.evidenceBroken !== undefined) updateData.evidence_broken = input.evidenceBroken;
  if (input.finishedAt !== undefined) updateData.finished_at = input.finishedAt;
  if (input.updatedAt !== undefined) updateData.updated_at = input.updatedAt;
  if (input.metadata !== undefined) updateData.metadata = input.metadata;

  const { data, error } = await supabase
    .from("runs")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("updateRunById failed:", error);
    return { data: null, error };
  }

  return { data: mapSupabaseRunToRecord(data), error: null };
}

// Helpers
function mapSupabaseRunToRecord(row: any): RunRecord {
  const createdAt = row.created_at || null;
  const updatedAt = row.updated_at || createdAt;

  return {
    // Primary camelCase fields
    id: row.id,
    caseName: row.case_name,
    scenario: row.scenario || "",
    dataset: row.scenario || "",
    status: row.status || "pending",
    feedbackCount: row.feedback_count || 0,
    hardScore: row.hard_score ?? null,
    semanticScore: row.semantic_score ?? null,
    evidenceBroken: row.evidence_broken ?? null,
    hardValidation: row.hard_score != null ? { score: row.hard_score, status: "pass" } : null,
    semanticValidation: row.semantic_score != null
      ? { score: row.semantic_score, evidenceBroken: row.evidence_broken || 0, criticalIssues: 0, status: "pass" }
      : null,
    artifacts: row.metadata?.artifacts ?? null,
    createdAt,
    updatedAt,
    startedAt: row.started_at || null,
    finishedAt: row.finished_at || null,
    durationMs: row.metadata?.duration_ms ?? null,
    metadata: row.metadata || null,

    // Legacy compatibility
    case_name: row.case_name,
    count: row.feedback_count || 0,
    timestamp: updatedAt,
    duration_ms: row.metadata?.duration_ms ?? null,
    validation: null,
  };
}
