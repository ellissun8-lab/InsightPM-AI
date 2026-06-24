import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { project_id, batch_id } = body;

    if (!project_id) {
      return NextResponse.json(
        { error: "缺少项目ID" },
        { status: 400 }
      );
    }

    // Verify project belongs to user
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("owner_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "项目不存在或无权限" },
        { status: 403 }
      );
    }

    // Create analysis run
    const { data: run, error } = await supabase
      .from("analysis_runs")
      .insert({
        project_id,
        batch_id: batch_id || null,
        owner_id: user.id,
        status: "pending",
        progress: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Create analysis run error:", error);
      return NextResponse.json(
        { error: "创建分析任务失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      run_id: run.id,
      status: run.status,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

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

    if (!projectId) {
      return NextResponse.json(
        { error: "缺少项目ID" },
        { status: 400 }
      );
    }

    const { data: runs } = await supabase
      .from("analysis_runs")
      .select("*")
      .eq("project_id", projectId)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json(runs || []);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
