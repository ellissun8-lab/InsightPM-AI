import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = new Set(["summary-json", "overall-md", "validation-json", "segment-json", "deck-pptx"]);

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
        { error: "Failed to download file from storage" },
        { status: 500 }
      );
    }

    const buffer = await fileData.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": artifact.content_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${artifact.file_name}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Artifact download error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
