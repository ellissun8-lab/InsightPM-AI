import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = new Set(["summary-json", "overall-md", "validation-json", "segment-json"]);
const MAX_PREVIEW_BYTES = 1024 * 1024; // 1MB

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;
    const url = new URL(request.url);
    const artifactType = url.searchParams.get("type");

    if (!runId) {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    if (!artifactType || !ALLOWED_TYPES.has(artifactType)) {
      return NextResponse.json(
        { error: `Invalid or missing artifact type. Allowed: ${[...ALLOWED_TYPES].join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Direct query for artifact
    const { data: artifact, error: queryError } = await supabase
      .from("report_artifacts")
      .select("*")
      .eq("run_id", runId)
      .eq("artifact_type", artifactType)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (queryError || !artifact) {
      return NextResponse.json(
        { error: `Artifact not found: ${artifactType}` },
        { status: 404 }
      );
    }

    if (!artifact.storage_bucket || !artifact.storage_path) {
      return NextResponse.json(
        { error: "Artifact has no storage reference" },
        { status: 404 }
      );
    }

    // Download from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(artifact.storage_bucket)
      .download(artifact.storage_path);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to read file from storage" },
        { status: 500 }
      );
    }

    let text = await fileData.text();
    let truncated = false;

    if (text.length > MAX_PREVIEW_BYTES) {
      text = text.slice(0, MAX_PREVIEW_BYTES);
      truncated = true;
    }

    // For JSON types, try to parse and return formatted
    if (artifactType.endsWith("-json")) {
      try {
        const parsed = JSON.parse(text);
        return NextResponse.json({
          artifactType,
          fileName: artifact.file_name,
          contentType: artifact.content_type,
          sizeBytes: artifact.size_bytes,
          truncated,
          content: parsed,
        });
      } catch {
        return NextResponse.json({
          artifactType,
          fileName: artifact.file_name,
          contentType: artifact.content_type,
          sizeBytes: artifact.size_bytes,
          truncated,
          content: text,
          warning: "Content is not valid JSON, returned as raw text",
        });
      }
    }

    // For markdown, return as text
    return NextResponse.json({
      artifactType,
      fileName: artifact.file_name,
      contentType: artifact.content_type,
      sizeBytes: artifact.size_bytes,
      truncated,
      content: text,
    });
  } catch (err: any) {
    console.error("Artifact preview error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
