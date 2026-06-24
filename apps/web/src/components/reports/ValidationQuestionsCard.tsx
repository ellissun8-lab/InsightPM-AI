"use client";

import { HelpCircle } from "lucide-react";
import type { IssueCluster } from "@/lib/report-helpers";

interface ValidationQuestionsCardProps {
  clusters: IssueCluster[];
}

export default function ValidationQuestionsCard({
  clusters,
}: ValidationQuestionsCardProps) {
  const lowEvidence = clusters.filter(
    (c) => c.feedback_count <= 5 && c.feedback_count > 0
  );

  const questions = lowEvidence.slice(0, 3).map((c) => ({
    text: `「${c.name}」的数据是否充分？`,
    detail: `相关反馈量不足 (${c.feedback_count}条)`,
    action: c.feedback_count <= 2 ? "发起问卷" : "查阅埋点",
  }));

  return (
    <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused p-5 flex-1">
      <h4 className="text-body-md font-bold text-on-surface mb-4 flex items-center gap-2 font-body-md">
        <HelpCircle size={16} className="text-primary" />
        需要进一步验证
      </h4>
      {questions.length === 0 ? (
        <p className="text-body-md text-on-surface-variant text-center py-4 font-body-md">
          所有问题簇证据充足，暂无需验证项。
        </p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q, i) => (
            <li
              key={i}
              className="flex flex-col gap-1 pb-3 border-b border-outline-variant/50 last:border-0 last:pb-0"
            >
              <span className="text-body-md text-on-surface font-body-md">{q.text}</span>
              <div className="flex justify-between items-center text-label-sm">
                <span className="text-on-surface-variant font-body-md">{q.detail}</span>
                <button className="text-primary hover:underline font-medium font-body-md">
                  {q.action}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
