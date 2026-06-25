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
  metadata: any;
}

export interface CreateArtifactInput {
  runId: string;
  artifactType: string;
  fileName?: string;
  storageBucket?: string;
  storagePath?: string;
  contentType?: string;
  sizeBytes?: number;
  metadata?: Record<string, any>;
}

/**
 * Get all artifacts for a run
 */
export async function getArtifactsForRun(runId: string): Promise<Artifact[]> {
  if (isCloudMode()) {
    return getArtifactsForRunFromSupabase(runId);
  }
  return getArtifactsForRunFromLocal(runId);
}

/**
 * Get report artifacts by run id and type
 */
export async function getReportArtifactsByRunId(
  runId: string,
  artifactType?: string
): Promise<Artifact[]> {
  if (isCloudMode()) {
    return getReportArtifactsByRunIdFromSupabase(runId, artifactType);
  }
  return [];
}

/**
 * Create a new artifact record
 */
export async function createArtifact(
  input: CreateArtifactInput
): Promise<{ data: Artifact | null; error: any }> {
  if (isCloudMode()) {
    return createArtifactInSupabase(input);
  }
  return { data: null, error: null };
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
  return null;
}

// ===========================================
// Local Mode Implementation
// ===========================================

function getArtifactsForRunFromLocal(runId: string): Artifact[] {
  return [];
}

// ===========================================
// Supabase Mode Implementation
// ===========================================

async function getAdminClient() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return createAdminClient();
}

async function getArtifactsForRunFromSupabase(runId: string): Promise<Artifact[]> {
  const supabase = await getAdminClient();

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

async function getReportArtifactsByRunIdFromSupabase(
  runId: string,
  artifactType?: string
): Promise<Artifact[]> {
  const supabase = await getAdminClient();

  let query = supabase
    .from("report_artifacts")
    .select("*")
    .eq("run_id", runId);

  if (artifactType) {
    query = query.eq("artifact_type", artifactType);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching report artifacts:", error);
    return [];
  }

  return (data || []).map(mapSupabaseArtifact);
}

async function createArtifactInSupabase(
  input: CreateArtifactInput
): Promise<{ data: Artifact | null; error: any }> {
  const supabase = await getAdminClient();

  const { data, error } = await supabase
    .from("report_artifacts")
    .insert({
      run_id: input.runId,
      artifact_type: input.artifactType,
      file_name: input.fileName || null,
      storage_bucket: input.storageBucket || null,
      storage_path: input.storagePath || null,
      content_type: input.contentType || "text/markdown",
      size_bytes: input.sizeBytes || 0,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating artifact in Supabase:", error);
    return { data: null, error };
  }

  return { data: mapSupabaseArtifact(data), error: null };
}

async function getArtifactDownloadUrlFromSupabase(
  artifactId: string
): Promise<string | null> {
  const supabase = await getAdminClient();

  const { data: artifact, error } = await supabase
    .from("report_artifacts")
    .select("storage_bucket, storage_path")
    .eq("id", artifactId)
    .single();

  if (error || !artifact) {
    console.error("Error fetching artifact from Supabase:", error);
    return null;
  }

  if (!artifact.storage_bucket || !artifact.storage_path) {
    return null;
  }

  const { data: urlData, error: urlError } = await supabase.storage
    .from(artifact.storage_bucket)
    .createSignedUrl(artifact.storage_path, 86400);

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
    metadata: row.metadata || {},
  };
}
