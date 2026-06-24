import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");

const TYPE_MAP: Record<string, (runDir: string, dataset: string, segmentId?: string) => string> = {
  "overall-md": (runDir, dataset) => {
    const mdDir = path.join(runDir, "analysis-md");
    if (!fs.existsSync(mdDir)) return "";
    const files = fs.readdirSync(mdDir).filter((f) => f.endsWith(".overall.analysis.md"));
    return files.length > 0 ? path.join(mdDir, files[0]) : "";
  },
  "overall-json": (runDir, dataset) =>
    path.join(runDir, "analysis", `${dataset}.overall.analysis.json`),
  "segments-json": (runDir, dataset) =>
    path.join(runDir, "analysis", `${dataset}.segments.json`),
  "hard-validation": (runDir) =>
    path.join(runDir, "validation-report", "hard-validation.json"),
  "semantic-validation": (runDir) =>
    path.join(runDir, "validation-report", "semantic-validation.json"),
  "segment-analysis": (runDir, dataset, segmentId) =>
    path.join(runDir, "analysis", dataset, "segments", `${segmentId}.analysis.json`),
  "segment-md": (runDir, dataset, segmentId) =>
    path.join(runDir, "analysis-md", dataset, "segments", `${segmentId}.analysis.md`),
};

export async function GET(
  req: NextRequest,
  { params }: { params: { caseName: string } }
) {
  try {
    const { caseName } = params;
    const type = req.nextUrl.searchParams.get("type") || "overall-md";
    const segmentId = req.nextUrl.searchParams.get("segmentId");

    const runDir = path.join(ROOT, "runs", caseName);
    const summaryPath = path.join(runDir, "run-summary.json");

    if (!fs.existsSync(summaryPath)) {
      return NextResponse.json({ error: "运行不存在" }, { status: 404 });
    }

    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    const dataset = summary.dataset || "mixed-feedback";

    const resolver = TYPE_MAP[type];
    if (!resolver) {
      return NextResponse.json(
        { error: `未知 type: ${type}. 可选: ${Object.keys(TYPE_MAP).join(", ")}` },
        { status: 400 }
      );
    }

    const filePath = resolver(runDir, dataset, segmentId || "");

    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }

    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      ext === ".json"
        ? "application/json"
        : ext === ".md"
        ? "text/markdown"
        : "text/plain";

    const filename = path.basename(filePath);

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
