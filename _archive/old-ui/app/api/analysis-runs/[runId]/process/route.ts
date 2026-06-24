import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAnalysisPipeline } from "@/lib/analysis/pipeline";

export async function POST(
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

    if (run.status === "running") {
      return NextResponse.json(
        { error: "分析任务正在运行中" },
        { status: 400 }
      );
    }

    if (run.status === "completed") {
      return NextResponse.json(
        { error: "分析任务已完成" },
        { status: 400 }
      );
    }

    // Run the analysis pipeline
    const result = await runAnalysisPipeline(
      runId,
      run.project_id,
      run.batch_id,
      user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "分析失败" },
        { status: 500 }
      );
    }

    // Get the generated clusters count
    const { count: clusterCount } = await supabase
      .from("issue_clusters")
      .select("*", { count: "exact", head: true })
      .eq("analysis_run_id", runId)
      .eq("owner_id", user.id);

    return NextResponse.json({
      run_id: runId,
      status: "completed",
      issue_cluster_count: clusterCount || 0,
    });
  } catch (error) {
    console.error("Process API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
