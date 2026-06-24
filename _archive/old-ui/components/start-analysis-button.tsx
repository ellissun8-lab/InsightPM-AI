"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface StartAnalysisButtonProps {
  projectId: string;
  batchId: string | null;
  disabled?: boolean;
}

export function StartAnalysisButton({
  projectId,
  batchId,
  disabled,
}: StartAnalysisButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleStartAnalysis = async () => {
    setLoading(true);

    try {
      // Create analysis run
      const createRes = await fetch("/api/analysis-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          batch_id: batchId,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || "创建分析任务失败");
      }

      const { run_id } = await createRes.json();

      // Start processing
      const processRes = await fetch(
        `/api/analysis-runs/${run_id}/process`,
        {
          method: "POST",
        }
      );

      if (!processRes.ok) {
        const data = await processRes.json();
        throw new Error(data.error || "分析失败");
      }

      const result = await processRes.json();
      toast.success(
        `分析完成，生成了 ${result.issue_cluster_count} 个问题簇`
      );

      // Navigate to analysis result
      router.push(`/projects/${projectId}/analysis/${run_id}`);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "分析失败，请重试";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleStartAnalysis} disabled={disabled || loading}>
      {loading ? "分析中..." : "开始分析"}
    </Button>
  );
}
