import { NextRequest, NextResponse } from "next/server";
import { getStorageMode } from "@/lib/data/storage-mode";

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

    // Cloud 模式：不执行本地 pipeline
    if (mode === "cloud") {
      const run = {
        case_name: caseName,
        dataset: dataset || "mixed-feedback",
        count: count || 124,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return NextResponse.json({
        ok: true,
        mode: "cloud",
        message: "Cloud analysis worker is not implemented yet.",
        run,
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
