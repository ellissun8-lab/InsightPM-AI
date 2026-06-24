import fs from "fs";
import path from "path";
import { isCloudMode } from "./storage-mode";

const ROOT = path.resolve(process.cwd(), "../..");

export interface TrainingDataset {
  caseName: string;
  baselineType: string;
  normalizedCount: number;
  acceptedAt: string | null;
  status: string;
  qualityScore: number | null;
}

export interface TrainingDataResult {
  datasets: TrainingDataset[];
  total: number;
  accepted: number;
  rejected: number;
  feedbacks: number;
  heldout: number;
}

/**
 * Get all training datasets from the current storage mode.
 */
export async function getTrainingDatasets(): Promise<TrainingDataResult> {
  if (isCloudMode()) {
    return getTrainingDatasetsFromSupabase();
  }
  return getTrainingDatasetsFromLocal();
}

// ===========================================
// Local Mode Implementation
// ===========================================

function getTrainingDatasetsFromLocal(): TrainingDataResult {
  let datasets: TrainingDataset[] = [];
  let total = 0,
    accepted = 0,
    rejected = 0,
    feedbacks = 0;

  try {
    const idx = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "training-data/dataset-index.json"),
        "utf-8"
      )
    );
    const rawDatasets = idx.datasets || [];
    datasets = rawDatasets.map((d: any) => ({
      caseName: d.caseName,
      baselineType: d.baselineType,
      normalizedCount: d.normalizedCount || 0,
      acceptedAt: d.acceptedAt || null,
      status: d.status || "accepted",
      qualityScore: d.qualityScore || null,
    }));
    total = idx.totalDatasets || 0;
    accepted = idx.acceptedCount || 0;
    rejected = idx.rejectedCount || 0;
    feedbacks = idx.totalFeedbacks || 0;
  } catch {}

  let heldout = 0;
  try {
    const heldoutDir = path.join(ROOT, "evaluation-data/heldout");
    if (fs.existsSync(heldoutDir)) {
      heldout = fs.readdirSync(heldoutDir).length;
    }
  } catch {}

  return { datasets, total, accepted, rejected, feedbacks, heldout };
}

// ===========================================
// Supabase Mode Implementation
// ===========================================

async function getSupabaseClient() {
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

async function getTrainingDatasetsFromSupabase(): Promise<TrainingDataResult> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("training_datasets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching training datasets from Supabase:", error);
    return { datasets: [], total: 0, accepted: 0, rejected: 0, feedbacks: 0, heldout: 0 };
  }

  const datasets: TrainingDataset[] = (data || []).map((row) => ({
    caseName: row.name,
    baselineType: row.scenario || "",
    normalizedCount: row.feedback_count || 0,
    acceptedAt: row.created_at,
    status: row.status || "pending",
    qualityScore: row.quality_score || null,
  }));

  const total = datasets.length;
  const accepted = datasets.filter((d) => d.status === "accepted").length;
  const rejected = datasets.filter((d) => d.status === "rejected").length;
  const feedbacks = datasets.reduce((sum, d) => sum + d.normalizedCount, 0);

  // heldout is not tracked in Supabase for now
  const heldout = 0;

  return { datasets, total, accepted, rejected, feedbacks, heldout };
}
