import { NextResponse } from "next/server";
import { getMarkdownReportByRunId, getSummaryArtifactByRunId } from "@/lib/data/artifacts-repository";

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;

    if (!runId) {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    const { markdown, artifact: mdArtifact } = await getMarkdownReportByRunId(runId);
    const { summary, artifact: summaryArtifact } = await getSummaryArtifactByRunId(runId);

    return NextResponse.json({
      markdown: markdown || null,
      markdownArtifact: mdArtifact ? {
        id: mdArtifact.id,
        artifactType: mdArtifact.artifactType,
        fileName: mdArtifact.fileName,
        metadata: mdArtifact.metadata,
        createdAt: mdArtifact.createdAt,
      } : null,
      summary: summary || null,
      summaryArtifact: summaryArtifact ? {
        id: summaryArtifact.id,
        artifactType: summaryArtifact.artifactType,
        fileName: summaryArtifact.fileName,
        metadata: summaryArtifact.metadata,
        createdAt: summaryArtifact.createdAt,
      } : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
