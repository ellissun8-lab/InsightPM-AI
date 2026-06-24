import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import PrintReportClient from "./PrintReportClient";

const ROOT = path.resolve(process.cwd(), "../..");

function loadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function loadMd(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

function isValidParam(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function listRuns() {
  const runsDir = path.join(ROOT, "runs");
  if (!fs.existsSync(runsDir)) return [];
  const runs: any[] = [];
  for (const d of fs.readdirSync(runsDir)) {
    const summary = loadJson(path.join(runsDir, d, "run-summary.json"));
    if (!summary) continue;
    const name = summary.case_name || summary.caseName;
    if (!name) continue;
    runs.push({
      caseName: name,
      dataset: summary.dataset || summary.datasetName || "",
      feedbackCount: summary.count || summary.rawCount || 0,
      status: summary.status || "unknown",
      timestamp: summary.timestamp || summary.startedAt || "",
    });
  }
  return runs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function loadReportData(caseName: string) {
  const runDir = path.join(ROOT, "runs", caseName);
  if (!fs.existsSync(runDir)) return null;
  const summary = loadJson(path.join(runDir, "run-summary.json"));
  if (!summary) return null;
  const dataset = summary.dataset || summary.datasetName || "";
  const hardVal = loadJson(path.join(runDir, "validation-report", "hard-validation.json"));
  const semVal = loadJson(path.join(runDir, "validation-report", "semantic-validation.json"));

  let overallMd: string | null = null;
  const mdDir = path.join(runDir, "analysis-md");
  if (fs.existsSync(mdDir)) {
    const mdFiles = fs.readdirSync(mdDir).filter((f: string) => f.endsWith(".overall.analysis.md"));
    if (mdFiles.length > 0) overallMd = loadMd(path.join(mdDir, mdFiles[0]));
  }

  const segmentsJsonPath = path.join(runDir, "analysis", `${dataset}.segments.json`);
  const segmentsJson = loadJson(segmentsJsonPath);
  const segmentList: any[] = segmentsJson?.segments || [];
  const segments = segmentList.map((s: any) => ({
    segmentId: s.segment_id || "",
    name: s.name || s.segment_id || "",
    type: s.segment_type || "unknown",
    businessGoal: s.business_goal || "",
    feedbackCount: s.feedback_count || 0,
  }));

  const segmentsDir = path.join(runDir, "analysis", dataset, "segments");
  let clusters: any[] = [];
  let brokenEvidenceCount = 0;
  const evidenceTrace: any[] = [];

  if (fs.existsSync(segmentsDir)) {
    const segFiles = fs.readdirSync(segmentsDir).filter((f: string) => f.endsWith(".analysis.json"));
    for (const f of segFiles) {
      const seg = loadJson(path.join(segmentsDir, f));
      const segName = seg?.segment_name || seg?.name || f.replace(".analysis.json", "");
      if (seg?.issue_clusters) {
        for (const c of seg.issue_clusters) {
          clusters.push({
            cluster_id: c.cluster_id,
            name: c.name || c.title || c.cluster_id,
            summary: c.summary || "",
            feedback_count: c.feedback_count || 0,
            evidence_feedback_ids: c.evidence_feedback_ids || [],
            priority: c.priority || "P2",
            opportunity_score: c.opportunity_score || 0,
            recommendation: c.recommendation || "",
            impact: c.impact || "",
            action: c.action || "",
            score: c.opportunity_score || c.score || 0,
            segment_name: segName,
            segment_id: seg?.segment_id || "",
          });
          const evCount = (c.evidence_feedback_ids || []).length;
          if (evCount === 0 && (c.feedback_count || 0) > 0) brokenEvidenceCount++;
          evidenceTrace.push({
            segment: segName,
            cluster: c.name || c.title || c.cluster_id,
            evidenceIds: c.evidence_feedback_ids || [],
            count: evCount,
            excerpt: c.representative_quote || c.evidence?.[0]?.text || c.summary || "",
            status: evCount >= 2 ? "Pass" : "Needs Validation",
          });
        }
      }
    }
  }

  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  clusters.sort((a: any, b: any) => {
    const pa = priorityOrder[a.priority] ?? 4;
    const pb = priorityOrder[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.opportunity_score || b.score || 0) - (a.opportunity_score || a.score || 0);
  });

  return { summary, hardVal, semVal, overallMd, clusters, segments, segmentCount: segments.length, clusterCount: clusters.length, brokenEvidenceCount, evidenceTrace };
}

export default async function PrintReportPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; segment?: string }>;
}) {
  const params = await searchParams;
  const allRuns = listRuns();
  if (allRuns.length === 0) notFound();

  let caseName = params.case || "";
  if (!caseName || !isValidParam(caseName)) caseName = allRuns[0].caseName;
  if (!allRuns.find((r) => r.caseName === caseName)) caseName = allRuns[0].caseName;

  const reportData = loadReportData(caseName);
  if (!reportData) notFound();

  const dataset = reportData.summary?.dataset || reportData.summary?.datasetName || "";
  let segmentId = params.segment || "";
  if (!segmentId || !isValidParam(segmentId)) segmentId = reportData.segments[0]?.segmentId || "";
  if (!reportData.segments.find((s: any) => s.segmentId === segmentId)) segmentId = reportData.segments[0]?.segmentId || "";

  return (
    <PrintReportClient
      caseName={caseName}
      dataset={dataset}
      summary={reportData.summary}
      hardVal={reportData.hardVal}
      semVal={reportData.semVal}
      overallMd={reportData.overallMd}
      clusters={reportData.clusters}
      segments={reportData.segments}
      selectedSegmentId={segmentId || null}
      segmentCount={reportData.segmentCount}
      clusterCount={reportData.clusterCount}
      brokenEvidenceCount={reportData.brokenEvidenceCount}
      evidenceTrace={reportData.evidenceTrace}
      feedbackCount={reportData.summary?.count || reportData.summary?.rawCount || 0}
    />
  );
}
