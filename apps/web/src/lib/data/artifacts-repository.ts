import fs from "fs";
import path from "path";
import { isCloudMode } from "./storage-mode";

const ROOT = path.resolve(process.cwd(), "../..");

export interface Artifact {
  id: string;
  runId: string;
  artifactType: string;
  fileName: string;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface CreateArtifactInput {
  runId: string;
  artifactType: string;
  fileName: string;
  storageBucket: string;
  storagePath: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Get all artifacts for a run
 */
export async function getArtifactsForRun(
  runId: string
): Promise<Artifact[]> {
  if (isCloudMode()) {
    return getArtifactsForRunFromSupabase(runId);
  }
  return getArtifactsForRunFromLocal(runId);
}

/**
 * Create a new artifact record
 */
export async function createArtifact(
  input: CreateArtifactInput
): Promise<Artifact | null> {
  if (isCloudMode()) {
    return createArtifactInSupabase(input);
  }
  // Local mode: artifacts are files, not database records
  return null;
}

/**
 * Get a signed download URL for an artifact
 */
export async function getArtifactDownloadUrl(
  artifactId: string
): Promise<string | null> {
  if (isCloudMode()) {
    return getArtifactDownloadUrlFromSupabase(artifactId);
  }
  // Local mode: return local file path (not a URL)
  return null;
}

// ===========================================
// Local Mode Implementation
// ===========================================

function getArtifactsForRunFromLocal(runId: string): Artifact[] {
  // In local mode, artifacts are files in the runs directory
  // We don't have a database, so we return an empty array
  // The actual files are accessed directly by the API routes
  return [];
}

// ===========================================
// Supabase Mode Implementation
// ===========================================

async function getSupabaseClient() {
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

async function getArtifactsForRunFromSupabase(
  runId: string
): Promise<Artifact[]> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("report_artifacts")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching artifacts from Supabase:", error);
    return [];
  }

  return (data || []).map(mapSupabaseArtifact);
}

async function createArtifactInSupabase(
  input: CreateArtifactInput
): Promise<Artifact | null> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("report_artifacts")
    .insert({
      run_id: input.runId,
      artifact_type: input.artifactType,
      file_name: input.fileName,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating artifact in Supabase:", error);
    return null;
  }

  return mapSupabaseArtifact(data);
}

async function getArtifactDownloadUrlFromSupabase(
  artifactId: string
): Promise<string | null> {
  const supabase = await getSupabaseClient();

  // First, get the artifact record
  const { data: artifact, error } = await supabase
    .from("report_artifacts")
    .select("storage_bucket, storage_path")
    .eq("id", artifactId)
    .single();

  if (error || !artifact) {
    console.error("Error fetching artifact from Supabase:", error);
    return null;
  }

  // Generate a signed URL
  const { data: urlData, error: urlError } = await supabase.storage
    .from(artifact.storage_bucket)
    .createSignedUrl(artifact.storage_path, 86400); // 24 hours

  if (urlError || !urlData) {
    console.error("Error creating signed URL:", urlError);
    return null;
  }

  return urlData.signedUrl;
}

// ===========================================
// Helpers
// ===========================================

function mapSupabaseArtifact(row: any): Artifact {
  return {
    id: row.id,
    runId: row.run_id,
    artifactType: row.artifact_type,
    fileName: row.file_name || "",
    storageBucket: row.storage_bucket || "",
    storagePath: row.storage_path || "",
    contentType: row.content_type || "",
    sizeBytes: row.size_bytes || 0,
    createdAt: row.created_at,
  };
}
