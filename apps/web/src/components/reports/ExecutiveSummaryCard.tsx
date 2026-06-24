"use client";

import { Lightbulb } from "lucide-react";

interface ExecutiveSummaryCardProps {
  segmentName: string;
  summary: string;
  healthScore: number;
}

export default function ExecutiveSummaryCard({
  segmentName,
  summary,
  healthScore,
}: ExecutiveSummaryCardProps) {
  const scoreDisplay = healthScore > 0 ? healthScore : 0;
  const barWidth = `${Math.min(scoreDisplay, 100)}%`;

  return (
    <div className="lg:col-span-4 bg-surface-container-lowest rounded-[24px] p-6 border border-outline-variant shadow-diffused relative overflow-hidden flex flex-col justify-between">
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-secondary-container rounded-full blur-2xl pointer-events-none" />
      <div>
        <div className="flex items-center gap-2 mb-4 text-secondary">
          <Lightbulb size={20} />
          <h3 className="text-title-lg font-headline-sm text-on-surface">老板摘要</h3>
        </div>
        <p className="text-body-md text-on-surface-variant leading-relaxed font-body-md">
          {summary || "暂无摘要数据。"}
        </p>
      </div>
      <div className="mt-4 pt-4 border-t border-outline-variant/30">
        <div className="flex items-center justify-between text-label-sm mb-1.5">
          <span className="text-on-surface-variant font-body-md">整体健康评分</span>
          <span className="text-primary font-bold text-headline-sm">
            {scoreDisplay}/100
          </span>
        </div>
        <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-primary h-full rounded-full transition-all"
            style={{ width: barWidth }}
          />
        </div>
      </div>
    </div>
  );
}
