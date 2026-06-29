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

  // Worker stability fields (Phase 3)
  retryCount: number;
  maxRetry: number;
  lockedBy: string | null;
  lockedAt: string | null;
  heartbeatAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  lastError: any | null;

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

export interface RunsQueryParams {
  q?: string;
  status?: string;
  artifactFilter?: string;
  range?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface RunsQueryResult {
  runs: RunRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  artifactSummary?: Record<string, { count: number; hasOverallMd: boolean; types: string[] }>;
}

/**
 * Get runs with pagination, search, filtering, and sorting.
 */
export async function getRunsWithPagination(params: RunsQueryParams): Promise<{ data: RunsQueryResult; error: any }> {
  if (isCloudMode()) {
    return getRunsWithPaginationFromSupabase(params);
  }
  return getRunsWithPaginationFromLocal(params);
}

async function getRunsWithPaginationFromSupabase(params: RunsQueryParams): Promise<{ data: RunsQueryResult; error: any }> {
  const supabase = await getAdminClient();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const offset = (page - 1) * pageSize;

  // If artifact filter is active, first resolve matching run IDs from report_artifacts
  let artifactFilteredRunIds: string[] | null = null;
  let artifactExcludedRunIds: string[] | null = null;

  if (params.artifactFilter && params.artifactFilter !== "all") {
    const { data: allArts, error: artsErr } = await supabase
      .from("report_artifacts")
      .select("run_id, artifact_type");

    if (artsErr) {
      console.error("getRunsWithPagination artifact query error:", artsErr);
    } else if (allArts) {
      // Build per-run artifact info
      const runArtifactMap = new Map<string, { count: number; hasOverallMd: boolean }>();
      for (const art of allArts) {
        const rid = art.run_id;
        if (!runArtifactMap.has(rid)) {
          runArtifactMap.set(rid, { count: 0, hasOverallMd: false });
        }
        const entry = runArtifactMap.get(rid)!;
        entry.count++;
        if (art.artifact_type === "overall-md") {
          entry.hasOverallMd = true;
        }
      }

      switch (params.artifactFilter) {
        case "has-report": {
          // Runs that have overall-md
          artifactFilteredRunIds = [];
          for (const [rid, info] of runArtifactMap) {
            if (info.hasOverallMd) artifactFilteredRunIds.push(rid);
          }
          break;
        }
        case "missing-report": {
          // Runs that have artifacts but NOT overall-md
          artifactFilteredRunIds = [];
          for (const [rid, info] of runArtifactMap) {
            if (!info.hasOverallMd) artifactFilteredRunIds.push(rid);
          }
          // Also need runs with NO artifacts at all
          // We'll handle this by using NOT IN for runs that have overall-md
          // Actually, "missing-report" = runs without overall-md (including runs with no artifacts)
          // So we need: all runs EXCEPT those with overall-md
          artifactExcludedRunIds = [];
          for (const [rid, info] of runArtifactMap) {
            if (info.hasOverallMd) artifactExcludedRunIds.push(rid);
          }
          artifactFilteredRunIds = null; // Use exclude instead
          break;
        }
        case "has-artifacts": {
          artifactFilteredRunIds = Array.from(runArtifactMap.keys());
          break;
        }
        case "no-artifacts": {
          // Runs NOT in the artifact map
          artifactExcludedRunIds = Array.from(runArtifactMap.keys());
          artifactFilteredRunIds = null; // Use exclude instead
          break;
        }
      }
    }
  }

  // Build query
  let query = supabase.from("runs").select("*", { count: "exact" });

  // Search filter
  if (params.q) {
    const q = `%${params.q}%`;
    query = query.or(`case_name.ilike.${q},scenario.ilike.${q}`);
  }

  // Status filter
  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  // Time range filter
  if (params.range && params.range !== "all") {
    const now = new Date();
    let since: Date;
    switch (params.range) {
      case "today":
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "7d":
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(0);
    }
    query = query.gte("created_at", since.toISOString());
  }

  // Artifact filter: constrain by run IDs (pre-computed above)
  if (artifactFilteredRunIds !== null) {
    if (artifactFilteredRunIds.length === 0) {
      // No runs match this artifact filter
      return {
        data: { runs: [], total: 0, page, pageSize, totalPages: 0, artifactSummary: {} },
        error: null,
      };
    }
    query = query.in("id", artifactFilteredRunIds);
  } else if (artifactExcludedRunIds !== null && artifactExcludedRunIds.length > 0) {
    query = query.not("id", "in", `(${artifactExcludedRunIds.join(",")})`);
  }

  // Sorting
  const sort = params.sort || "newest";
  switch (sort) {
    case "oldest":
      query = query.order("created_at", { ascending: true });
      break;
    case "updated":
      query = query.order("updated_at", { ascending: false });
      break;
    case "score":
      query = query.order("semantic_score", { ascending: false, nullsFirst: false });
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  // Get page data with count
  const { data, error, count: total } = await query.range(offset, offset + pageSize - 1);
  if (error) {
    console.error("getRunsWithPagination data error:", error);
    return { data: { runs: [], total: 0, page, pageSize, totalPages: 0 }, error };
  }

  const runs = (data || []).map(mapSupabaseRunToRecord);
  const totalSafe = total || 0;
  const totalPages = Math.ceil(totalSafe / pageSize);

  // Batch query artifacts for this page's run IDs (for display)
  const pageRunIds = runs.map((r) => r.id).filter(Boolean);
  let artifactSummary: Record<string, { count: number; hasOverallMd: boolean; types: string[] }> = {};

  if (pageRunIds.length > 0) {
    const { data: arts, error: artsError } = await supabase
      .from("report_artifacts")
      .select("run_id, artifact_type")
      .in("run_id", pageRunIds);

    if (!artsError && arts) {
      for (const art of arts) {
        const rid = art.run_id;
        if (!artifactSummary[rid]) {
          artifactSummary[rid] = { count: 0, hasOverallMd: false, types: [] };
        }
        artifactSummary[rid].count++;
        artifactSummary[rid].types.push(art.artifact_type);
        if (art.artifact_type === "overall-md") {
          artifactSummary[rid].hasOverallMd = true;
        }
      }
    }
  }

  return {
    data: { runs, total: totalSafe, page, pageSize, totalPages, artifactSummary },
    error: null,
  };
}

function getRunsWithPaginationFromLocal(params: RunsQueryParams): { data: RunsQueryResult; error: any } {
  let allRuns = getRunsFromLocal();

  // Search
  if (params.q) {
    const q = params.q.toLowerCase();
    allRuns = allRuns.filter((r) => {
      const name = (r.caseName || r.case_name || "").toLowerCase();
      const scenario = (r.scenario || r.dataset || "").toLowerCase();
      const originalName = (r.metadata?.inputFile?.originalName || "").toLowerCase();
      return name.includes(q) || scenario.includes(q) || originalName.includes(q);
    });
  }

  // Status
  if (params.status && params.status !== "all") {
    allRuns = allRuns.filter((r) => r.status === params.status);
  }

  // Time range
  if (params.range && params.range !== "all") {
    const now = new Date();
    let since: Date;
    switch (params.range) {
      case "today":
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "7d":
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(0);
    }
    allRuns = allRuns.filter((r) => {
      const created = r.createdAt || r.timestamp;
      return created && new Date(created) >= since;
    });
  }

  // Sort
  const sort = params.sort || "newest";
  switch (sort) {
    case "oldest":
      allRuns.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      break;
    case "updated":
      allRuns.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      break;
    case "score":
      allRuns.sort((a, b) => (b.semanticScore ?? -1) - (a.semanticScore ?? -1));
      break;
    case "newest":
    default:
      allRuns.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      break;
  }

  // Artifact filter (local mode: check artifacts field)
  if (params.artifactFilter && params.artifactFilter !== "all") {
    allRuns = allRuns.filter((r) => {
      const hasArtifacts = r.artifacts?.markdown || r.artifacts?.report || r.artifacts?.json;
      switch (params.artifactFilter) {
        case "has-report":
          return r.artifacts?.markdown === true;
        case "missing-report":
          return !r.artifacts?.markdown;
        case "has-artifacts":
          return hasArtifacts;
        case "no-artifacts":
          return !hasArtifacts;
        default:
          return true;
      }
    });
  }

  // Pagination
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
  const total = allRuns.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  const runs = allRuns.slice(offset, offset + pageSize);

  return {
    data: { runs, total, page, pageSize, totalPages },
    error: null,
  };
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

        // Worker stability fields (local mode defaults)
        retryCount: s.retry_count ?? 0,
        maxRetry: s.max_retry ?? 2,
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
        completedAt: s.finishedAt || null,
        failedAt: null,
        lastError: null,

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

    // Worker stability fields
    retryCount: row.retry_count ?? 0,
    maxRetry: row.max_retry ?? 2,
    lockedBy: row.locked_by ?? null,
    lockedAt: row.locked_at ?? null,
    heartbeatAt: row.heartbeat_at ?? null,
    completedAt: row.completed_at ?? null,
    failedAt: row.failed_at ?? null,
    lastError: row.last_error ?? null,

    // Legacy compatibility
    case_name: row.case_name,
    count: row.feedback_count || 0,
    timestamp: updatedAt,
    duration_ms: row.metadata?.duration_ms ?? null,
    validation: null,
  };
}
