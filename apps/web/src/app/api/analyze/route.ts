import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");

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

    const scriptPath = path.join(ROOT, "scripts", "run-pipeline.ts");

    const cmd = `tsx "${scriptPath}" --case ${caseName} --dataset ${dataset || "mixed-feedback"} --count ${count || 124}`;

    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 300000, // 5 minutes
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Try to read run summary
    const summaryPath = path.join(ROOT, "runs", caseName, "run-summary.json");
    let summary: any = null;
    try {
      summary = JSON.parse(
        require("fs").readFileSync(summaryPath, "utf-8")
      );
    } catch {}

    return NextResponse.json({
      ok: true,
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
