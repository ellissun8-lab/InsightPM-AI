import { NextResponse } from "next/server";
import { getRuns } from "@/lib/data/runs-repository";
import { getTrainingDatasets } from "@/lib/data/training-repository";

export async function GET() {
  const [{ data: runs, error }, trainingData] = await Promise.all([
    getRuns(),
    getTrainingDatasets(),
  ]);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "读取运行历史失败",
        detail: error.message,
        code: error.code,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      datasets: {
        totalDatasets: trainingData.total,
        acceptedCount: trainingData.accepted,
        totalFeedbacks: trainingData.feedbacks,
      },
      runs,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
