"use client";

import { CircleDot, Wrench } from "lucide-react";
import type { IssueCluster } from "@/lib/report-helpers";

interface ActionPlanCardProps {
  clusters: IssueCluster[];
}

export default function ActionPlanCard({ clusters }: ActionPlanCardProps) {
  const p0Clusters = clusters.filter((c) => c.priority === "P0");
  const p1Clusters = clusters.filter((c) => c.priority === "P1");

  const phase1Items = p0Clusters
    .filter((c) => c.feedback_count >= 5)
    .map((c) => ({
      title: c.name,
      desc: c.recommendation || c.summary,
    }));

  const phase2Items = [
    ...p0Clusters
      .filter((c) => c.feedback_count < 5)
      .map((c) => ({ title: c.name, desc: c.recommendation || c.summary })),
    ...p1Clusters.map((c) => ({
      title: c.name,
      desc: c.recommendation || c.summary,
    })),
  ];

  const phases = [
    {
      label: "第一阶段：立即处理",
      labelStyle: "bg-primary-container text-on-primary",
      icon: <CircleDot size={14} className="text-red-500 mt-0.5 shrink-0" />,
      items: phase1Items,
    },
    {
      label: "第二阶段：改善体验",
      labelStyle: "bg-surface-variant text-on-surface",
      icon: <Wrench size={14} className="text-blue-600 mt-0.5 shrink-0" />,
      items: phase2Items,
    },
  ];

  const hasAnyItems = phase1Items.length > 0 || phase2Items.length > 0;

  return (
    <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-outline-variant">
        <h3 className="text-title-lg font-headline-sm text-on-surface">建议行动计划</h3>
      </div>
      <div className="p-6 flex-1">
        {!hasAnyItems ? (
          <p className="text-body-md text-on-surface-variant text-center py-4 font-body-md">
            暂无行动计划建议。
          </p>
        ) : (
          <div className="space-y-5">
            {phases.map(
              (phase, pi) =>
                phase.items.length > 0 && (
                  <div
                    key={pi}
                    className="border border-outline-variant rounded-xl p-4 bg-surface-container-low/30"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold ${phase.labelStyle}`}
                      >
                        {phase.label}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {phase.items.map((item, ii) => (
                        <div key={ii} className="flex items-start gap-3">
                          {phase.icon}
                          <div>
                            <p className="text-body-md font-medium text-on-surface font-body-md">
                              {item.title}
                            </p>
                            <p className="text-label-sm text-on-surface-variant mt-0.5 line-clamp-2 font-body-md">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
