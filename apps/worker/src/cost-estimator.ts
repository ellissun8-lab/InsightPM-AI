/**
 * 轻量成本估算工具
 *
 * 当前 MiMo / DeepSeek API 不返回 token usage，
 * 保留结构以便未来补全。
 */

// 模型价格配置（USD per 1M tokens）
// 当前未知实际价格，保持 null
const MODEL_PRICING: Record<string, { inputPrice: number | null; outputPrice: number | null }> = {
  "mimo-v2.5-pro": { inputPrice: null, outputPrice: null },
  "deepseek-v4-pro": { inputPrice: null, outputPrice: null },
  "deepseek-chat": { inputPrice: null, outputPrice: null },
};

export interface CostEstimateInput {
  provider?: string;
  model?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
}

export interface CostEstimateResult {
  costEstimatedUsd: number | null;
  costPerFeedbackUsd: number | null;
  tokenUsage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  } | null;
}

export function estimateRunCost(
  input: CostEstimateInput,
  feedbackCount: number
): CostEstimateResult {
  const tokenUsage =
    input.inputTokens != null || input.outputTokens != null
      ? {
          inputTokens: input.inputTokens ?? null,
          outputTokens: input.outputTokens ?? null,
          totalTokens:
            (input.inputTokens ?? 0) + (input.outputTokens ?? 0) || null,
        }
      : null;

  if (!input.model || !tokenUsage || tokenUsage.totalTokens == null) {
    return {
      costEstimatedUsd: null,
      costPerFeedbackUsd: null,
      tokenUsage,
    };
  }

  const pricing = MODEL_PRICING[input.model];
  if (!pricing || pricing.inputPrice == null || pricing.outputPrice == null) {
    return {
      costEstimatedUsd: null,
      costPerFeedbackUsd: null,
      tokenUsage,
    };
  }

  const costUsd =
    ((input.inputTokens ?? 0) / 1_000_000) * pricing.inputPrice +
    ((input.outputTokens ?? 0) / 1_000_000) * pricing.outputPrice;

  const costPerFeedback =
    feedbackCount > 0 ? costUsd / feedbackCount : null;

  return {
    costEstimatedUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
    costPerFeedbackUsd:
      costPerFeedback != null
        ? Math.round(costPerFeedback * 1_000_000) / 1_000_000
        : null,
    tokenUsage,
  };
}

/**
 * 从 run-summary.json 构建 metrics 对象
 */
export function buildMetricsFromSummary(summary: any, feedbackCount: number): Record<string, any> {
  const durationMs = summary.durationMs || summary.duration_ms || null;
  const durationSeconds = durationMs != null ? Math.round(durationMs / 1000) : null;

  const stepDurations = (summary.steps || []).map((s: any) => ({
    step: s.stepName || s.name || s.step || "unknown",
    status: s.status || "unknown",
    durationMs: s.durationMs ?? s.duration_ms ?? null,
    slowStep: s.slowStep || false,
  }));

  const slowSteps = stepDurations
    .filter((s: any) => s.slowStep)
    .map((s: any) => s.step);

  // AI provider/model from env or summary
  const aiProvider = summary.aiProvider || process.env.AI_PROVIDER || null;
  const aiModel = summary.aiModel || process.env.OPENAI_MODEL || null;
  const validationProvider = summary.validationProvider || process.env.VALIDATION_AI_PROVIDER || null;
  const validationModel = summary.validationModel || process.env.DEESEEK_VALIDATION_MODEL || null;

  // Token usage - currently not available from MiMo/DeepSeek
  const costResult = estimateRunCost(
    {
      provider: aiProvider || undefined,
      model: aiModel || undefined,
      inputTokens: summary.inputTokens ?? null,
      outputTokens: summary.outputTokens ?? null,
    },
    feedbackCount
  );

  return {
    durationMs,
    durationSeconds,
    feedbackCount,
    aiProvider,
    aiModel,
    validationProvider,
    validationModel,
    stepDurations,
    slowSteps,
    tokenUsage: costResult.tokenUsage,
    costEstimatedUsd: costResult.costEstimatedUsd,
    costPerFeedbackUsd: costResult.costPerFeedbackUsd,
    startedAt: summary.startedAt || null,
    completedAt: summary.finishedAt || null,
    stepsPass: stepDurations.filter((s: any) => s.status === "pass").length,
    stepsFail: stepDurations.filter((s: any) => s.status === "fail" || s.status === "FAIL").length,
    stepsSkipped: stepDurations.filter((s: any) => s.status === "skip" || s.status === "skipped").length,
  };
}
