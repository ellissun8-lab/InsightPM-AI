import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("未登录", { status: 401 });
    }

    const { data: report, error } = await supabase
      .from("reports")
      .select("title, content_markdown")
      .eq("id", reportId)
      .eq("owner_id", user.id)
      .single();

    if (error || !report) {
      return new Response("报告不存在或无权限", { status: 404 });
    }

    // Return as downloadable markdown file
    const filename = `${report.title || "report"}.md`;

    return new Response(report.content_markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return new Response("服务器错误", { status: 500 });
  }
}
