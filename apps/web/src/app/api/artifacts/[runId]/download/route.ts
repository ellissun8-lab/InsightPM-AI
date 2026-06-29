import { NextResponse } from "next/server";
import { getReportArtifactsByRunId } from "@/lib/data/artifacts-repository";

const ALLOWED_TYPES = new Set(["summary-json", "overall-md", "validation-json", "segment-json"]);

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
        { error: "Failed to download file from storage" },
        { status: 500 }
      );
    }

    const buffer = await fileData.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("Artifact download error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
