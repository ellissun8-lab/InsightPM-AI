import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const projectSchema = z.object({
  name: z.string().min(1, "项目名称不能为空"),
  product_type: z.string().optional(),
  business_goal: z.string().optional(),
  target_user: z.string().optional(),
  key_metric: z.string().optional(),
  description: z.string().optional(),
});

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
    const validation = projectSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || "参数错误";
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        ...validation.data,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Create project error:", error);
      return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
    }

    return NextResponse.json({ id: project.id });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { data: projects, error } = await supabase
      .from("projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Get projects error:", error);
      return NextResponse.json({ error: "获取项目失败" }, { status: 500 });
    }

    return NextResponse.json(projects);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
