import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFeedbackFile } from "@/lib/analysis/parse-feedback-file";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const projectId = formData.get("project_id") as string;
    const file = formData.get("file") as File;

    if (!projectId || !file) {
      return NextResponse.json(
        { error: "缺少项目ID或文件" },
        { status: 400 }
      );
    }

    // Verify project belongs to user
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "项目不存在或无权限" },
        { status: 403 }
      );
    }

    // Read file content
    const content = await file.text();

    // Parse feedback
    const feedbackItems = parseFeedbackFile(file.name, content);

    if (feedbackItems.length === 0) {
      return NextResponse.json(
        { error: "文件中没有有效的反馈内容" },
        { status: 400 }
      );
    }

    // Create feedback batch
    const { data: batch, error: batchError } = await supabase
      .from("feedback_batches")
      .insert({
        project_id: projectId,
        owner_id: user.id,
        filename: file.name,
        source_type: "file",
        total_count: feedbackItems.length,
        valid_count: feedbackItems.length,
        status: "parsed",
      })
      .select()
      .single();

    if (batchError) {
      console.error("Create batch error:", batchError);
      return NextResponse.json(
        { error: "创建上传批次失败" },
        { status: 500 }
      );
    }

    // Insert feedback items
    const itemsToInsert = feedbackItems.map((item) => ({
      project_id: projectId,
      batch_id: batch.id,
      owner_id: user.id,
      raw_content: item.content,
      source: item.source || null,
      user_type: item.user_type || null,
      external_created_at: item.created_at || null,
      is_valid: true,
    }));

    const { error: itemsError } = await supabase
      .from("feedback_items")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("Insert items error:", itemsError);
      return NextResponse.json(
        { error: "保存反馈数据失败" },
        { status: 500 }
      );
    }

    // Return preview (first 10 items)
    const preview = feedbackItems.slice(0, 10).map((item, idx) => ({
      id: `preview-${idx}`,
      raw_content: item.content,
    }));

    return NextResponse.json({
      batch_id: batch.id,
      total_count: feedbackItems.length,
      preview,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    const message =
      error instanceof Error ? error.message : "上传处理失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
