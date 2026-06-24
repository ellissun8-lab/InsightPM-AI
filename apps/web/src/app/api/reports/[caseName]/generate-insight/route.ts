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

function isValidParam(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function getDatasetName(caseName: string): string {
  const summary = loadJson(
    path.join(ROOT, "runs", caseName, "run-summary.json")
  );
  return summary?.dataset || summary?.datasetName || "";
}

function generateReportInsight(caseName: string) {
  const runDir = path.join(ROOT, "runs", caseName);
  const dataset = getDatasetName(caseName);

  // Load all data sources
  const hardVal = loadJson(
    path.join(runDir, "validation-report", "hard-validation.json")
  );
  const semVal = loadJson(
    path.join(runDir, "validation-report", "semantic-validation.json")
  );
  const overallJson = loadJson(
    path.join(runDir, "analysis", `${dataset}.overall.analysis.json`)
  );
  const segmentsJson = loadJson(
    path.join(runDir, "analysis", `${dataset}.segments.json`)
  );

  // Load all segment analysis files
  const segmentsDir = path.join(runDir, "analysis", dataset, "segments");
  const allClusters: any[] = [];
  const segmentSummaries: any[] = [];

  if (fs.existsSync(segmentsDir)) {
    const segFiles = fs
      .readdirSync(segmentsDir)
      .filter((f: string) => f.endsWith(".analysis.json"));

    for (const f of segFiles) {
      const seg = loadJson(path.join(segmentsDir, f));
      if (!seg) continue;

      const segId = seg.segment_id || f.replace(".analysis.json", "");
      const segName =
        segmentsJson?.segments?.find((s: any) => s.segment_id === segId)
          ?.name || segId;

      segmentSummaries.push({
        segmentId: segId,
        name: segName,
        type: seg.segment_type || "unknown",
        feedbackCount: seg.summary?.feedback_count || 0,
        clusterCount: seg.summary?.cluster_count || 0,
      });

      if (seg.issue_clusters) {
        for (const c of seg.issue_clusters) {
          allClusters.push({
            ...c,
            segment_name: segName,
            segment_id: segId,
          });
        }
      }
    }
  }

  // Sort clusters: P0 > P1 > P2, then opportunity_score desc, then feedback_count desc
  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  allClusters.sort((a: any, b: any) => {
    const pa = priorityOrder[a.priority] ?? 4;
    const pb = priorityOrder[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    return (b.opportunity_score || 0) - (a.opportunity_score || 0);
  });

  const totalFeedback = segmentSummaries.reduce(
    (s, seg) => s + seg.feedbackCount,
    0
  );
  const totalClusters = allClusters.length;

  // oneLineSummary: from overall analysis or boss summary
  let oneLineSummary = "";
  if (typeof overallJson?.boss_summary === "string") {
    oneLineSummary = overallJson.boss_summary.slice(0, 300);
  } else if (typeof overallJson?.executive_summary === "string") {
    oneLineSummary = overallJson.executive_summary.slice(0, 300);
  } else {
    const topIssues = allClusters
      .slice(0, 3)
      .map((c: any) => c.name)
      .join("、");
    oneLineSummary = `本报告共分析 ${segmentSummaries.length} 个分组，识别 ${totalClusters} 个问题，覆盖 ${totalFeedback} 条反馈。核心问题集中在${topIssues || "待分析"}。`;
  }

  // topProblems: top 5 from all clusters
  const topProblems = allClusters.slice(0, 5).map((c: any) => ({
    title: c.name,
    priority: c.priority,
    feedbackCount: c.feedback_count,
    opportunityScore: c.opportunity_score,
    segmentName: c.segment_name,
    summary: c.summary,
  }));

  // p0Issues: all P0 sorted by feedback_count
  const p0Issues = allClusters
    .filter((c: any) => c.priority === "P0")
    .sort((a: any, b: any) => (b.feedback_count || 0) - (a.feedback_count || 0))
    .map((c: any) => ({
      title: c.name,
      feedbackCount: c.feedback_count,
      segmentName: c.segment_name,
      summary: c.summary,
    }));

  // crossSegmentPatterns: detect themes appearing in multiple segments
  const themeMap: Record<string, string[]> = {};
  for (const c of allClusters) {
    const themes = c.secondary_themes || [];
    for (const t of themes) {
      const key = t.toLowerCase().trim();
      if (!themeMap[key]) themeMap[key] = [];
      if (!themeMap[key].includes(c.segment_name)) {
        themeMap[key].push(c.segment_name);
      }
    }
  }
  const crossSegmentPatterns = Object.entries(themeMap)
    .filter(([, segs]) => segs.length >= 2)
    .map(([theme, segs]) => ({
      theme,
      segments: segs,
      description: `「${theme}」同时出现在 ${segs.join("、")} 等分组中`,
    }))
    .slice(0, 5);

  // recommendedActions: top 5 from P0/P1
  const recommendedActions = allClusters
    .filter(
      (c: any) =>
        (c.priority === "P0" || c.priority === "P1") && c.recommendation
    )
    .slice(0, 5)
    .map((c: any) => ({
      title: c.name,
      priority: c.priority,
      action: c.recommendation,
      segmentName: c.segment_name,
    }));

  // riskWarnings
  const riskWarnings: string[] = [];
  const p0Count = p0Issues.length;
  if (p0Count > 0) {
    riskWarnings.push(
      `本报告有 ${p0Count} 个 P0 级问题需立即处理。`
    );
  }
  const lowEvidenceCount = allClusters.filter(
    (c: any) => c.feedback_count <= 3
  ).length;
  if (lowEvidenceCount > 0) {
    riskWarnings.push(
      `${lowEvidenceCount} 个问题证据不足（≤3条反馈），建议补充验证。`
    );
  }
  const semanticScore = semVal?.semanticScore ?? semVal?.score ?? 0;
  if (semanticScore > 0 && semanticScore < 85) {
    riskWarnings.push(
      `语义评分 ${semanticScore}/100 低于阈值，分析质量需关注。`
    );
  }
  const evidenceBroken = semVal?.evidenceBroken ?? 0;
  if (evidenceBroken > 0) {
    riskWarnings.push(`${evidenceBroken} 个问题证据链断裂。`);
  }
  if (riskWarnings.length === 0) {
    riskWarnings.push("当前报告整体质量良好，未发现重大风险。");
  }

  // validationSummary
  const validationSummary = {
    hardValidation:
      hardVal?.status === "pass"
        ? "全部通过"
        : `${hardVal?.summary?.pass_count || 0}/${hardVal?.summary?.total_checks || 43} 通过`,
    semanticScore,
    evidenceBroken,
  };

  return {
    scope: "report",
    caseName,
    title: "报告级执行洞察",
    oneLineSummary,
    topProblems,
    p0Issues,
    crossSegmentPatterns,
    recommendedActions,
    riskWarnings,
    validationSummary,
    generatedAt: new Date().toISOString(),
  };
}

function generateSegmentInsight(
  caseName: string,
  segmentId: string
) {
  const runDir = path.join(ROOT, "runs", caseName);
  const dataset = getDatasetName(caseName);

  const segmentData = loadJson(
    path.join(
      runDir,
      "analysis",
      dataset,
      "segments",
      `${segmentId}.analysis.json`
    )
  );

  if (!segmentData) return null;

  const hardVal = loadJson(
    path.join(runDir, "validation-report", "hard-validation.json")
  );
  const semVal = loadJson(
    path.join(runDir, "validation-report", "semantic-validation.json")
  );

  const clusters = segmentData.issue_clusters || [];
  const summary = segmentData.summary || {};

  const topSummaries = clusters
    .slice(0, 2)
    .map((c: any) => c.summary)
    .filter(Boolean);
  const oneLineSummary =
    topSummaries.length > 0
      ? topSummaries.join(" ").slice(0, 200)
      : `本分组共识别 ${clusters.length} 个问题，覆盖 ${summary.feedback_count || 0} 条反馈。`;

  const topRisks = clusters
    .filter((c: any) => c.priority === "P0" || c.priority === "P1")
    .sort(
      (a: any, b: any) => (b.feedback_count || 0) - (a.feedback_count || 0)
    )
    .slice(0, 3)
    .map((c: any) => ({
      title: c.name,
      priority: c.priority,
      feedbackCount: c.feedback_count,
      summary: c.summary,
    }));

  const recommendedActions = clusters
    .filter((c: any) => c.recommendation)
    .slice(0, 3)
    .map((c: any) => ({
      title: c.name,
      action: c.recommendation,
    }));

  const followUpQuestions = clusters
    .filter((c: any) => c.feedback_count <= 5 && c.feedback_count > 0)
    .slice(0, 3)
    .map((c: any) => ({
      question: `「${c.name}」的数据是否充分？（${c.feedback_count} 条反馈）`,
    }));

  return {
    scope: "segment",
    caseName,
    segmentId,
    title: `分组洞察：${segmentId}`,
    oneLineSummary,
    topRisks,
    recommendedActions,
    followUpQuestions,
    generatedAt: new Date().toISOString(),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { caseName: string } }
) {
  try {
    const { caseName } = params;

    if (!isValidParam(caseName)) {
      return NextResponse.json({ error: "Invalid caseName" }, { status: 400 });
    }

    const runDir = path.join(ROOT, "runs", caseName);
    if (!fs.existsSync(runDir)) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const body = await req.json();
    const scope = body.scope || "report";
    const segmentId = body.segmentId || "";

    let insight: any;
    let fileName: string;

    if (scope === "segment") {
      if (!segmentId || !isValidParam(segmentId)) {
        return NextResponse.json(
          { error: "Valid segmentId required for segment scope" },
          { status: 400 }
        );
      }
      insight = generateSegmentInsight(caseName, segmentId);
      if (!insight) {
        return NextResponse.json(
          { error: "Segment data not found" },
          { status: 404 }
        );
      }
      fileName = `${segmentId}.executive-insight.json`;
    } else {
      insight = generateReportInsight(caseName);
      fileName = "report.executive-insight.json";
    }

    // Save to file
    const insightsDir = path.join(runDir, "insights");
    if (!fs.existsSync(insightsDir)) {
      fs.mkdirSync(insightsDir, { recursive: true });
    }
    const insightPath = path.join(insightsDir, fileName);
    fs.writeFileSync(insightPath, JSON.stringify(insight, null, 2), "utf-8");

    return NextResponse.json({ insight });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
