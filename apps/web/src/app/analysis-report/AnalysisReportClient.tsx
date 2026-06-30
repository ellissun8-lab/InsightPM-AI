"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ReportTabs, { type Tab } from "@/components/reports/ReportTabs";
import SegmentReportView from "@/components/reports/SegmentReportView";
import type {
  RunMeta,
  SegmentMeta,
  IssueCluster,
  SegmentData,
} from "@/lib/report-helpers";
import {
  getReadableSegmentName,
  sortByPriority,
  getEvidenceStatus,
  deriveHealthScore,
  formatDatasetName,
} from "@/lib/report-helpers";
import {
  CheckCircle, XCircle, Download, FileJson, Link,
  MessageSquare, AlertTriangle, FileText, PieChart, Table,
  Brain, ShieldCheck, Lightbulb, AlertCircle, Layers, FolderArchive, Copy,
  Search, Bell, HelpCircle, FolderOpen, Sparkles, Tag, Users, TrendingUp,
  ChevronDown,
} from "lucide-react";
import { parseReportMarkdown } from "@/lib/markdown-report-parser";
import { getScenarioDisplayName } from "@/lib/report-display";

/* ──────────── Props ──────────── */

interface Props {
  caseName: string;
  runId?: string;
  allRuns: RunMeta[];
  summary: any;
  hardVal: any;
  semVal: any;
  overallMd: string | null;
  clusters: IssueCluster[];
  segments: SegmentMeta[];
  selectedSegmentId: string | null;
  segmentData: SegmentData | null;
  segmentMd: string | null;
  segmentCount: number;
  clusterCount: number;
  brokenEvidenceCount: number;
  evidenceTrace: any[];
}

/* ──────────── Shared Components ──────────── */

function PriorityBadge({ priority }: { priority: string }) {
  const s: Record<string, string> = {
    P0: "bg-red-50 text-red-700 border-red-200",
    P1: "bg-amber-50 text-amber-700 border-amber-200",
    P2: "bg-surface-variant text-on-surface-variant border-outline-variant",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
        s[priority] || s.P2
      }`}
    >
      {priority}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "Pass") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
        <CheckCircle size={12} /> 通过
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[11px] font-medium border border-amber-200">
      <AlertTriangle size={12} /> 需验证
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused p-12 text-center">
      <PieChart size={48} className="text-on-surface-variant/30 mx-auto mb-4" />
      <p className="text-sm text-on-surface-variant">{message}</p>
    </div>
  );
}

/* ──────────── Tab 1: 综合诊断 ──────────── */

function TabDashboard({
  clusters,
  segments,
  evidenceTrace,
  hardVal,
  semVal,
  brokenEvidenceCount,
  overallMd,
  caseName,
}: {
  clusters: IssueCluster[];
  segments: SegmentMeta[];
  evidenceTrace: any[];
  hardVal: any;
  semVal: any;
  brokenEvidenceCount: number;
  overallMd: string | null;
  caseName: string;
}) {
  const totalFeedback = segments.reduce((s, seg) => s + seg.feedbackCount, 0);
  const topProblems = clusters.slice(0, 5);

  // Parse markdown for structured executive summary
  const parsed = parseReportMarkdown(overallMd);
  const scenarioLabel = getScenarioDisplayName(caseName);

  // Generate scenario-aware fallback summary
  const executiveSummary = parsed.executiveSummary.includes("已自动解析")
    ? (() => {
        const { totalFeedback: tf, clusterCount: cc, segmentCount: sc } = parsed.scopeMetrics;
        if (scenarioLabel && tf && cc) {
          return `本报告围绕「${scenarioLabel}」场景分析 ${tf} 条反馈，识别出 ${cc} 个问题聚类。当前重点关注数据准确性、查询体验、价值感知和导出流程等影响核心业务目标的问题。`;
        }
        if (tf && cc) {
          return `本报告共分析 ${tf} 条用户反馈，识别出 ${cc} 个问题聚类，覆盖 ${sc || "多个"} 个分组。建议优先关注反馈量高、证据完整且影响核心业务目标的问题，并将低证据问题放入进一步验证池。`;
        }
        return parsed.executiveSummary;
      })()
    : parsed.executiveSummary;

  const businessSegments = parsed.segmentOverview.filter(
    (s) => s.type === "business"
  );

  // Build segment overview with P0 counts
  const segmentOverview = segments.map((seg) => {
    const segClusters = clusters.filter((c) => c.segment_id === seg.segmentId);
    const p0Count = segClusters.filter((c) => c.priority === "P0").length;
    return {
      name: seg.name,
      feedback: seg.feedbackCount,
      p0Count,
      status: seg.type === "noise" || seg.type === "positive" || seg.type === "unknown" ? "Ignored" : "Valid",
    };
  });

  // Evidence preview from top clusters
  const evidencePreview = clusters
    .filter((c) => c.evidence_feedback_ids.length > 0)
    .slice(0, 4)
    .map((c) => ({
      cluster: c.name,
      excerpt: c.summary,
    }));

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      {/* ─── 老板摘要 ─── */}
      <section className="bg-[#FFFCF5] border border-[#E5DED0] rounded-[24px] p-6 md:p-8 shadow-diffused">
        <h3
          className="text-xl font-bold text-primary mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          老板摘要
        </h3>
        <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
          {executiveSummary}
        </p>
      </section>

      {/* ─── 关键指标 ─── */}
      <section>
        <h3
          className="text-lg font-bold text-on-surface mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          关键指标
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "总反馈数", value: parsed.scopeMetrics.totalFeedback ?? totalFeedback },
            { label: "已分析数量", value: parsed.scopeMetrics.analyzedFeedback ?? totalFeedback },
            { label: "问题聚类", value: parsed.scopeMetrics.clusterCount ?? clusters.length },
            { label: "分组数", value: parsed.scopeMetrics.segmentCount ?? segments.length },
            { label: "业务分组", value: parsed.scopeMetrics.businessSegmentCount ?? businessSegments.length },
            { label: "需关注问题", value: `Top ${Math.min(clusters.length, 5)}` },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-[#FFFCF5] border border-[#E5DED0] rounded-xl p-4 text-center"
            >
              <div className="text-2xl font-bold text-primary">{item.value}</div>
              <div className="text-xs text-on-surface-variant mt-1 uppercase tracking-wider">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 数据分组概览 ─── */}
      {parsed.segmentOverview.length > 0 && (
        <section className="bg-[#FFFCF5] border border-[#E5DED0] rounded-[24px] shadow-diffused overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5DED0] bg-[#F7F3EA]">
            <h3
              className="text-lg font-bold text-primary"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              数据分组概览
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5DED0] bg-[#F7F3EA]">
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    分组
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    类型
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    业务目标
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">
                    反馈数
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">
                    聚类数
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {parsed.segmentOverview.map((seg) => (
                  <tr
                    key={seg.segmentId}
                    className="border-b border-[#E5DED0]/50 hover:bg-[#F7F3EA] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-on-surface">
                      {seg.segmentId}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          seg.type === "business"
                            ? "bg-[#E7ECDD] text-[#58624a]"
                            : seg.type === "positive"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-surface-variant text-on-surface-variant"
                        }`}
                      >
                        {seg.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {seg.businessGoal}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">
                      {seg.feedbackCount}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">
                      {seg.clusterCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Metrics Bar */}
      <div className="flex items-center gap-5 text-sm text-on-surface-variant bg-surface-container-lowest px-4 py-2.5 rounded-xl border border-outline-variant shadow-diffused inline-flex">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={14} className="text-on-surface-variant/60" /> 反馈:{" "}
          <strong className="text-on-surface">{totalFeedback}</strong>
        </div>
        <div className="w-px h-4 bg-outline-variant" />
        <div className="flex items-center gap-1.5">
          <PieChart size={14} className="text-on-surface-variant/60" /> 分组:{" "}
          <strong className="text-on-surface">{segments.length}</strong>
        </div>
        <div className="w-px h-4 bg-outline-variant" />
        <div className="flex items-center gap-1.5">
          <Layers size={14} className="text-on-surface-variant/60" /> 问题簇:{" "}
          <strong className="text-on-surface">{clusters.length}</strong>
        </div>
        <div className="w-px h-4 bg-outline-variant" />
        <div className="flex items-center gap-1.5 text-emerald-600">
          <ShieldCheck size={14} /> 硬性校验:{" "}
          <strong>{hardVal?.score ?? "--"}</strong>
        </div>
        <div className="w-px h-4 bg-outline-variant" />
        <div className="flex items-center gap-1.5 text-primary">
          <Brain size={14} /> 语义评分:{" "}
          <strong>{semVal?.semanticScore ?? semVal?.score ?? "--"}</strong>
        </div>
        <div className="w-px h-4 bg-outline-variant" />
        <div className="flex items-center gap-1.5 text-on-surface-variant">
          <Link size={14} /> 证据断裂:{" "}
          <strong>{brokenEvidenceCount}</strong>
        </div>
      </div>

      {/* Top Problem Cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-on-surface">Top 产品问题</h3>
          <span className="text-sm text-on-surface-variant">
            共识别 {clusters.length} 个问题簇
          </span>
        </div>
        {topProblems.length === 0 ? (
          <EmptyState message="该报告暂无可用问题数据。" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {topProblems.map((p, i) => {
              const borderColor =
                p.priority === "P0"
                  ? "bg-red-500"
                  : p.priority === "P1"
                  ? "bg-amber-400"
                  : "bg-outline";
              const isP2 = p.priority === "P2";
              return (
                <div
                  key={i}
                  className={`bg-surface-container-lowest rounded-[24px] border border-outline-variant p-5 shadow-diffused hover:shadow-md transition-shadow relative overflow-hidden ${
                    isP2 ? "opacity-80" : ""
                  }`}
                >
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${borderColor}`}
                  />
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={p.priority} />
                      <span className="text-xs text-on-surface-variant uppercase tracking-wider">
                        {p.segment_name || p.segment_id}
                      </span>
                    </div>
                    {p.evidence_feedback_ids.length >= 2 ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200 flex items-center gap-1">
                        <CheckCircle size={12} /> 证据完整
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant text-[10px] font-medium border border-outline-variant flex items-center gap-1">
                        <AlertCircle size={12} /> 需验证
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-on-surface mb-3">
                    {p.name}
                  </h4>
                  <div className="space-y-2 mb-4">
                    <div className="bg-red-50 p-2.5 rounded-lg border border-red-100">
                      <p className="text-xs text-red-600 font-medium mb-0.5 flex items-center gap-1">
                        <AlertTriangle size={12} /> 影响
                      </p>
                      <p className="text-sm text-on-surface">{p.summary}</p>
                    </div>
                    <div className="bg-surface-container-high p-2.5 rounded-lg border border-outline-variant/30">
                      <p className="text-xs text-primary font-medium mb-0.5 flex items-center gap-1">
                        <Lightbulb size={12} /> 建议
                      </p>
                      <p className="text-sm text-on-surface">
                        {p.recommendation}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant/50">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-on-surface-variant">
                        <MessageSquare size={12} /> {p.feedback_count}{" "}
                        反馈
                      </span>
                      {p.opportunity_score != null && (
                        <span className="flex items-center gap-1 text-primary">
                          <Brain size={12} /> 评分{" "}
                          {p.opportunity_score}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Two tables */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <h3 className="text-base font-bold text-on-surface">分层概览</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">
                    分组
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">
                    反馈总数
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">
                    P0 数量
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {segmentOverview.map((s) => (
                  <tr
                    key={s.name}
                    className="border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-on-surface">
                      {s.name}
                    </td>
                    <td className="px-4 py-3 text-right text-on-surface-variant">
                      {s.feedback}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {s.p0Count > 0 ? (
                        <span className="text-red-600">{s.p0Count}</span>
                      ) : (
                        <span className="text-on-surface-variant/60">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === "Valid" ? (
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
                          有效
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-md bg-surface-variant text-on-surface-variant text-[11px] font-medium border border-outline-variant">
                          已忽略
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused overflow-hidden flex flex-col">
          <div className="p-4 border-b border-outline-variant bg-surface-container-low">
            <h3 className="text-base font-bold text-on-surface">
              证据追踪预览
            </h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase w-1/3">
                    问题簇
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase">
                    证据 / 示例
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant uppercase w-16">
                    追踪
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {evidencePreview.map((e, i) => (
                  <tr
                    key={i}
                    className="border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-on-surface truncate max-w-[150px]">
                      {e.cluster}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-on-surface-variant line-clamp-2">
                        {e.excerpt}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link size={16} className="text-emerald-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ──────────── Tab 2: 分组视图 ──────────── */

function TabSegment({
  segments,
  selectedSegmentId,
  caseName,
  segmentData,
  segmentMd,
  overallMd,
  hardVal,
  semVal,
  isGeneratingSegInsight,
  onGenerateSegInsight,
}: {
  segments: SegmentMeta[];
  selectedSegmentId: string | null;
  caseName: string;
  segmentData: SegmentData | null;
  segmentMd: string | null;
  overallMd: string | null;
  hardVal: any;
  semVal: any;
  isGeneratingSegInsight: boolean;
  onGenerateSegInsight: () => void;
}) {
  const router = useRouter();

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      {/* Segment Selector */}
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {segments.map((s) => (
            <button
              key={s.segmentId}
              onClick={() =>
                router.push(
                  `/analysis-report?case=${caseName}&segment=${s.segmentId}`
                )
              }
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                selectedSegmentId === s.segmentId
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-container-lowest text-on-surface-variant border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              {s.name}
            </button>
          ))}
          {selectedSegmentId && (
            <button
              onClick={onGenerateSegInsight}
              disabled={isGeneratingSegInsight}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-outline-variant bg-surface-container-high text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50 ml-2 flex items-center gap-1"
            >
              <Sparkles size={12} />
              {isGeneratingSegInsight ? "生成中..." : "生成当前分组洞察"}
            </button>
          )}
        </div>
      )}

      {segmentData ? (
        <SegmentReportView
          segmentData={segmentData}
          segmentMd={segmentMd}
          overallMd={overallMd}
          hardVal={hardVal}
          semVal={semVal}
        />
      ) : segments.length > 0 ? (
        <div className="space-y-4">
          {segments.map((seg, i) => (
            <div key={seg.segmentId || i} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-title-lg font-title-lg text-on-surface">{seg.name}</h3>
                <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-[#E7ECDD] text-[#2F6B3F] border border-[#CAD5B8]">
                  {seg.status || "已完成"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <span className="text-label-sm text-on-surface-variant">反馈数</span>
                  <p className="text-headline-md font-headline-md text-on-surface">{seg.feedbackCount || 0}</p>
                </div>
                <div>
                  <span className="text-label-sm text-on-surface-variant">P0 数量</span>
                  <p className="text-headline-md font-headline-md text-on-surface">{seg.p0Count || 0}</p>
                </div>
              </div>
              {seg.summary && (
                <p className="text-body-md text-on-surface-variant mb-2">{seg.summary}</p>
              )}
              {seg.recommendation && (
                <p className="text-body-sm text-primary">建议：{seg.recommendation}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="该报告暂无可用分组分析数据。请确认 pipeline 已生成 segment analysis JSON 和 Markdown。" />
      )}
    </div>
  );
}

/* ──────────── Tab 3: 证据链 ──────────── */

function TabEvidence({ evidenceTrace }: { evidenceTrace: any[] }) {
  const passCount = evidenceTrace.filter((e) => e.status === "Pass").length;
  const total = evidenceTrace.length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

  return (
    <div className="pb-12 max-w-7xl mx-auto">
      <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused overflow-hidden flex flex-col">
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <div>
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <Link size={18} className="text-primary" />
              证据链路追踪
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              验证 AI 洞察与原始反馈数据的直接对应关系，确保分析结果的可追溯性。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-surface-variant px-2.5 py-1 rounded flex items-center gap-1.5 border border-outline-variant">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-on-surface">
                校验通过 ({passRate}%)
              </span>
            </div>
            <div className="bg-surface-variant px-2.5 py-1 rounded flex items-center gap-1.5 border border-outline-variant">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-on-surface">
                需人工复核 ({100 - passRate}%)
              </span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-[14%]">
                  分组
                </th>
                <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-[16%]">
                  问题
                </th>
                <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-[22%]">
                  证据反馈 ID
                </th>
                <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-[8%]">
                  数量
                </th>
                <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-[30%]">
                  示例反馈
                </th>
                <th className="p-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-[12%]">
                  追踪状态
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {evidenceTrace.map((e, i) => (
                <tr
                  key={i}
                  className={`hover:bg-surface-container-low transition-colors group ${
                    e.status === "Needs Validation" ? "bg-amber-50/30" : ""
                  }`}
                >
                  <td className="p-3 align-top">
                    <span className="text-sm font-medium text-on-surface">
                      {e.segment}
                    </span>
                  </td>
                  <td className="p-3 align-top">
                    <span className="text-sm text-on-surface-variant">{e.cluster}</span>
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex flex-wrap gap-1">
                      {e.evidenceIds.map((id: string) => (
                        <span
                          key={id}
                          className="px-1.5 py-0.5 bg-surface-variant rounded text-xs font-mono text-on-surface-variant"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 align-top">
                    <span
                      className={`text-sm font-semibold ${
                        e.count <= 1 ? "text-red-500" : "text-on-surface"
                      }`}
                    >
                      {e.count}
                    </span>
                  </td>
                  <td className="p-3 align-top">
                    <p className="text-sm text-on-surface-variant line-clamp-2 group-hover:line-clamp-none transition-all">
                      {e.excerpt}
                    </p>
                  </td>
                  <td className="p-3 align-top">
                    <StatusPill status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-outline-variant bg-surface-container-low flex justify-end">
          <span className="text-xs text-on-surface-variant">
            显示 1-{total} 共 {total} 条记录
          </span>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Tab 4: 完整 Markdown ──────────── */

function TabMarkdown({ overallMd }: { overallMd: string | null }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (overallMd) {
      navigator.clipboard.writeText(overallMd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const handleDownload = () => {
    if (!overallMd) return;
    const blob = new Blob([overallMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analysis-report.md";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="pb-12 max-w-7xl mx-auto">
      <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused flex flex-col h-[600px]">
        <div className="px-5 py-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <FileText size={16} className="text-on-surface-variant" /> 完整 Markdown 报告
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded border border-outline-variant text-xs font-medium text-on-surface bg-surface-container-lowest hover:bg-surface-container-low flex items-center gap-1.5"
            >
              <Copy size={14} /> {copied ? "已复制" : "复制 Markdown"}
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded border border-outline-variant text-xs font-medium text-primary bg-surface-container-high hover:bg-secondary-container flex items-center gap-1.5"
            >
              <Download size={14} /> 下载 .md
            </button>
          </div>
        </div>
        <div className="flex-1 p-5 bg-surface-container-low overflow-y-auto font-mono text-sm text-on-surface-variant whitespace-pre-wrap">
          {overallMd || "暂无 Markdown 报告。请先运行分析生成报告。"}
        </div>
      </div>
    </div>
  );
}

/* ──────────── Tab 5: 下载 ──────────── */

function TabDownloads({
  caseName,
  segmentId,
  onDownload,
}: {
  caseName: string;
  segmentId: string | null;
  onDownload: (type: string) => void;
}) {
  const artifacts = [
    { icon: <FileText size={24} />, title: "完整 Markdown", desc: "完整分析报告 Markdown 格式", type: "overall-md" },
    { icon: <FileJson size={24} />, title: "运行摘要 JSON", desc: "运行摘要结构化数据", type: "summary-json" },
    { icon: <ShieldCheck size={24} />, title: "验证结果 JSON", desc: "校验汇总报告", type: "validation-json" },
    { icon: <PieChart size={24} />, title: "分组结构 JSON", desc: "分组与聚类结构化数据", type: "segment-json" },
  ];
  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <div>
        <h3 className="text-base font-bold text-on-surface">分析产物下载</h3>
        <p className="text-sm text-on-surface-variant mt-1">
          获取结构化数据或便于共享的文档格式。
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {artifacts.map((a, i) => {
          return (
            <div
              key={i}
              className="bg-surface-container-lowest border border-outline-variant rounded-[24px] p-5 hover:shadow-md transition-all flex flex-col items-start gap-3 group"
            >
              <div className="w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                {a.icon}
              </div>
              <div>
                <h4 className="text-sm font-bold text-on-surface">{a.title}</h4>
                <p className="text-xs text-on-surface-variant mt-1">{a.desc}</p>
              </div>
              <button
                onClick={() => onDownload(a.type)}
                className="mt-auto pt-2 w-full text-left text-primary text-xs font-semibold flex items-center gap-1 hover:underline"
              >
                <Download size={14} /> 下载
              </button>
            </div>
          );
        })}
        <div className="bg-surface-container-high border border-outline-variant rounded-[24px] p-5 shadow-diffused flex flex-col items-start gap-3 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-secondary-container rounded-full blur-2xl opacity-30 pointer-events-none" />
          <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container z-10">
            <FolderArchive size={24} />
          </div>
          <div className="z-10">
            <h4 className="text-sm font-bold text-on-surface">
              全部产物 ZIP
            </h4>
            <p className="text-xs text-on-surface-variant mt-1">打包下载全部产物</p>
          </div>
          <button
            onClick={() => onDownload("all-zip")}
            className="mt-auto pt-2 w-full text-left text-primary text-xs font-bold flex items-center gap-1 hover:underline z-10"
          >
            <Download size={14} /> 一键下载全部
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Main ──────────── */

export default function AnalysisReportClient(props: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("综合诊断");
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insight, setInsight] = useState<any>(null);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleExportPdf = useCallback(() => {
    const segment = props.selectedSegmentId || "";
    const url = `/analysis-report/print?case=${props.caseName}&segment=${segment}`;
    window.open(url, "_blank");
  }, [props.caseName, props.selectedSegmentId]);

  const handleDownload = useCallback(
    (type: string) => {
      // Use runId for cloud artifact download API
      if (props.runId) {
        const url = `/api/artifacts/${props.runId}/download?type=${type}`;
        window.location.href = url;
        return;
      }
      // Fallback to local mode
      const segment = props.selectedSegmentId || "";
      const url = `/api/reports/${props.caseName}/download?type=${type}&segment=${segment}`;
      window.location.href = url;
    },
    [props.runId, props.caseName, props.selectedSegmentId]
  );

  const [isGeneratingSegInsight, setIsGeneratingSegInsight] = useState(false);
  const [segInsight, setSegInsight] = useState<any>(null);
  const [showSegInsightModal, setShowSegInsightModal] = useState(false);

  const handleGenerateInsight = useCallback(async () => {
    setIsGeneratingInsight(true);
    try {
      const res = await fetch(
        `/api/reports/${props.caseName}/generate-insight`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "report" }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setInsight(data.insight);
      setShowInsightModal(true);
    } catch (err: any) {
      showToast(err.message || "生成洞察失败");
    } finally {
      setIsGeneratingInsight(false);
    }
  }, [props.caseName, showToast]);

  const handleGenerateSegInsight = useCallback(async () => {
    if (!props.selectedSegmentId) return;
    setIsGeneratingSegInsight(true);
    try {
      const res = await fetch(
        `/api/reports/${props.caseName}/generate-insight`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "segment", segmentId: props.selectedSegmentId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      setSegInsight(data.insight);
      setShowSegInsightModal(true);
    } catch (err: any) {
      showToast(err.message || "生成分组洞察失败");
    } finally {
      setIsGeneratingSegInsight(false);
    }
  }, [props.caseName, props.selectedSegmentId, showToast]);

  const {
    caseName,
    allRuns,
    summary,
    hardVal,
    semVal,
    overallMd,
    clusters,
    segments,
    selectedSegmentId,
    segmentData,
    segmentMd,
    segmentCount,
    clusterCount,
    brokenEvidenceCount,
    evidenceTrace,
  } = props;

  const selectedRun = allRuns.find((r) => r.caseName === caseName);
  const datasetName = selectedRun?.dataset || "";
  const displayName = formatDatasetName(datasetName || caseName);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/analysis-report?${params.toString()}`);
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="no-print">
        <Sidebar />
      </div>

      {/* Global Topbar */}
      <header className="h-16 w-[calc(100%-280px)] fixed top-0 right-0 z-40 bg-surface border-b border-outline-variant flex justify-between items-center px-6 no-print">
        <div className="flex items-center bg-surface-container-low rounded-full px-4 py-2 border border-outline-variant w-80 focus-within:border-primary transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] mr-2">search</span>
          <input
            className="bg-transparent border-none outline-none text-sm w-full placeholder-on-surface-variant/60 font-body-md text-on-surface"
            placeholder="搜索分析报告..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[20px]">help_outline</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="ml-[280px] mt-16 flex-1 overflow-y-auto">
        <div className="max-w-[1280px] mx-auto px-margin-desktop py-lg">
          {/* Report Header */}
          <div className="mb-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-xs">分析报告</p>
                <h1 className="font-display-lg text-display-lg text-primary leading-tight">
                  {displayName}
                </h1>
              </div>
              <div className="flex gap-sm no-print">
                <button
                  onClick={handleExportPdf}
                  className="px-md py-sm rounded-lg bg-surface-container border border-outline-variant text-primary font-title-lg text-title-lg hover:bg-surface-variant transition-colors flex items-center gap-xs"
                >
                  <span className="material-symbols-outlined text-[20px]">download</span> 导出 PDF
                </button>
                <button
                  onClick={handleGenerateInsight}
                  disabled={isGeneratingInsight}
                  className="px-md py-sm rounded-lg bg-primary text-on-primary font-title-lg text-title-lg hover:opacity-90 transition-opacity flex items-center gap-xs shadow-diffused disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_awesome</span>{" "}
                  {isGeneratingInsight ? "生成中..." : "生成报告洞察"}
                </button>
              </div>
            </div>

            {/* Metadata Chips */}
            <div className="flex flex-wrap gap-2 mt-3 no-print">
              {[
                {
                  icon: <Tag size={12} />,
                  label: `ID: ${selectedSegmentId || caseName}`,
                },
                {
                  icon: <Users size={12} />,
                  label: `类型：${segmentData?.segment_type || "分析报告"}`,
                },
                {
                  icon: <TrendingUp size={12} />,
                  label: `业务目标：${segments.find((s) => s.segmentId === selectedSegmentId)?.businessGoal || "提升转化"}`,
                },
                {
                  icon: <MessageSquare size={12} />,
                  label: `反馈数量：${segmentData?.summary?.feedback_count ?? summary?.count ?? summary?.rawCount ?? 0}`,
                },
                {
                  icon: <Layers size={12} />,
                  label: `聚类数量：${segmentData?.summary?.cluster_count ?? clusterCount}`,
                },
              ].map((chip, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full bg-surface-variant text-on-surface-variant text-xs border border-outline-variant flex items-center gap-1.5 font-label-sm"
                >
                  {chip.icon} {chip.label}
                </span>
              ))}
            </div>

            {/* Report Selector */}
            {allRuns.length > 1 && (
              <div className="mt-4 flex items-center gap-3 no-print">
                <label className="text-xs text-on-surface-variant font-medium">
                  切换报告：
                </label>
                <div className="relative">
                  <select
                    value={caseName}
                    onChange={(e) => {
                      const newCase = e.target.value;
                      const newCaseRuns = allRuns.find(
                        (r) => r.caseName === newCase
                      );
                      updateParam("case", newCase);
                    }}
                    className="appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2 pr-8 text-sm text-on-surface font-medium hover:border-outline focus:border-primary focus:outline-none cursor-pointer shadow-diffused"
                  >
                    {allRuns.map((r) => (
                      <option key={r.caseName} value={r.caseName}>
                        {formatDatasetName(r.dataset || r.caseName)} ({r.caseName})
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant/60 pointer-events-none"
                  />
                </div>
                <span className="text-xs text-on-surface-variant/60">
                  {selectedRun?.feedbackCount ?? 0} 条反馈 · {segmentCount} 个分组
                </span>
              </div>
            )}
          </div>

          {/* Report Tabs */}
          <ReportTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === "综合诊断" && (
              <TabDashboard
                clusters={clusters}
                segments={segments}
                evidenceTrace={evidenceTrace}
                hardVal={hardVal}
                semVal={semVal}
                brokenEvidenceCount={brokenEvidenceCount}
                overallMd={overallMd}
                caseName={caseName}
              />
            )}
            {activeTab === "分组视图" && (
              <TabSegment
                segments={segments}
                selectedSegmentId={selectedSegmentId}
                caseName={caseName}
                segmentData={segmentData}
                segmentMd={segmentMd}
                overallMd={overallMd}
                hardVal={hardVal}
                semVal={semVal}
                isGeneratingSegInsight={isGeneratingSegInsight}
                onGenerateSegInsight={handleGenerateSegInsight}
              />
            )}
            {activeTab === "证据链" && (
              <TabEvidence evidenceTrace={evidenceTrace} />
            )}
            {activeTab === "完整 Markdown" && (
              <TabMarkdown overallMd={overallMd} />
            )}
            {activeTab === "下载" && (
              <TabDownloads
                caseName={caseName}
                segmentId={selectedSegmentId}
                onDownload={handleDownload}
              />
            )}
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-primary-container text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          {toast}
        </div>
      )}

      {/* Report Insight Modal */}
      {showInsightModal && insight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowInsightModal(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-[24px] shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                报告级执行洞察
              </h3>
              <button
                onClick={() => setShowInsightModal(false)}
                className="text-on-surface-variant/60 hover:text-on-surface-variant text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* One-line summary */}
              <div>
                <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                  一句话摘要
                </h4>
                <p className="text-sm text-on-surface leading-relaxed">
                  {insight.oneLineSummary}
                </p>
              </div>

              {/* Top Problems */}
              {insight.topProblems?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Top 问题
                  </h4>
                  <ul className="space-y-2">
                    {insight.topProblems.map((p: any, i: number) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-on-surface"
                      >
                        <span
                          className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            p.priority === "P0"
                              ? "bg-red-50 text-red-700"
                              : p.priority === "P1"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-surface-variant text-on-surface-variant"
                          }`}
                        >
                          {p.priority}
                        </span>
                        <span>
                          {p.title}（{p.feedbackCount} 条反馈）
                          {p.segmentName && (
                            <span className="text-on-surface-variant/60 ml-1">· {p.segmentName}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* P0 Issues */}
              {insight.p0Issues?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
                    P0 紧急问题
                  </h4>
                  <ul className="space-y-2">
                    {insight.p0Issues.map((p: any, i: number) => (
                      <li key={i} className="text-sm text-on-surface bg-red-50 p-2.5 rounded-lg border border-red-100">
                        <span className="font-medium">{p.title}</span>
                        <span className="text-on-surface-variant ml-1">（{p.feedbackCount} 条反馈 · {p.segmentName}）</span>
                        {p.summary && (
                          <p className="text-xs text-on-surface-variant mt-1">{p.summary}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cross-Segment Patterns */}
              {insight.crossSegmentPatterns?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    跨分组共性问题
                  </h4>
                  <ul className="space-y-1.5">
                    {insight.crossSegmentPatterns.map((p: any, i: number) => (
                      <li
                        key={i}
                        className="text-sm text-on-surface flex items-start gap-1.5"
                      >
                        <Layers size={14} className="text-on-surface-variant mt-0.5 shrink-0" />
                        {p.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Actions */}
              {insight.recommendedActions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    建议行动
                  </h4>
                  <ul className="space-y-2">
                    {insight.recommendedActions.map((a: any, i: number) => (
                      <li key={i} className="text-sm text-on-surface">
                        <span className={`font-medium px-1.5 py-0.5 rounded text-[10px] mr-1 ${
                          a.priority === "P0"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}>{a.priority}</span>
                        <span className="font-medium">{a.title}：</span>
                        {a.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk Warnings */}
              {insight.riskWarnings?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    风险提示
                  </h4>
                  <ul className="space-y-1.5">
                    {insight.riskWarnings.map((w: string, i: number) => (
                      <li
                        key={i}
                        className="text-sm text-on-surface-variant flex items-start gap-1.5"
                      >
                        <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validation Summary */}
              {insight.validationSummary && (
                <div className="bg-surface-container-low rounded-lg p-3 border border-outline-variant">
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    校验概要
                  </h4>
                  <div className="flex gap-4 text-xs text-on-surface-variant">
                    <span>Hard: {insight.validationSummary.hardValidation}</span>
                    <span>Semantic: {insight.validationSummary.semanticScore}/100</span>
                    <span>证据断裂: {insight.validationSummary.evidenceBroken}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex gap-3 justify-end">
              <button
                onClick={() => {
                  const text = [
                    insight.title,
                    "",
                    "一句话摘要：",
                    insight.oneLineSummary,
                    "",
                    "Top 问题：",
                    ...(insight.topProblems || []).map(
                      (p: any) =>
                        `- [${p.priority}] ${p.title}（${p.feedbackCount}条 · ${p.segmentName}）`
                    ),
                    "",
                    "P0 紧急问题：",
                    ...(insight.p0Issues || []).map(
                      (p: any) =>
                        `- ${p.title}（${p.feedbackCount}条 · ${p.segmentName}）`
                    ),
                    "",
                    "跨分组共性：",
                    ...(insight.crossSegmentPatterns || []).map(
                      (p: any) => `- ${p.description}`
                    ),
                    "",
                    "建议行动：",
                    ...(insight.recommendedActions || []).map(
                      (a: any) => `- [${a.priority}] ${a.title}：${a.action}`
                    ),
                    "",
                    "风险提示：",
                    ...(insight.riskWarnings || []).map(
                      (w: string) => `- ${w}`
                    ),
                  ].join("\n");
                  navigator.clipboard.writeText(text);
                  showToast("已复制到剪贴板");
                }}
                className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2"
              >
                <Copy size={14} /> 复制洞察
              </button>
              <button
                onClick={() => handleDownload("report-insight-json")}
                className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-high text-sm font-medium text-primary hover:bg-secondary-container transition-colors flex items-center gap-2"
              >
                <Download size={14} /> 下载 JSON
              </button>
              <button
                onClick={() => setShowInsightModal(false)}
                className="px-4 py-2 rounded-lg bg-primary-container text-white text-sm font-medium hover:bg-primary-container transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segment Insight Modal */}
      {showSegInsightModal && segInsight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowSegInsightModal(false)}
        >
          <div
            className="bg-surface-container-lowest rounded-[24px] shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Sparkles size={18} className="text-on-surface-variant" />
                分组洞察：{segInsight.segmentId}
              </h3>
              <button
                onClick={() => setShowSegInsightModal(false)}
                className="text-on-surface-variant/60 hover:text-on-surface-variant text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                  一句话摘要
                </h4>
                <p className="text-sm text-on-surface leading-relaxed">
                  {segInsight.oneLineSummary}
                </p>
              </div>

              {segInsight.topRisks?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Top 风险
                  </h4>
                  <ul className="space-y-2">
                    {segInsight.topRisks.map((r: any, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                        <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.priority === "P0" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                        }`}>{r.priority}</span>
                        <span>{r.title}（{r.feedbackCount} 条反馈）</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {segInsight.recommendedActions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    建议行动
                  </h4>
                  <ul className="space-y-2">
                    {segInsight.recommendedActions.map((a: any, i: number) => (
                      <li key={i} className="text-sm text-on-surface">
                        <span className="font-medium">{a.title}：</span>
                        {a.action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {segInsight.followUpQuestions?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    需要进一步验证
                  </h4>
                  <ul className="space-y-1">
                    {segInsight.followUpQuestions.map((q: any, i: number) => (
                      <li key={i} className="text-sm text-on-surface-variant flex items-start gap-1.5">
                        <HelpCircle size={14} className="text-primary mt-0.5 shrink-0" />
                        {q.question}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-outline-variant flex gap-3 justify-end">
              <button
                onClick={() => {
                  const text = [
                    segInsight.title,
                    "",
                    "一句话摘要：",
                    segInsight.oneLineSummary,
                    "",
                    "Top 风险：",
                    ...(segInsight.topRisks || []).map(
                      (r: any) => `- [${r.priority}] ${r.title}（${r.feedbackCount}条）`
                    ),
                    "",
                    "建议行动：",
                    ...(segInsight.recommendedActions || []).map(
                      (a: any) => `- ${a.title}：${a.action}`
                    ),
                  ].join("\n");
                  navigator.clipboard.writeText(text);
                  showToast("已复制到剪贴板");
                }}
                className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-2"
              >
                <Copy size={14} /> 复制
              </button>
              <button
                onClick={() => handleDownload("insight-json")}
                className="px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-high text-sm font-medium text-primary hover:bg-secondary-container transition-colors flex items-center gap-2"
              >
                <Download size={14} /> 下载 JSON
              </button>
              <button
                onClick={() => setShowSegInsightModal(false)}
                className="px-4 py-2 rounded-lg bg-primary-container text-white text-sm font-medium hover:bg-primary-container transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
