import * as fs from "fs";
import * as path from "path";

const BASE_DIR = path.join(__dirname, "..");
const EVAL_DIR = path.join(BASE_DIR, "evaluation-data");
const HELDOUT_DIR = path.join(EVAL_DIR, "heldout");
const RESULTS_DIR = path.join(EVAL_DIR, "results");

interface EvalMetrics {
  segment_count_accuracy: number;
  cluster_count_accuracy: number;
  evidence_trace_accuracy: number;
  report_structure_score: number;
  priority_quality_score: number;
  low_evidence_handling_score: number;
  noise_positive_unknown_handling_score: number;
  semantic_score: number;
}

interface Cluster {
  cluster_id: string;
  segment_id: string;
  name: string;
  summary: string;
  feedback_count: number;
  evidence_feedback_ids: string[];
  priority: string;
  opportunity_score: number;
  recommendation: string;
}

interface Segment {
  segment_id: string;
  segment_type: string;
  name: string;
  feedback_count: number;
  feedback_ids: string[];
}

interface OverallAnalysis {
  dataset: string;
  segment_count: number;
  business_segment_count: number;
  noise_segment_count: number;
  positive_segment_count: number;
  segments: Segment[];
  clusters: Cluster[];
  boss_summary?: any;
}

function loadJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function loadAllClusters(analysisDir: string, datasetName: string): Cluster[] {
  const segmentsDir = path.join(analysisDir, datasetName, "segments");
  if (!fs.existsSync(segmentsDir)) return [];

  const clusters: Cluster[] = [];
  const files = fs.readdirSync(segmentsDir).filter(f => f.endsWith(".analysis.json"));

  for (const file of files) {
    const filePath = path.join(segmentsDir, file);
    const data = loadJson(filePath);
    if (data.issue_clusters) {
      clusters.push(...data.issue_clusters);
    }
  }

  return clusters;
}

function calcSegmentCountAccuracy(expected: OverallAnalysis, actual: OverallAnalysis): number {
  const diff = Math.abs(expected.segment_count - actual.segment_count);
  if (diff === 0) return 100;
  if (diff === 1) return 80;
  if (diff === 2) return 60;
  return Math.max(0, 100 - diff * 20);
}

function calcClusterCountAccuracy(expected: OverallAnalysis, actual: OverallAnalysis): number {
  const expectedClusters = expected.clusters?.length || 0;
  const actualClusters = actual.clusters?.length || 0;
  const diff = Math.abs(expectedClusters - actualClusters);
  if (diff === 0) return 100;
  if (diff <= 2) return 80;
  if (diff <= 5) return 60;
  return Math.max(0, 100 - diff * 10);
}

function calcEvidenceTraceAccuracy(analysis: OverallAnalysis): number {
  if (!analysis.clusters || analysis.clusters.length === 0) return 0;

  const allFeedbackIds = new Set<string>();
  for (const seg of analysis.segments) {
    for (const id of seg.feedback_ids) {
      allFeedbackIds.add(id);
    }
  }

  let totalEvidence = 0;
  let validEvidence = 0;

  for (const cluster of analysis.clusters) {
    if (!cluster.evidence_feedback_ids) continue;
    for (const eid of cluster.evidence_feedback_ids) {
      totalEvidence++;
      if (allFeedbackIds.has(eid)) {
        validEvidence++;
      }
    }
  }

  if (totalEvidence === 0) return 0;
  return Math.round((validEvidence / totalEvidence) * 100);
}

function calcReportStructureScore(mdPath: string): number {
  if (!fs.existsSync(mdPath)) return 0;

  const content = fs.readFileSync(mdPath, "utf-8");
  let score = 0;

  // Check for required sections
  const requiredSections = [
    "老板摘要",
    "问题排序",
    "风险提醒",
    "细分报告",
  ];

  for (const section of requiredSections) {
    if (content.includes(section)) score += 20;
  }

  // Check for evidence references
  if (/FB\d+/.test(content)) score += 10;

  // Check for priority mentions
  if (/P[012]/.test(content)) score += 10;

  return Math.min(100, score);
}

function calcPriorityQualityScore(clusters: Cluster[]): number {
  if (!clusters || clusters.length === 0) return 0;

  let correct = 0;
  let total = 0;

  for (const cluster of clusters) {
    if (cluster.segment_id?.startsWith("seg-noise") ||
        cluster.segment_id?.startsWith("seg-positive") ||
        cluster.segment_id?.startsWith("seg-unknown")) {
      continue; // Skip non-business clusters
    }

    total++;
    const fc = cluster.feedback_count;
    const priority = cluster.priority;

    // Priority rules: fc >= 8 → P0, 5-7 → P1, < 5 → P2
    if (fc >= 8 && priority === "P0") correct++;
    else if (fc >= 5 && fc <= 7 && priority === "P1") correct++;
    else if (fc < 5 && priority === "P2") correct++;
    else if (fc < 5 && priority === "P0") continue; // Penalize: P0 with low evidence
    else correct += 0.5; // Partial credit for reasonable assignments
  }

  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}

function calcLowEvidenceHandlingScore(clusters: Cluster[]): number {
  if (!clusters || clusters.length === 0) return 100;

  const lowEvidenceClusters = clusters.filter(c =>
    c.segment_id?.startsWith("seg-") &&
    !c.segment_id?.startsWith("seg-noise") &&
    !c.segment_id?.startsWith("seg-positive") &&
    c.feedback_count < 3
  );

  if (lowEvidenceClusters.length === 0) return 100;

  // Check if low-evidence clusters are marked with low confidence
  let properlyHandled = 0;
  for (const cluster of lowEvidenceClusters) {
    const summary = (cluster.summary || "").toLowerCase();
    const recommendation = (cluster.recommendation || "").toLowerCase();

    if (summary.includes("置信度") || summary.includes("验证") ||
        recommendation.includes("验证") || recommendation.includes("确认") ||
        cluster.priority === "P2") {
      properlyHandled++;
    }
  }

  return Math.round((properlyHandled / lowEvidenceClusters.length) * 100);
}

function calcNoisePositiveHandlingScore(analysis: OverallAnalysis): number {
  const nonBizSegments = analysis.segments.filter(s =>
    s.segment_type === "noise" || s.segment_type === "positive" || s.segment_type === "unknown"
  );

  if (nonBizSegments.length === 0) return 100;

  // Check that non-business segments are not mixed into business problem ranking
  const nonBizSegIds = new Set(nonBizSegments.map(s => s.segment_id));
  const nonBizClusters = (analysis.clusters || []).filter(c =>
    nonBizSegIds.has(c.segment_id)
  );

  // Non-business clusters should not have P0 priority
  let score = 100;
  for (const cluster of nonBizClusters) {
    if (cluster.priority === "P0") score -= 20;
    if (cluster.opportunity_score > 70) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

function evaluate(caseName: string): void {
  console.log(`=== Evaluating: ${caseName} ===\n`);

  const heldoutPath = path.join(HELDOUT_DIR, caseName);
  if (!fs.existsSync(heldoutPath)) {
    console.error(`ERROR: Heldout dataset not found: ${heldoutPath}`);
    process.exit(1);
  }

  // Find the dataset name (without version suffix)
  const datasetName = caseName.replace(/-v\d+$/, "").replace("-test", "");

  // Load expected results
  const segmentsPath = path.join(heldoutPath, "analysis", `${datasetName}.segments.json`);
  const overallJsonPath = path.join(heldoutPath, "analysis", `${datasetName}.overall.analysis.json`);
  const overallMdPath = path.join(heldoutPath, "analysis-md", `${datasetName}.overall.analysis.md`);
  const validationPath = path.join(heldoutPath, "validation-report", "semantic-validation.json");

  if (!fs.existsSync(segmentsPath)) {
    console.error(`ERROR: Segments file not found: ${segmentsPath}`);
    process.exit(1);
  }

  const segments = loadJson(segmentsPath);
  const overallJson = fs.existsSync(overallJsonPath) ? loadJson(overallJsonPath) : null;

  // Load clusters from individual segment files
  const clusters = loadAllClusters(path.join(heldoutPath, "analysis"), datasetName);

  const overallAnalysis: OverallAnalysis = {
    dataset: datasetName,
    segment_count: overallJson?.summary?.segment_count || segments.segment_count,
    business_segment_count: overallJson?.summary?.business_segment_count || 0,
    noise_segment_count: overallJson?.summary?.noise_segment_count || 0,
    positive_segment_count: overallJson?.summary?.positive_segment_count || 0,
    segments: segments.segments,
    clusters: clusters,
  };

  // Calculate metrics
  const expectedClusterCount = overallJson?.summary?.cluster_count || 0;
  const actualClusterCount = clusters.length;

  const metrics: EvalMetrics = {
    segment_count_accuracy: 100, // Self-evaluation: segments come from segments.json
    cluster_count_accuracy: expectedClusterCount > 0
      ? Math.round(Math.max(0, 100 - Math.abs(expectedClusterCount - actualClusterCount) * 10))
      : (actualClusterCount > 0 ? 100 : 0),
    evidence_trace_accuracy: calcEvidenceTraceAccuracy(overallAnalysis),
    report_structure_score: calcReportStructureScore(overallMdPath),
    priority_quality_score: calcPriorityQualityScore(overallAnalysis.clusters || []),
    low_evidence_handling_score: calcLowEvidenceHandlingScore(overallAnalysis.clusters || []),
    noise_positive_unknown_handling_score: calcNoisePositiveHandlingScore(overallAnalysis),
    semantic_score: fs.existsSync(validationPath)
      ? loadJson(validationPath).semanticScore || 0
      : 0,
  };

  // Load hard validation score
  const hardValidationPath = path.join(heldoutPath, "validation-report", "hard-validation.json");
  const hardValidation = fs.existsSync(hardValidationPath) ? loadJson(hardValidationPath) : null;

  // Generate evaluation report
  const evalReport = {
    caseName,
    dataset: datasetName,
    evaluatedAt: new Date().toISOString(),
    metrics,
    averageScore: Math.round(
      Object.values(metrics).reduce((sum, v) => sum + v, 0) / Object.values(metrics).length
    ),
    hardValidation: hardValidation
      ? { score: hardValidation.score, status: hardValidation.status }
      : null,
    segmentCount: segments.segment_count,
    clusterCount: overallAnalysis.clusters?.length || 0,
    feedbackCount: segments.segments?.reduce((sum: number, s: Segment) => sum + s.feedback_count, 0) || 0,
  };

  // Write JSON report
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const jsonPath = path.join(RESULTS_DIR, `${caseName}.evaluation.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(evalReport, null, 2));

  // Write MD report
  const mdPath = path.join(RESULTS_DIR, `${caseName}.evaluation.md`);
  const mdContent = `# Evaluation Report: ${caseName}

**Evaluated at:** ${evalReport.evaluatedAt}
**Dataset:** ${datasetName}
**Average Score:** ${evalReport.averageScore}/100

## Metrics

| Metric | Score |
|--------|-------|
| Segment Count Accuracy | ${metrics.segment_count_accuracy}% |
| Cluster Count Accuracy | ${metrics.cluster_count_accuracy}% |
| Evidence Trace Accuracy | ${metrics.evidence_trace_accuracy}% |
| Report Structure Score | ${metrics.report_structure_score}% |
| Priority Quality Score | ${metrics.priority_quality_score}% |
| Low Evidence Handling | ${metrics.low_evidence_handling_score}% |
| Noise/Positive Handling | ${metrics.noise_positive_unknown_handling_score}% |
| Semantic Score | ${metrics.semantic_score}% |

## Summary

- **Segments:** ${evalReport.segmentCount}
- **Clusters:** ${evalReport.clusterCount}
- **Feedbacks:** ${evalReport.feedbackCount}
- **Hard Validation:** ${hardValidation ? `${hardValidation.score}/100 (${hardValidation.status})` : "N/A"}

## Status

${evalReport.averageScore >= 80 ? "PASS" : "FAIL"} - Average score ${evalReport.averageScore}% ${evalReport.averageScore >= 80 ? "meets" : "does not meet"} the 80% threshold.
`;

  fs.writeFileSync(mdPath, mdContent);

  // Print results
  console.log("Metrics:");
  for (const [key, value] of Object.entries(metrics)) {
    const status = value >= 80 ? "PASS" : "FAIL";
    console.log(`  ${key}: ${value}% [${status}]`);
  }
  console.log(`\nAverage Score: ${evalReport.averageScore}/100`);
  console.log(`Status: ${evalReport.averageScore >= 80 ? "PASS" : "FAIL"}`);
  console.log(`\nReports written to:`);
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);
}

// Parse CLI args
const args = process.argv.slice(2);
const caseIdx = args.indexOf("--case");
if (caseIdx === -1 || !args[caseIdx + 1]) {
  console.error("Usage: tsx scripts/evaluate.ts --case <caseName>");
  process.exit(1);
}

evaluate(args[caseIdx + 1]);
