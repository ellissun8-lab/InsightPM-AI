import { NextResponse } from "next/server";
import { getReportArtifactsByRunId } from "@/lib/data/artifacts-repository";

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

    const artifacts = await getReportArtifactsByRunId(runId, artifactType);
    const artifact = artifacts[0];

    if (!artifact) {
      return NextResponse.json(
        { error: `Artifact not found: ${artifactType}` },
        { status: 404 }
      );
    }

    if (!artifact.storageBucket || !artifact.storagePath) {
      return NextResponse.json(
        { error: "Artifact has no storage reference" },
        { status: 404 }
      );
    }

    // Download from Supabase Storage
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = await createAdminClient();

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(artifact.storageBucket)
      .download(artifact.storagePath);

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
          fileName: artifact.fileName,
          contentType: artifact.contentType,
          sizeBytes: artifact.sizeBytes,
          truncated,
          content: parsed,
        });
      } catch {
        // Not valid JSON, return as text with warning
        return NextResponse.json({
          artifactType,
          fileName: artifact.fileName,
          contentType: artifact.contentType,
          sizeBytes: artifact.sizeBytes,
          truncated,
          content: text,
          warning: "Content is not valid JSON, returned as raw text",
        });
      }
    }

    // For markdown, return as text
    return NextResponse.json({
      artifactType,
      fileName: artifact.fileName,
      contentType: artifact.contentType,
      sizeBytes: artifact.sizeBytes,
      truncated,
      content: text,
    });
  } catch (err: any) {
    console.error("Artifact preview error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
