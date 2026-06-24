import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");

export async function GET() {
  let datasets = { totalDatasets: 0, acceptedCount: 0, totalFeedbacks: 0 };
  let runs: any[] = [];

  try {
    const idx = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "training-data/dataset-index.json"),
        "utf-8"
      )
    );
    datasets = {
      totalDatasets: idx.totalDatasets,
      acceptedCount: idx.acceptedCount,
      totalFeedbacks: idx.totalFeedbacks,
    };
  } catch {}

  try {
    const runsDir = path.join(ROOT, "runs");
    if (fs.existsSync(runsDir)) {
      for (const d of fs.readdirSync(runsDir)) {
        const summaryPath = path.join(runsDir, d, "run-summary.json");
        if (!fs.existsSync(summaryPath)) continue;
        try {
          const s = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
          if (!(s.case_name || s.caseName)) continue;
          const date = s.startedAt || s.finishedAt || s.timestamp || s.date || null;
          runs.push({
            case_name: s.case_name || s.caseName,
            dataset: s.dataset || s.datasetName,
            count: s.count || s.rawCount,
            status: s.status,
            validation: s.validation,
            hardValidation: s.hardValidation,
            semanticValidation: s.semanticValidation,
            timestamp: date,
          });
        } catch {}
      }
    }
  } catch {}

  runs.sort(
    (a, b) =>
      new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );

  return NextResponse.json({ datasets, runs });
}
