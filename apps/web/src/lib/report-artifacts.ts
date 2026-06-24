import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "../..");

function isValidParam(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function loadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

export interface ArtifactRequest {
  caseName: string;
  type: string;
  segmentId?: string;
}

export interface ArtifactResult {
  filePath?: string;
  buffer?: Buffer;
  contentType: string;
  fileName: string;
  error?: string;
}

function getDatasetName(caseName: string): string {
  const summary = loadJson(
    path.join(ROOT, "runs", caseName, "run-summary.json")
  );
  return summary?.dataset || summary?.datasetName || "";
}

function findFirstMatch(dir: string, pattern: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    const match = files.find((f) => f.endsWith(pattern));
    return match ? path.join(dir, match) : null;
  } catch {
    return null;
  }
}

export function getReportArtifactPath(req: ArtifactRequest): ArtifactResult {
  const { caseName, type, segmentId } = req;

  if (!isValidParam(caseName)) {
    return {
      contentType: "application/json",
      fileName: "error.json",
      error: "Invalid caseName",
    };
  }

  if (segmentId && !isValidParam(segmentId)) {
    return {
      contentType: "application/json",
      fileName: "error.json",
      error: "Invalid segmentId",
    };
  }

  const runDir = path.join(ROOT, "runs", caseName);
  if (!fs.existsSync(runDir)) {
    return {
      contentType: "application/json",
      fileName: "error.json",
      error: "Run not found",
    };
  }

  const dataset = getDatasetName(caseName);

  switch (type) {
    case "overall-md": {
      const p =
        findFirstMatch(
          path.join(runDir, "analysis-md"),
          ".overall.analysis.md"
        ) ||
        findFirstMatch(
          path.join(runDir, "analysis"),
          ".overall.analysis.md"
        );
      if (!p || !fs.existsSync(p))
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "text/markdown; charset=utf-8",
        fileName: `${caseName}.overall.analysis.md`,
      };
    }

    case "overall-json": {
      const p =
        findFirstMatch(
          path.join(runDir, "analysis"),
          ".overall.analysis.json"
        );
      if (!p || !fs.existsSync(p))
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "application/json",
        fileName: `${caseName}.overall.analysis.json`,
      };
    }

    case "segment-json": {
      if (!segmentId)
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "segment parameter required",
        };
      const p = path.join(
        runDir,
        "analysis",
        dataset,
        "segments",
        `${segmentId}.analysis.json`
      );
      if (!fs.existsSync(p))
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "application/json",
        fileName: `${segmentId}.analysis.json`,
      };
    }

    case "segment-md": {
      if (!segmentId)
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "segment parameter required",
        };
      const mdPaths = [
        path.join(
          runDir,
          "analysis-md",
          dataset,
          "segments",
          `${segmentId}.analysis.md`
        ),
        path.join(
          runDir,
          "analysis",
          dataset,
          "segments",
          `${segmentId}.analysis.md`
        ),
      ];
      const p = mdPaths.find((pp) => fs.existsSync(pp));
      if (!p)
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "text/markdown; charset=utf-8",
        fileName: `${segmentId}.analysis.md`,
      };
    }

    case "hard-validation-json": {
      const p = path.join(runDir, "validation-report", "hard-validation.json");
      if (!fs.existsSync(p))
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "application/json",
        fileName: "hard-validation.json",
      };
    }

    case "semantic-validation-json": {
      const p = path.join(
        runDir,
        "validation-report",
        "semantic-validation.json"
      );
      if (!fs.existsSync(p))
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "application/json",
        fileName: "semantic-validation.json",
      };
    }

    case "validation-summary-json": {
      const p = path.join(
        runDir,
        "validation-report",
        "validation-summary.json"
      );
      if (fs.existsSync(p))
        return {
          filePath: p,
          contentType: "application/json",
          fileName: "validation-summary.json",
        };
      const fallback = path.join(runDir, "validation-summary.json");
      if (fs.existsSync(fallback))
        return {
          filePath: fallback,
          contentType: "application/json",
          fileName: "validation-summary.json",
        };
      return {
        contentType: "application/json",
        fileName: "error.json",
        error: "Artifact not found",
      };
    }

    case "evidence-chain-csv": {
      const csvPath = path.join(
        runDir,
        "validation-report",
        "evidence-chain.csv"
      );
      if (fs.existsSync(csvPath))
        return {
          filePath: csvPath,
          contentType: "text/csv; charset=utf-8",
          fileName: `${caseName}.evidence-chain.csv`,
        };
      // Generate CSV dynamically
      const csv = generateEvidenceChainCsv(caseName, dataset);
      return {
        buffer: Buffer.from(csv, "utf-8"),
        contentType: "text/csv; charset=utf-8",
        fileName: `${caseName}.evidence-chain.csv`,
      };
    }

    case "insight-json": {
      if (!segmentId)
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "segment parameter required",
        };
      const p = path.join(
        runDir,
        "insights",
        `${segmentId}.executive-insight.json`
      );
      if (!fs.existsSync(p))
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "application/json",
        fileName: `${segmentId}.executive-insight.json`,
      };
    }

    case "report-insight-json": {
      const p = path.join(
        runDir,
        "insights",
        "report.executive-insight.json"
      );
      if (!fs.existsSync(p))
        return {
          contentType: "application/json",
          fileName: "error.json",
          error: "Artifact not found",
        };
      return {
        filePath: p,
        contentType: "application/json",
        fileName: `${caseName}.report.executive-insight.json`,
      };
    }

    default:
      return {
        contentType: "application/json",
        fileName: "error.json",
        error: `Unknown artifact type: ${type}`,
      };
  }
}

function generateEvidenceChainCsv(caseName: string, dataset: string): string {
  const segmentsDir = path.join(
    ROOT,
    "runs",
    caseName,
    "analysis",
    dataset,
    "segments"
  );
  const rows: string[] = [
    "caseName,segmentId,clusterId,problemTitle,priority,feedbackCount,evidenceIds,traceStatus",
  ];

  if (!fs.existsSync(segmentsDir)) return rows.join("\n");

  const segFiles = fs
    .readdirSync(segmentsDir)
    .filter((f) => f.endsWith(".analysis.json"));

  for (const f of segFiles) {
    const seg = loadJson(path.join(segmentsDir, f));
    if (!seg?.issue_clusters) continue;
    const segId = seg.segment_id || f.replace(".analysis.json", "");

    for (const c of seg.issue_clusters) {
      const title = c.name || c.title || c.cluster_id || "Unknown";
      const ids = (c.evidence_feedback_ids || []).join(";");
      const status =
        (c.evidence_feedback_ids || []).length > 0 ? "pass" : "missing";
      rows.push(
        [
          caseName,
          segId,
          c.cluster_id || "",
          `"${title.replace(/"/g, '""')}"`,
          c.priority || "P2",
          c.feedback_count || 0,
          `"${ids}"`,
          status,
        ].join(",")
      );
    }
  }

  return rows.join("\n");
}

export function getZipBuffer(caseName: string): Buffer | null {
  // Dynamic import to avoid adding to bundle for non-zip requests
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AdmZip = require("adm-zip") as typeof import("adm-zip");
  const zip = new AdmZip();

  const runDir = path.join(ROOT, "runs", caseName);
  if (!fs.existsSync(runDir)) return null;

  const addDirToZip = (dirPath: string, zipPath: string) => {
    if (!fs.existsSync(dirPath)) return;
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const entryPath = `${zipPath}/${item.name}`;
      if (item.isDirectory()) {
        addDirToZip(fullPath, entryPath);
      } else {
        zip.addLocalFile(fullPath, path.dirname(entryPath));
      }
    }
  };

  // Add run-summary.json
  const summaryPath = path.join(runDir, "run-summary.json");
  if (fs.existsSync(summaryPath)) {
    zip.addLocalFile(summaryPath, "");
  }

  // Add directories
  const dirs = ["input", "normalized", "analysis", "analysis-md", "validation-report"];
  for (const d of dirs) {
    addDirToZip(path.join(runDir, d), d);
  }

  // Add insights if they exist
  addDirToZip(path.join(runDir, "insights"), "insights");

  return zip.toBuffer();
}
