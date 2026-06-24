import { NextResponse } from "next/server";
import { getTrainingDatasets } from "@/lib/data/training-repository";

export async function GET() {
  try {
    const data = await getTrainingDatasets();

    return NextResponse.json({
      datasets: data.datasets,
      total: data.total,
      accepted: data.accepted,
      rejected: data.rejected,
      feedbacks: data.feedbacks,
      heldout: data.heldout,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
