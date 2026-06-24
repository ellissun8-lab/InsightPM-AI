import { NextResponse } from "next/server";
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
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .eq("owner_id", user.id)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: "报告不存在或无权限" },
        { status: 404 }
      );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
