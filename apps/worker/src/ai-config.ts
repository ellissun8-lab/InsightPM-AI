/**
 * AI / Prompt 版本管理
 *
 * 每次 run 记录实际使用的 prompt 版本和模型版本，
 * 便于质量追溯和 A/B 对比。
 */

// Prompt 版本号
// 修改 prompt 后必须递增版本号
export const PROMPT_VERSION = "ai-analysis-v1.2";
export const VALIDATION_PROMPT_VERSION = "semantic-validation-v1.1";

// 模型版本（从环境变量读取，不硬编码）
export function getAiConfig(): {
  promptVersion: string;
  validationPromptVersion: string;
  aiProvider: string;
  aiModel: string;
  aiBaseUrlHost: string;
  validationProvider: string;
  validationModel: string;
  validationBaseUrlHost: string;
} {
  const aiBaseUrl = process.env.OPENAI_BASE_URL || "";
  const validationBaseUrl = process.env.DEESEEK_BASE_URL || "";

  return {
    promptVersion: PROMPT_VERSION,
    validationPromptVersion: VALIDATION_PROMPT_VERSION,
    aiProvider: process.env.AI_PROVIDER || "unknown",
    aiModel: process.env.OPENAI_MODEL || "unknown",
    aiBaseUrlHost: extractHost(aiBaseUrl),
    validationProvider: process.env.VALIDATION_AI_PROVIDER || "unknown",
    validationModel: process.env.DEESEEK_VALIDATION_MODEL || "unknown",
    validationBaseUrlHost: extractHost(validationBaseUrl),
  };
}

function extractHost(url: string): string {
  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return "unknown";
  }
}
