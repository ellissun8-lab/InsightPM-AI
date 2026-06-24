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
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json([]);
    }

    const ids = idsParam.split(",").filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json([]);
    }

    const { data: items, error } = await supabase
      .from("feedback_items")
      .select("id, raw_content, ai_summary, sentiment, feedback_type")
      .in("id", ids)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Get feedback items error:", error);
      return NextResponse.json(
        { error: "获取反馈失败" },
        { status: 500 }
      );
    }

    return NextResponse.json(items || []);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
