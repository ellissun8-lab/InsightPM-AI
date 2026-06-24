import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // Get the analysis run
    const { data: run } = await supabase
      .from("analysis_runs")
      .select("*")
      .eq("id", runId)
      .eq("owner_id", user.id)
      .single();

    if (!run) {
      return NextResponse.json(
        { error: "分析任务不存在或无权限" },
        { status: 403 }
      );
    }

    // Get clusters
    const { data: clusters } = await supabase
      .from("issue_clusters")
      .select("*")
      .eq("analysis_run_id", runId)
      .eq("owner_id", user.id)
      .order("opportunity_score", { ascending: false });

    // Get report if exists
    const { data: report } = await supabase
      .from("reports")
      .select("*")
      .eq("analysis_run_id", runId)
      .eq("owner_id", user.id)
      .single();

    return NextResponse.json({
      run,
      clusters: clusters || [],
      report: report || null,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
