"use client";

import { AlertTriangle } from "lucide-react";
import type { IssueCluster } from "@/lib/report-helpers";

interface RiskReminderCardProps {
  clusters: IssueCluster[];
}

export default function RiskReminderCard({ clusters }: RiskReminderCardProps) {
  const p0Clusters = clusters.filter((c) => c.priority === "P0");
  const lowEvidenceClusters = clusters.filter(
    (c) => c.feedback_count <= 3 && c.priority !== "P2"
  );

  if (p0Clusters.length === 0 && lowEvidenceClusters.length === 0) {
    return (
      <div className="bg-secondary-container/30 border border-secondary-container rounded-[24px] p-5 shadow-diffused">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={20} className="text-secondary shrink-0 mt-0.5" />
          <h4 className="text-body-md font-bold text-on-surface">风险状态良好</h4>
        </div>
        <p className="text-body-md text-on-surface-variant leading-relaxed font-body-md">
          当前分析未发现严重风险。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-error-container/30 border border-error-container rounded-[24px] p-5 shadow-diffused">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle size={20} className="text-error shrink-0 mt-0.5" />
        <h4 className="text-body-md font-bold text-on-surface">风险提醒</h4>
      </div>
      <div className="space-y-2">
        {p0Clusters.length > 0 && (
          <p className="text-body-md text-on-surface-variant leading-relaxed font-body-md">
            本分组有 <strong>{p0Clusters.length}</strong> 个 P0 级问题，需优先处理。
          </p>
        )}
        {lowEvidenceClusters.length > 0 && (
          <div>
            <p className="text-body-md text-on-surface-variant leading-relaxed font-body-md">
              以下问题证据较少，建议补充验证：
            </p>
            <ul className="mt-1 space-y-1">
              {lowEvidenceClusters.map((c, i) => (
                <li
                  key={i}
                  className="text-label-sm text-on-surface-variant flex items-center gap-1 font-body-md"
                >
                  <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                  {c.name}（{c.feedback_count} 条反馈）
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
