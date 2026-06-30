import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePptx } from "@/lib/ppt-generator";

const DECK_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

async function downloadArtifactContent(supabase: any, bucket: string, storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(storagePath);
    if (error || !data) return null;
    return await data.text();
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params;
    if (!runId) {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Get run
    const { data: run, error: runError } = await supabase
      .from("runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const caseName = run.case_name;

    // 2. Get artifacts
    const { data: arts } = await supabase
      .from("report_artifacts")
      .select("*")
      .eq("run_id", runId);

    const artMap = new Map<string, any>();
    for (const a of arts || []) {
      artMap.set(a.artifact_type, a);
    }

    // 3. Download overall-md content
    const overallMdArt = artMap.get("overall-md");
    let overallMd = "";
    if (overallMdArt?.storage_bucket && overallMdArt?.storage_path) {
      overallMd = await downloadArtifactContent(supabase, overallMdArt.storage_bucket, overallMdArt.storage_path) || "";
    }
    if (!overallMd) {
      return NextResponse.json({ error: "overall-md missing, cannot generate insights" }, { status: 400 });
    }

    // 4. Download segment-json
    const segArt = artMap.get("segment-json");
    let segments: any[] = [];
    if (segArt?.storage_bucket && segArt?.storage_path) {
      const segContent = await downloadArtifactContent(supabase, segArt.storage_bucket, segArt.storage_path);
      if (segContent) {
        try {
          const parsed = JSON.parse(segContent);
          const segData = parsed.segments || parsed;
          segments = Array.isArray(segData) ? segData : (segData?.segments || []);
        } catch {}
      }
    }

    // 5. Build summary data from run
    const summary = {
      durationMs: run.metadata?.metrics?.durationMs || null,
      metrics: run.metadata?.metrics || {},
    };

    // 6. Count clusters
    let clusterCount = 0;
    for (const seg of segments) {
      clusterCount += (seg.issue_cluster_ids || []).length;
    }

    // 7. Generate PPTX
    const pptxBuffer = await generatePptx({
      caseName,
      feedbackCount: run.feedback_count || 0,
      hardScore: run.hard_score,
      semanticScore: run.semantic_score,
      segmentCount: segments.length,
      clusterCount,
      overallMd,
      summary,
      segments,
    });

    // 8. Upload PPTX to storage
    const pptxFileName = `${caseName}.insights.pptx`;
    const pptxStoragePath = `${runId}/${pptxFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("report-artifacts")
      .upload(pptxStoragePath, pptxBuffer, {
        contentType: DECK_CONTENT_TYPE,
        upsert: true,
      });

    if (uploadError) {
      console.error("PPTX upload error:", uploadError);
      return NextResponse.json({ error: "PPTX upload failed: " + uploadError.message }, { status: 500 });
    }

    // 9. Write artifact record
    const now = new Date().toISOString();
    const { data: existingDeck } = await supabase
      .from("report_artifacts")
      .select("id")
      .eq("run_id", runId)
      .eq("artifact_type", "deck-pptx")
      .limit(1)
      .single();

    if (existingDeck) {
      // Update existing
      await supabase
        .from("report_artifacts")
        .update({
          file_name: pptxFileName,
          storage_bucket: "report-artifacts",
          storage_path: pptxStoragePath,
          content_type: DECK_CONTENT_TYPE,
          size_bytes: pptxBuffer.length,
          metadata: { source: "real-pipeline", generatedBy: "report-insights", caseName, runId },
          updated_at: now,
        })
        .eq("id", existingDeck.id);
    } else {
      // Insert new
      await supabase
        .from("report_artifacts")
        .insert({
          run_id: runId,
          artifact_type: "deck-pptx",
          file_name: pptxFileName,
          storage_bucket: "report-artifacts",
          storage_path: pptxStoragePath,
          content_type: DECK_CONTENT_TYPE,
          size_bytes: pptxBuffer.length,
          metadata: { source: "real-pipeline", generatedBy: "report-insights", caseName, runId },
          created_at: now,
        });
    }

    return NextResponse.json({
      ok: true,
      runId,
      caseName,
      artifacts: {
        pptx: {
          artifactType: "deck-pptx",
          fileName: pptxFileName,
          sizeBytes: pptxBuffer.length,
        },
      },
    });
  } catch (err: any) {
    console.error("generate-insights error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
