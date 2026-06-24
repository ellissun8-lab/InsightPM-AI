"use client";

import { CheckCircle, AlertCircle, XCircle } from "lucide-react";
import type { IssueCluster } from "@/lib/report-helpers";
import { getEvidenceStatus } from "@/lib/report-helpers";

interface IssueOverviewTableProps {
  clusters: IssueCluster[];
}

const priorityStyles: Record<string, string> = {
  P0: "bg-red-50 text-red-700 border-red-200",
  P1: "bg-blue-50 text-blue-700 border-blue-200",
  P2: "bg-surface-variant text-on-surface-variant border-outline-variant",
};

function EvidenceBadge({ evidence }: { evidence: string }) {
  if (evidence === "证据丰富") {
    return (
      <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
        <CheckCircle size={14} /> 强证据
      </span>
    );
  }
  if (evidence === "需补充") {
    return (
      <span className="flex items-center gap-1 text-on-surface-variant text-xs font-medium font-body-md">
        <AlertCircle size={14} /> 需补充
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <XCircle size={14} /> 弱证据
    </span>
  );
}

export default function IssueOverviewTable({ clusters }: IssueOverviewTableProps) {
  if (clusters.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused p-12 text-center text-body-md text-on-surface-variant font-body-md">
        该分组暂无聚类分析结果。
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused overflow-hidden">
      <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <h3 className="text-title-lg font-headline-sm text-on-surface">高频问题概览</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low">
              <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider w-16 font-semibold">
                排名
              </th>
              <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                问题名称
              </th>
              <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                反馈数
              </th>
              <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                优先级
              </th>
              <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                机会得分
              </th>
              <th className="px-6 py-3 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                证据状态
              </th>
            </tr>
          </thead>
          <tbody className="text-body-md font-body-md">
            {clusters.map((c, i) => {
              const evidenceStatus = getEvidenceStatus(
                c.evidence_feedback_ids.length
              );
              return (
                <tr
                  key={c.cluster_id || i}
                  className="border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-6 py-4 text-on-surface-variant/60 font-bold">
                    {i + 1}
                  </td>
                  <td className="px-6 py-4 font-medium text-on-surface">
                    {c.name}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {c.feedback_count}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        priorityStyles[c.priority] || priorityStyles.P2
                      }`}
                    >
                      {c.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-primary">
                    {c.opportunity_score}
                  </td>
                  <td className="px-6 py-4">
                    <EvidenceBadge evidence={evidenceStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
