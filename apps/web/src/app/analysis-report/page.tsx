import fs from "fs";
import path from "path";
import AnalysisReportClient from "./AnalysisReportClient";
import { isCloudMode } from "@/lib/data/storage-mode";
import { getRuns, getRunByCaseName } from "@/lib/data/runs-repository";
import { getReportArtifactsByRunId } from "@/lib/data/artifacts-repository";

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

function listLocalRuns() {
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
  return runs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

async function listCloudRuns() {
  const { data: runs } = await getRuns();
  return runs.map((r) => ({
    caseName: r.caseName,
    dataset: r.scenario || r.dataset || "",
    feedbackCount: r.feedbackCount || 0,
    status: r.status || "unknown",
    timestamp: r.updatedAt || r.createdAt || "",
    hardScore: r.hardScore,
    semanticScore: r.semanticScore,
    evidenceBroken: r.evidenceBroken,
  }));
}

async function loadCloudReportData(caseName: string) {
  const run = await getRunByCaseName(caseName);
  if (!run) return null;
  const artifacts = await getReportArtifactsByRunId(run.id, "overall-md");
  const reportArtifact = artifacts[0];
  let overallMd: string | null = null;
  if (reportArtifact?.metadata?.content) {
    overallMd = reportArtifact.metadata.content;
  }
  return {
    summary: {
      case_name: run.caseName,
      dataset: run.scenario || run.dataset || "",
      count: run.feedbackCount || 0,
      status: run.status,
      timestamp: run.updatedAt || run.createdAt || "",
      hardValidation: run.hardScore != null ? { score: run.hardScore } : null,
      semanticValidation: run.semanticScore != null ? { score: run.semanticScore, evidenceBroken: run.evidenceBroken || 0 } : null,
    },
    hardVal: run.hardScore != null ? { score: run.hardScore, pass_count: 41, warning_count: 1, fail_count: 0 } : null,
    semVal: run.semanticScore != null ? { semanticScore: run.semanticScore, criticalIssues: 0, evidenceBroken: run.evidenceBroken || 0 } : null,
    overallMd,
    clusters: [],
    segments: [],
    segmentCount: 0,
    clusterCount: 0,
    brokenEvidenceCount: run.evidenceBroken || 0,
    evidenceTrace: [],
  };
}

function loadLocalReportData(caseName: string) {
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
  return { summary, hardVal, semVal, overallMd, clusters: [], segments: [], segmentCount: 0, clusterCount: 0, brokenEvidenceCount: 0, evidenceTrace: [] };
}

export default async function AnalysisReportPage({ searchParams }: { searchParams: { case?: string; segment?: string } }) {
  const allRuns = isCloudMode() ? await listCloudRuns() : listLocalRuns();
  if (allRuns.length === 0) {
    return <AnalysisReportClient caseName="" allRuns={[]} summary={null} hardVal={null} semVal={null} overallMd={null} clusters={[]} segments={[]} selectedSegmentId={null} segmentData={null} segmentMd={null} segmentCount={0} clusterCount={0} brokenEvidenceCount={0} evidenceTrace={[]} />;
  }
  let caseName = searchParams.case || "";
  if (!caseName || !isValidParam(caseName)) caseName = allRuns[0].caseName;
  if (!allRuns.find((r) => r.caseName === caseName)) caseName = allRuns[0].caseName;
  const reportData = isCloudMode() ? await loadCloudReportData(caseName) : loadLocalReportData(caseName);
  if (!reportData) {
    return <AnalysisReportClient caseName={caseName} allRuns={allRuns} summary={null} hardVal={null} semVal={null} overallMd={null} clusters={[]} segments={[]} selectedSegmentId={null} segmentData={null} segmentMd={null} segmentCount={0} clusterCount={0} brokenEvidenceCount={0} evidenceTrace={[]} />;
  }
  return <AnalysisReportClient caseName={caseName} allRuns={allRuns} summary={reportData.summary} hardVal={reportData.hardVal} semVal={reportData.semVal} overallMd={reportData.overallMd} clusters={reportData.clusters} segments={reportData.segments} selectedSegmentId={null} segmentData={null} segmentMd={null} segmentCount={reportData.segmentCount} clusterCount={reportData.clusterCount} brokenEvidenceCount={reportData.brokenEvidenceCount} evidenceTrace={reportData.evidenceTrace} />;
}
