export type RunDisplayStatus =
  | "completed"
  | "running"
  | "review"
  | "failed"
  | "partial"
  | "pending";

export type RunLike = {
  [key: string]: unknown;
  status?: string | null;
  isRunning?: boolean | null;
  error?: unknown;
  errors?: unknown;
  hardScore?: number | string | null;
  hardValidationScore?: number | string | null;
  hardValidationPassed?: boolean | null;
  semanticScore?: number | string | null;
  evidenceBroken?: number | string | null;
  criticalIssues?: number | string | null;
  validation?: unknown;
  summary?: unknown;
  hard?: unknown;
  hardValidation?: unknown;
  semanticValidation?: unknown;
  artifacts?: unknown;
  metadata?: unknown;
};

const STATUS_LABELS: Record<RunDisplayStatus, string> = {
  completed: "已完成",
  running: "处理中",
  review: "需复核",
  failed: "失败",
  partial: "部分完成",
  pending: "等待中",
};

const STATUS_BADGE_CLASSES: Record<RunDisplayStatus, string> = {
  completed: "bg-[#E7ECDD] text-[#2F6B3F] border-[#CAD5B8]",
  running: "bg-[#EFE4CC] text-[#6F5E3B] border-[#D8CDBA]",
  review: "bg-[#F3E5C8] text-[#8A5A00] border-[#E7C77B]",
  failed: "bg-[#F3DCDC] text-[#8A2F2F] border-[#D8A0A0]",
  partial: "bg-[#EEE8DA] text-[#6F6A5F] border-[#D8CDBA]",
  pending: "bg-[#EEE8DA] text-[#6F6A5F] border-[#D8CDBA]",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function firstNumber(run: RunLike, paths: string[][]): number | null {
  for (const path of paths) {
    const value = toNumber(readPath(run, path));
    if (value !== null) return value;
  }
  return null;
}

function firstBoolean(run: RunLike, paths: string[][]): boolean | null {
  for (const path of paths) {
    const value = readPath(run, path);
    if (typeof value === "boolean") return value;
  }
  return null;
}

function hasSignal(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  const record = asRecord(value);
  return !!record && Object.keys(record).length > 0;
}

function normalizeStatus(status: unknown): string {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

export function getRunHardScore(run: RunLike): number | null {
  return firstNumber(run, [
    ["hardScore"],
    ["hardValidationScore"],
    ["validation", "hardScore"],
    ["summary", "hardScore"],
    ["hard"],
    ["hard", "score"],
    ["hardValidation", "score"],
    ["validation", "score"],
  ]);
}

export function getRunSemanticScore(run: RunLike): number | null {
  return firstNumber(run, [
    ["semanticScore"],
    ["semanticValidation", "score"],
    ["validation", "semanticScore"],
    ["summary", "semanticScore"],
  ]);
}

function getRunEvidenceBroken(run: RunLike): number | null {
  return firstNumber(run, [
    ["evidenceBroken"],
    ["semanticValidation", "evidenceBroken"],
    ["validation", "evidenceBroken"],
    ["summary", "evidenceBroken"],
  ]);
}

function getRunCriticalIssues(run: RunLike): number | null {
  return firstNumber(run, [
    ["criticalIssues"],
    ["semanticValidation", "criticalIssues"],
    ["validation", "criticalIssues"],
    ["summary", "criticalIssues"],
  ]);
}

function getRunHardValidationPassed(run: RunLike): boolean | null {
  const explicit = firstBoolean(run, [
    ["hardValidationPassed"],
    ["validation", "hardValidationPassed"],
    ["validation", "passed"],
    ["hardValidation", "passed"],
  ]);
  if (explicit !== null) return explicit;

  const hardStatus = normalizeStatus(readPath(run, ["hardValidation", "status"]));
  if (["pass", "passed", "success", "completed", "done"].includes(hardStatus)) {
    return true;
  }
  if (["fail", "failed", "error"].includes(hardStatus)) {
    return false;
  }

  return null;
}

function hasCompletedArtifact(run: RunLike): boolean {
  const artifactPaths = [
    ["artifacts", "markdown"],
    ["artifacts", "md"],
    ["artifacts", "report"],
    ["artifacts", "json"],
    ["artifacts", "hasMarkdown"],
    ["artifacts", "hasReport"],
    ["artifacts", "hasJson"],
    ["metadata", "artifacts", "markdown"],
    ["metadata", "artifacts", "report"],
    ["metadata", "artifacts", "json"],
    ["metadata", "hasReport"],
    ["hasReport"],
    ["markdown"],
    ["report"],
    ["json"],
    ["reportPath"],
    ["markdownPath"],
    ["jsonPath"],
  ];

  return artifactPaths.some((path) => hasSignal(readPath(run, path)));
}

function hasErrorSignal(run: RunLike): boolean {
  return hasSignal(run.error) || hasSignal(run.errors) || hasSignal(readPath(run, ["metadata", "error"]));
}

function hasReviewSignal(run: RunLike): boolean {
  return [
    ["warning"],
    ["warnings"],
    ["needsValidation"],
    ["validation", "warning"],
    ["validation", "warnings"],
    ["validation", "needsValidation"],
    ["summary", "warning"],
    ["summary", "warnings"],
    ["summary", "needsValidation"],
    ["metadata", "warning"],
    ["metadata", "warnings"],
    ["metadata", "needsValidation"],
  ].some((path) => hasSignal(readPath(run, path)));
}

function isFreshlyCreated(run: RunLike): boolean {
  const createdAt =
    readPath(run, ["createdAt"]) ??
    readPath(run, ["startedAt"]) ??
    readPath(run, ["timestamp"]);
  if (typeof createdAt !== "string" || createdAt.trim() === "") return false;

  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return false;

  const finishedAt = readPath(run, ["finishedAt"]);
  const updatedAt = readPath(run, ["updatedAt"]);
  const hasFinishedTime =
    (typeof finishedAt === "string" && finishedAt.trim() !== "") ||
    (typeof updatedAt === "string" && updatedAt.trim() !== "" && updatedAt !== createdAt);

  return !hasFinishedTime && Date.now() - createdTime < 15 * 60 * 1000;
}

export function getRunDisplayStatus(run: RunLike): RunDisplayStatus {
  const explicitStatus = normalizeStatus(run.status);

  if (["completed", "success", "passed", "pass", "done"].includes(explicitStatus)) {
    return "completed";
  }
  if (["running", "processing", "in_progress"].includes(explicitStatus)) {
    return "running";
  }
  if (["failed", "fail", "error"].includes(explicitStatus)) {
    return "failed";
  }
  if (explicitStatus === "pending") {
    return "pending";
  }

  if (run.isRunning === true) return "running";

  const hardScore = getRunHardScore(run);
  const hardPassed = getRunHardValidationPassed(run);
  const semanticScore = getRunSemanticScore(run);
  const evidenceBroken = getRunEvidenceBroken(run);
  const criticalIssues = getRunCriticalIssues(run);
  const hasArtifact = hasCompletedArtifact(run);
  const hasReviewStatus = ["review", "needs_review", "warning"].includes(explicitStatus);

  if (hasErrorSignal(run) || hardScore === 0 || (criticalIssues !== null && criticalIssues > 0)) {
    return "failed";
  }

  const hardOk = (hardScore !== null && hardScore >= 85) || hardPassed === true;
  const semanticOk = semanticScore !== null && semanticScore >= 85;
  const evidenceOk = evidenceBroken !== null && evidenceBroken === 0;

  if (hardOk && semanticOk && evidenceOk && hasArtifact) {
    return "completed";
  }

  if (
    (semanticScore !== null && semanticScore < 85) ||
    (evidenceBroken !== null && evidenceBroken > 0) ||
    hasReviewSignal(run) ||
    hasReviewStatus
  ) {
    return "review";
  }

  const hasHardInfo = hardScore !== null || hardPassed !== null;
  if ((hasArtifact || hasHardInfo || semanticScore !== null) && (!hasHardInfo || semanticScore === null)) {
    return "partial";
  }

  if (isFreshlyCreated(run)) return "running";

  return "pending";
}

export function getRunStatusLabel(status: RunDisplayStatus): string {
  return STATUS_LABELS[status];
}

export function getRunStatusBadgeClass(status: RunDisplayStatus): string {
  return STATUS_BADGE_CLASSES[status];
}

export function getRunHardValidationLabel(run: RunLike): string {
  const hardScore = getRunHardScore(run);
  if (hardScore !== null) return String(hardScore);

  const hardPassed = getRunHardValidationPassed(run);
  if (hardPassed === true) return "通过";
  if (hardPassed === false) return "未通过";

  return "未生成";
}

export function hasRunReportArtifact(run: RunLike): boolean {
  return hasCompletedArtifact(run);
}

/**
 * Check if a running task is stale (heartbeat > 10 min ago)
 */
export function isStaleRunning(run: RunLike): boolean {
  const status = normalizeStatus(run.status);
  if (status !== "running") return false;

  const heartbeatAt =
    (run as Record<string, unknown>).heartbeatAt ??
    readPath(run, ["metadata", "heartbeatAt"]) ??
    readPath(run, ["heartbeat_at"]);
  if (typeof heartbeatAt !== "string" || !heartbeatAt) return false;

  const heartbeatTime = new Date(heartbeatAt).getTime();
  if (!Number.isFinite(heartbeatTime)) return false;

  return Date.now() - heartbeatTime > 10 * 60 * 1000;
}

/**
 * Get worker step display text
 */
export function getWorkerStep(run: RunLike): string | null {
  const metadata = asRecord(run.metadata);
  if (metadata && typeof metadata.workerStep === "string") return metadata.workerStep;
  const ws = (run as Record<string, unknown>).workerStep;
  if (typeof ws === "string") return ws;
  return null;
}

/**
 * Get error info from run (metadata.error or lastError)
 */
export function getRunError(run: RunLike): Record<string, unknown> | null {
  const metaError = readPath(run, ["metadata", "error"]);
  if (asRecord(metaError)) return asRecord(metaError);
  const lastError = (run as Record<string, unknown>).lastError;
  if (asRecord(lastError)) return asRecord(lastError);
  return null;
}
