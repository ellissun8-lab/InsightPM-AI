import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    const runId = searchParams.get("run_id");

    if (!projectId) {
      return NextResponse.json(
        { error: "缺少项目ID" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("reports")
      .select("*")
      .eq("project_id", projectId)
      .eq("owner_id", user.id);

    if (runId) {
      query = query.eq("analysis_run_id", runId);
    }

    const { data: reports, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      console.error("Get reports error:", error);
      return NextResponse.json(
        { error: "获取报告失败" },
        { status: 500 }
      );
    }

    return NextResponse.json(reports || []);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
