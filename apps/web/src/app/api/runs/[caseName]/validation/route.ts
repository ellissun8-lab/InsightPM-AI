import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");

function loadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { caseName: string } }
) {
  try {
    const { caseName } = params;
    const runDir = path.join(ROOT, "runs", caseName);

    if (!fs.existsSync(runDir)) {
      return NextResponse.json({ error: "运行不存在" }, { status: 404 });
    }

    const hardVal = loadJson(
      path.join(runDir, "validation-report", "hard-validation.json")
    );
    const semVal = loadJson(
      path.join(runDir, "validation-report", "semantic-validation.json")
    );

    return NextResponse.json({ hardVal, semVal });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
