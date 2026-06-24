import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const caseName = formData.get("caseName") as string | null;
    const dataset = (formData.get("dataset") as string) || "mixed-feedback";

    if (!file || !caseName) {
      return NextResponse.json(
        { error: "缺少文件或 caseName" },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9-]+$/.test(caseName)) {
      return NextResponse.json(
        { error: "caseName 只能包含小写字母、数字和连字符" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "文件大小超过 10MB 限制" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "仅支持 CSV 文件" },
        { status: 400 }
      );
    }

    const runDir = path.join(ROOT, "runs", caseName);
    const inputDir = path.join(runDir, "input");
    fs.mkdirSync(inputDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(inputDir, "raw-feedback.csv"), buffer);

    return NextResponse.json({
      ok: true,
      caseName,
      dataset,
      filename: file.name,
      size: file.size,
      path: `runs/${caseName}/input/raw-feedback.csv`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
