import { NextResponse } from "next/server";
import { getRuns } from "@/lib/data/runs-repository";
import { getTrainingDatasets } from "@/lib/data/training-repository";

export async function GET() {
  try {
    // Get runs from repository (handles local/cloud mode)
    const runs = await getRuns();

    // Get training datasets for stats
    const trainingData = await getTrainingDatasets();

    const datasets = {
      totalDatasets: trainingData.total,
      acceptedCount: trainingData.accepted,
      totalFeedbacks: trainingData.feedbacks,
    };

    return NextResponse.json({ runs, datasets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
