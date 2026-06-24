import { NextResponse } from "next/server";
import { getRuns } from "@/lib/data/runs-repository";
import { getTrainingDatasets } from "@/lib/data/training-repository";

export async function GET() {
  try {
    console.log("/api/runs: PROOFLOOP_STORAGE_MODE =", process.env.PROOFLOOP_STORAGE_MODE);

    // Get runs from repository (handles local/cloud mode)
    const { data: runs, error: runsError } = await getRuns();

    if (runsError) {
      console.error("/api/runs: runs query error:", runsError);
      return NextResponse.json(
        {
          ok: false,
          error: "读取运行历史失败",
          detail: runsError.message,
          code: runsError.code,
        },
        { status: 500 }
      );
    }

    console.log("/api/runs: runs count =", runs.length);

    // Get training datasets for stats
    const trainingData = await getTrainingDatasets();

    const datasets = {
      totalDatasets: trainingData.total,
      acceptedCount: trainingData.accepted,
      totalFeedbacks: trainingData.feedbacks,
    };

    return NextResponse.json(
      { runs, datasets },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("/api/runs: unexpected error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        detail: err.stack,
      },
      { status: 500 }
    );
  }
}
