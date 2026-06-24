"use client";

import { Sparkles } from "lucide-react";
import type { IssueCluster, SegmentData } from "@/lib/report-helpers";
import { deriveHealthScore } from "@/lib/report-helpers";
import ExecutiveSummaryCard from "./ExecutiveSummaryCard";
import RiskCards from "./RiskCards";
import IssueOverviewTable from "./IssueOverviewTable";
import OpportunityCards from "./OpportunityCards";
import ActionPlanCard from "./ActionPlanCard";
import RiskReminderCard from "./RiskReminderCard";
import ValidationQuestionsCard from "./ValidationQuestionsCard";
import MarkdownCollapse from "./MarkdownCollapse";

interface SegmentReportViewProps {
  segmentData: SegmentData | null;
  segmentMd?: string | null;
  overallMd?: string | null;
  hardVal?: any;
  semVal?: any;
}

export default function SegmentReportView({
  segmentData,
  segmentMd,
  overallMd,
  hardVal,
  semVal,
}: SegmentReportViewProps) {
  const clusters: IssueCluster[] = segmentData?.issue_clusters || [];
  const segmentName = segmentData?.segment_id || "未知分组";
  const feedbackCount = segmentData?.summary?.feedback_count || 0;
  const clusterCount = clusters.length;
  const healthScore = deriveHealthScore(hardVal, semVal);

  // Build executive summary from top clusters
  let summaryText = "";
  if (clusters.length > 0) {
    const topIssues = clusters.slice(0, 3).map((c) => c.name).join("、");
    summaryText = `本分组共识别 ${clusterCount} 个问题，覆盖 ${feedbackCount} 条反馈。核心问题集中在${topIssues}。请优先关注 P0/P1 问题。`;
  }

  // Markdown to display: prefer segment-specific, fallback to overall
  const mdContent = segmentMd || overallMd;

  return (
    <div className="space-y-6">
      {/* Executive Summary + Risk Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <ExecutiveSummaryCard
          segmentName={segmentName}
          summary={summaryText}
          healthScore={healthScore}
        />
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          <RiskCards clusters={clusters} />
        </div>
      </section>

      {/* Issue Overview Table */}
      <IssueOverviewTable clusters={clusters} />

      {/* High Priority Opportunities */}
      <section>
        <h3 className="text-title-lg font-headline-sm text-on-surface mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          高优先级机会详述
        </h3>
        <OpportunityCards clusters={clusters} />
      </section>

      {/* Action Plan + Risk + Validation */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ActionPlanCard clusters={clusters} />
        </div>
        <div className="flex flex-col gap-5">
          <RiskReminderCard clusters={clusters} />
          <ValidationQuestionsCard clusters={clusters} />
        </div>
      </section>

      {/* Markdown Collapse */}
      <MarkdownCollapse content={mdContent} />
    </div>
  );
}
