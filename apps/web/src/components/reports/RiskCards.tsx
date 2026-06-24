"use client";

import { AlertTriangle, Gauge, AlertCircle } from "lucide-react";
import type { IssueCluster } from "@/lib/report-helpers";

interface RiskCardsProps {
  clusters: IssueCluster[];
}

export default function RiskCards({ clusters }: RiskCardsProps) {
  const riskClusters = clusters
    .filter((c) => c.priority === "P0" || c.priority === "P1")
    .slice(0, 3);

  if (riskClusters.length === 0) {
    return (
      <div className="lg:col-span-3 bg-surface-container-lowest rounded-[24px] p-5 border border-outline-variant shadow-diffused text-center text-body-md text-on-surface-variant font-body-md">
        未发现 P0/P1 级风险问题。
      </div>
    );
  }

  return (
    <>
      {riskClusters.map((c, i) => {
        const isP0 = c.priority === "P0";
        const badge = isP0 ? "P0 风险" : "P1 问题";
        const badgeStyle = isP0
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-blue-50 text-blue-700 border-blue-200";
        const Icon = isP0 ? AlertTriangle : AlertCircle;
        const iconColor = isP0 ? "text-red-500" : "text-blue-600";

        return (
          <div
            key={i}
            className="bg-surface-container-lowest rounded-[24px] p-5 border border-outline-variant shadow-diffused flex flex-col h-full"
          >
            <div className="flex justify-between items-start mb-3">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeStyle}`}
              >
                {badge}
              </span>
              <Icon size={18} className={iconColor} />
            </div>
            <h4 className="text-body-md font-title-lg text-on-surface mb-2 font-bold">{c.name}</h4>
            <p className="text-label-sm text-on-surface-variant line-clamp-3 mb-auto leading-relaxed font-body-md">
              {c.summary}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-label-sm text-on-surface-variant bg-surface-container-low px-2.5 py-1.5 rounded-lg w-fit font-body-md">
              {c.feedback_count} 条相关反馈
            </div>
          </div>
        );
      })}
    </>
  );
}
