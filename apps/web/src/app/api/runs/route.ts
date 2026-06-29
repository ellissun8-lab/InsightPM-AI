import { NextResponse } from "next/server";
import { getRuns, getRunsWithPagination } from "@/lib/data/runs-repository";
import { getTrainingDatasets } from "@/lib/data/training-repository";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hasParams = url.searchParams.has("page") || url.searchParams.has("q") ||
      url.searchParams.has("status") || url.searchParams.has("sort") ||
      url.searchParams.has("range") || url.searchParams.has("artifact");

    // If query params present, use paginated mode
    if (hasParams) {
      const result = await getRunsWithPagination({
        q: url.searchParams.get("q") || undefined,
        status: url.searchParams.get("status") || undefined,
        artifactFilter: url.searchParams.get("artifact") || undefined,
        range: url.searchParams.get("range") || undefined,
        sort: url.searchParams.get("sort") || undefined,
        page: url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1,
        pageSize: url.searchParams.get("pageSize") ? parseInt(url.searchParams.get("pageSize")!, 10) : 20,
      });

      if (result.error) {
        return NextResponse.json({ ok: false, error: result.error.message }, { status: 500 });
      }

      return NextResponse.json(result.data, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    // Legacy mode: return all runs (for backward compatibility)
    const { data: runs, error: runsError } = await getRuns();

    if (runsError) {
      return NextResponse.json({ ok: false, error: "读取运行历史失败", detail: runsError.message }, { status: 500 });
    }

    const trainingData = await getTrainingDatasets();
    const datasets = {
      totalDatasets: trainingData.total,
      acceptedCount: trainingData.accepted,
      totalFeedbacks: trainingData.feedbacks,
    };

    return NextResponse.json(
      { runs, datasets },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
