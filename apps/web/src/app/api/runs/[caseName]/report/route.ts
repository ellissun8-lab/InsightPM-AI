import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");

export async function GET(
  _req: NextRequest,
  { params }: { params: { caseName: string } }
) {
  try {
    const { caseName } = params;
    const runDir = path.join(ROOT, "runs", caseName);
    const summaryPath = path.join(runDir, "run-summary.json");

    if (!fs.existsSync(summaryPath)) {
      return NextResponse.json({ error: "运行不存在" }, { status: 404 });
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    const dataset = summary.dataset || "mixed-feedback";

    // Try to load overall analysis MD
    const mdDir = path.join(runDir, "analysis-md");
    let overallMd: string | null = null;

    if (fs.existsSync(mdDir)) {
      const mdFiles = fs
        .readdirSync(mdDir)
        .filter((f) => f.endsWith(".overall.analysis.md"));
      if (mdFiles.length > 0) {
        try {
          overallMd = fs.readFileSync(
            path.join(mdDir, mdFiles[0]),
            "utf-8"
          );
        } catch {}
      }
    }

    // Try overall JSON
    const overallJsonPath = path.join(
      runDir,
      "analysis",
      `${dataset}.overall.analysis.json`
    );
    const overallJson = loadJson(overallJsonPath);

    // Try segments.json
    const segmentsPath = path.join(
      runDir,
      "analysis",
      `${dataset}.segments.json`
    );
    const segments = loadJson(segmentsPath);

    return NextResponse.json({
      overallMd,
      overallJson,
      segments,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function loadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}
