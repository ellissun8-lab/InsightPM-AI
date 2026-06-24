"use client";

import { AlertTriangle, Lightbulb } from "lucide-react";
import type { IssueCluster } from "@/lib/report-helpers";

interface OpportunityCardsProps {
  clusters: IssueCluster[];
}

export default function OpportunityCards({ clusters }: OpportunityCardsProps) {
  const opportunities = clusters
    .filter(
      (c) =>
        (c.priority === "P0" || c.priority === "P1") &&
        c.opportunity_score >= 70
    )
    .slice(0, 2);

  if (opportunities.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused p-12 text-center text-body-md text-on-surface-variant font-body-md">
        该分组暂无高优先级机会。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {opportunities.map((o, i) => {
        const isP0 = o.priority === "P0";
        const priorityStyle = isP0
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-blue-50 text-blue-700 border-blue-200";
        const metric = o.possible_metrics?.[0] || "待定义";
        const timeline = isP0
          ? "紧急，1-2 Sprints"
          : "中等，2-3 Sprints";

        return (
          <div
            key={i}
            className="bg-surface-container-lowest rounded-[24px] border border-outline-variant p-6 shadow-diffused flex flex-col gap-4"
          >
            <div className="flex justify-between items-start">
              <h4 className="text-title-lg font-headline-sm text-on-surface">{o.name}</h4>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border flex items-center gap-1 ${priorityStyle}`}
              >
                {isP0 ? (
                  <AlertTriangle size={12} />
                ) : (
                  <Lightbulb size={12} />
                )}
                {o.priority}
              </span>
            </div>
            <p className="text-body-md text-on-surface-variant leading-relaxed font-body-md">{o.summary}</p>
            {o.recommendation && (
              <div className="bg-surface-container-high rounded-lg p-4 border-l-[3px] border-primary">
                <p className="text-body-md text-on-surface italic mb-1.5 font-body-md">
                  &ldquo;{o.recommendation}&rdquo;
                </p>
                <span className="text-label-sm text-on-surface-variant font-body-md">
                  — 建议措施
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t border-outline-variant/30">
              <div>
                <span className="block text-label-sm text-on-surface-variant mb-1 font-body-md">
                  建议追踪指标
                </span>
                <span className="text-body-md font-medium text-on-surface font-body-md">
                  {metric}
                </span>
              </div>
              <div>
                <span className="block text-label-sm text-on-surface-variant mb-1 font-body-md">
                  预计开发周期
                </span>
                <span className="text-body-md font-medium text-on-surface font-body-md">
                  {timeline}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
