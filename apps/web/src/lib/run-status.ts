export type RunDisplayStatus =
  | "completed"
  | "running"
  | "review"
  | "failed"
  | "partial"
  | "pending";

export interface RunLike {
  status?: string;
  hardValidation?: {
    status?: string;
    score?: number;
    pass?: number;
    warning?: number;
    fail?: number;
  };
  semanticValidation?: {
    status?: string;
    score?: number;
    criticalIssues?: number;
    evidenceBroken?: number;
  };
  validation?: {
    score?: number;
    hardScore?: number;
    passed?: boolean;
  };
  hardScore?: number | null;
  semanticScore?: number | null;
  hardValidationPassed?: boolean;
  isRunning?: boolean;
  error?: string;
}

/**
 * 判断 run 的展示状态
 * 优先级：
 * 1. 明确的 status 值（completed/running/failed/pending）
 * 2. 模糊的 status 值（warning/review/needs_review）→ 根据产物推断
 * 3. 无 status → 根据产物推断
 */
export function getRunDisplayStatus(run: RunLike): RunDisplayStatus {
  // 1. 明确的 status 值直接映射
  if (run.status) {
    const status = run.status.toLowerCase();
    switch (status) {
      case "completed":
      case "success":
      case "passed":
      case "pass":
      case "done":
        return "completed";
      case "running":
      case "processing":
      case "in_progress":
        return "running";
      case "failed":
      case "error":
        return "failed";
      case "pending":
        return "pending";
    }
  }

  // 2. 模糊 status 或无 status → 根据产物推断
  if (run.isRunning) return "running";

  const hardScore =
    run.hardScore ??
    run.hardValidation?.score ??
    run.validation?.hardScore ??
    run.validation?.score;
  const hardPassed =
    run.hardValidationPassed ?? run.validation?.passed ?? false;
  const semanticScore = run.semanticValidation?.score;
  const evidenceBroken = run.semanticValidation?.evidenceBroken ?? 0;
  const criticalIssues = run.semanticValidation?.criticalIssues ?? 0;

  // failed: 有 error / hardScore === 0 / criticalIssues > 0
  if (run.error || hardScore === 0 || criticalIssues > 0) {
    return "failed";
  }

  // completed: hardScore >= 85 或 passed, semanticScore >= 85, evidenceBroken === 0
  if (
    (hardScore !== undefined && hardScore >= 85 || hardPassed) &&
    semanticScore !== undefined &&
    semanticScore >= 85 &&
    evidenceBroken === 0
  ) {
    return "completed";
  }

  // review: semanticScore < 85 或 evidenceBroken > 0
  if (
    (semanticScore !== undefined && semanticScore < 85) ||
    evidenceBroken > 0
  ) {
    return "review";
  }

  // partial: 有部分数据但不完整
  if (hardScore !== undefined || semanticScore !== undefined) {
    return "partial";
  }

  // pending: 无足够信息
  return "pending";
}

/** 状态中文标签 */
export function getRunStatusLabel(status: RunDisplayStatus): string {
  const map: Record<RunDisplayStatus, string> = {
    completed: "已完成",
    running: "处理中",
    review: "需复核",
    failed: "失败",
    partial: "部分完成",
    pending: "等待中",
  };
  return map[status];
}

/** 状态 Badge 样式 (Renance 暖色风格) */
export function getRunStatusBadgeClass(status: RunDisplayStatus): string {
  switch (status) {
    case "completed":
      return "bg-[#E7ECDD] text-[#2F6B3F] border-[#CAD5B8]";
    case "running":
      return "bg-[#EFE4CC] text-[#6F5E3B] border-[#D8CDBA]";
    case "review":
      return "bg-[#F3E5C8] text-[#8A5A00] border-[#E7C77B]";
    case "failed":
      return "bg-[#F3DCDC] text-[#8A2F2F] border-[#D8A0A0]";
    case "partial":
      return "bg-[#EEE8DA] text-[#6F6A5F] border-[#D8CDBA]";
    case "pending":
      return "bg-[#EEE8DA] text-[#6F6A5F] border-[#D8CDBA]";
  }
}

/** 硬性校验显示文本 */
export function getRunHardScoreLabel(run: RunLike): string {
  const score =
    run.hardScore ??
    run.hardValidation?.score ??
    run.validation?.hardScore ??
    run.validation?.score;

  if (score !== undefined && score !== null) {
    return String(score);
  }

  if (run.hardValidationPassed === true) {
    return "通过";
  }

  return "未生成";
}
