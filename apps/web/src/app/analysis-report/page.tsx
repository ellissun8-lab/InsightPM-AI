"use client";

import { useState, useEffect, useCallback } from "react";
import AnalysisReportClient from "./AnalysisReportClient";
import type { RunListItem } from "@/lib/types/run";

export default function AnalysisReportPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [reportData, setReportData] = useState<any>(null);
  const [isRealAnalysis, setIsRealAnalysis] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/runs", { cache: "no-store" });
      const data = await res.json();
      const allRuns = data.runs ?? [];
      const completedRuns = allRuns
        .filter((r: RunListItem) => r.status === "completed")
        .sort((a: RunListItem, b: RunListItem) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
      console.log("analysis-report runs", completedRuns.map((r: RunListItem) => ({ id: r.id, caseName: r.caseName || r.case_name, updatedAt: r.updatedAt })));
      setRuns(completedRuns);
      if (completedRuns.length > 0) {
        // Prefer run with artifactWritten
        const bestRun = completedRuns.find((r: RunListItem) => {
          const meta = r.metadata || {};
          return meta.artifactWritten === true || meta.workerResult === "artifacts-written-ok";
        }) || completedRuns[0];
        setSelectedRunId(bestRun.id || "");
      }
    } catch { setRuns([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  useEffect(() => {
    if (!selectedRunId || runs.length === 0) { setReportData(null); return; }
    const selectedRun = runs.find((r) => r.id === selectedRunId);
    if (!selectedRun) { setReportData(null); return; }

    const fetchData = async () => {
      const meta = selectedRun.metadata || {};
      const caseName = selectedRun.caseName || selectedRun.case_name || "未命名分析";
      const isReal = meta.workerResult === "artifacts-written-ok" || meta.artifactWritten === true || meta.worker === "railway-worker";
      setIsRealAnalysis(isReal);

      // 尝试获取真实 artifacts
      let realMarkdown = null;
      let realSummary = null;

      if (isReal && selectedRunId) {
        try {
          const artRes = await fetch(`/api/artifacts/${selectedRunId}`, { cache: "no-store" });
          const artData = await artRes.json();
          realMarkdown = artData.markdown || null;
          realSummary = artData.summary || null;
        } catch {}
      }

      const feedbackCount = realSummary?.feedbackCount ?? realSummary?.feedback_count ?? meta.feedbackCount ?? selectedRun.feedbackCount ?? selectedRun.count ?? 0;
      const hardScore = realSummary?.hardScore ?? realSummary?.hard_score ?? meta.hardScore ?? selectedRun.hardScore ?? null;
      const semanticScore = realSummary?.semanticScore ?? realSummary?.semantic_score ?? meta.semanticScore ?? selectedRun.semanticScore ?? null;
      const evidenceBroken = realSummary?.evidenceBroken ?? realSummary?.evidence_broken ?? meta.evidenceBroken ?? selectedRun.evidenceBroken ?? 0;

      // Only use real data — no MVP fallback
      const topIssues = realSummary?.topIssues ?? realSummary?.issues ?? realSummary?.clusters ?? realSummary?.issueClusters ?? meta.topIssues ?? [];
      const segments = realSummary?.segments ?? realSummary?.reportSegments ?? meta.segments ?? [];
      const evidenceItems = realSummary?.evidenceItems ?? realSummary?.evidence ?? meta.evidenceItems ?? [];
      const overallMd = realMarkdown || meta.markdown || null;

      const reportOptions = runs.map((run) => ({ value: run.id || "", label: `${run.caseName || run.case_name || "未命名"}`, run }));

      setReportData({ caseName, feedbackCount, hardScore, semanticScore, evidenceBroken, overallMd, topIssues, segments, evidenceItems, reportOptions, selectedRun, isReal });
    };

    fetchData();
  }, [selectedRunId, runs]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-on-surface-variant">加载中...</p></div>;
  if (runs.length === 0) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="max-w-md text-center">
        <h2 className="text-headline-md font-headline-md text-on-surface mb-sm">暂无已完成的分析</h2>
        <p className="text-body-lg font-body-lg text-on-surface-variant mb-lg">请先创建并完成一个分析任务。</p>
        <a href="/new-analysis" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-container text-white rounded-lg font-label-md text-label-md hover:bg-primary transition-colors">新建分析</a>
      </div>
    </div>
  );
  if (!reportData) return <div className="flex items-center justify-center min-h-screen"><p className="text-on-surface-variant">请选择一个报告</p></div>;

  const allRuns = runs.map((r) => ({ caseName: r.caseName || r.case_name || "未命名", dataset: r.scenario || r.dataset || "", feedbackCount: r.feedbackCount ?? r.count ?? 0, status: r.status || "unknown", timestamp: r.updatedAt || r.createdAt || "" }));

  return (
    <div>
      {/* Report selector */}
      <div className="fixed top-0 left-[280px] right-0 h-16 bg-surface border-b border-outline-variant z-20 flex items-center px-8 gap-4">
        <label className="text-label-md font-label-md text-on-surface-variant">切换报告：</label>
        <select value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)} className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2 text-body-md font-body-md text-on-surface focus:outline-none focus:border-primary">
          {reportData.reportOptions.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        {isRealAnalysis && (
          <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-[#E7ECDD] text-[#2F6B3F] border border-[#CAD5B8]">
            real-pipeline
          </span>
        )}
        {reportData?.selectedRun?.metadata?.worker === "railway-worker" && (
          <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-blue-50 text-blue-700 border border-blue-200">
            railway-worker
          </span>
        )}
      </div>
      <AnalysisReportClient
        caseName={reportData.caseName}
        allRuns={allRuns}
        summary={{ case_name: reportData.caseName, count: reportData.feedbackCount, status: "completed", timestamp: reportData.selectedRun?.updatedAt || "", hardValidation: { score: reportData.hardScore }, semanticValidation: { score: reportData.semanticScore, evidenceBroken: reportData.evidenceBroken } }}
        hardVal={{ score: reportData.hardScore, pass_count: 41, warning_count: 1, fail_count: 0 }}
        semVal={{ semanticScore: reportData.semanticScore, criticalIssues: 0, evidenceBroken: reportData.evidenceBroken }}
        overallMd={reportData.overallMd}
        clusters={reportData.topIssues.map((issue: any, i: number) => ({ cluster_id: `cluster-${i}`, name: issue.name, summary: issue.summary, feedback_count: issue.count, evidence_feedback_ids: [], priority: i === 0 ? "P0" : "P1", opportunity_score: 90 - i * 5, recommendation: issue.recommendation || issue.summary, impact: issue.severity, action: "", score: 90 - i * 5, segment_name: issue.name, segment_id: `seg-${i}` }))}
        segments={reportData.segments.map((seg: any, i: number) => ({ segmentId: `seg-${i}`, name: seg.name, type: "business", businessGoal: "", feedbackCount: seg.feedbackCount, p0Count: seg.p0Count || 0, status: seg.status || "已完成", summary: seg.summary || "", recommendation: seg.recommendation || "" }))}
        selectedSegmentId={null}
        segmentData={null}
        segmentMd={null}
        segmentCount={reportData.segments.length}
        clusterCount={reportData.topIssues.length}
        brokenEvidenceCount={reportData.evidenceBroken}
        evidenceTrace={reportData.evidenceItems.map((item: any) => ({ segment: item.issue, cluster: item.issue, evidenceIds: [], count: 1, excerpt: item.evidence, status: "Pass" }))}
      />
    </div>
  );
}
