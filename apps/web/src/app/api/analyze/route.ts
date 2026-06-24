import { NextRequest, NextResponse } from "next/server";
import { getStorageMode } from "@/lib/data/storage-mode";
import { createRun } from "@/lib/data/runs-repository";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseName, dataset, count } = body;

    if (!caseName) {
      return NextResponse.json(
        { error: "缺少 caseName" },
        { status: 400 }
      );
    }

    const mode = getStorageMode();

    // Cloud 模式：创建 pending run 记录到 Supabase
    if (mode === "cloud") {
      const { data: run, error: createError } = await createRun({
        case_name: caseName,
        dataset: dataset || "mixed-feedback",
        count: count || 0,
        status: "pending",
        metadata: {
          mode: "cloud",
          source: "vercel",
          message: "Cloud analysis worker is not implemented yet.",
        },
      });

      if (createError || !run) {
        console.error("createRun failed:", createError);
        return NextResponse.json(
          {
            ok: false,
            mode: "cloud",
            error: "创建分析任务失败",
            detail: createError?.message || "Unknown error",
            code: createError?.code,
            hint: createError?.hint,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        mode: "cloud",
        status: "pending",
        message: "线上分析任务已创建，后台分析 Worker 将在后续版本启用。",
        run: {
          caseName: run.case_name,
          scenario: run.dataset,
          status: run.status,
          feedbackCount: run.count,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
        },
      });
    }

    // Local 模式：执行本地 pipeline
    const { execSync } = await import("child_process");
    const path = await import("path");
    const ROOT = path.resolve(process.cwd(), "../..");

    const scriptPath = path.join(ROOT, "scripts", "run-pipeline.ts");
    const cmd = `tsx "${scriptPath}" --case ${caseName} --dataset ${dataset || "mixed-feedback"} --count ${count || 124}`;

    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 300000, // 5 minutes
      stdio: ["pipe", "pipe", "pipe"],
    });

    // 读取 run summary
    const summaryPath = path.join(ROOT, "runs", caseName, "run-summary.json");
    let summary: any = null;
    try {
      const fs = await import("fs");
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    } catch {}

    return NextResponse.json({
      ok: true,
      mode: "local",
      caseName,
      output: output.slice(-2000),
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message,
        stderr: err.stderr?.toString()?.slice(-2000),
      },
      { status: 500 }
    );
  }
}
