import type { AIProvider } from "./types";
import { OpenAIProvider } from "./openai-provider";
import { DeepSeekProvider } from "./deepseek-provider";

let cachedProvider: AIProvider | null = null;
let cachedValidationProvider: AIProvider | null = null;

/**
 * 获取主 AI Provider（用于分析和报告生成）
 */
export function getAIProvider(): AIProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerName = process.env.AI_PROVIDER || "openai";

  switch (providerName) {
    case "deepseek": {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error("DEEPSEEK_API_KEY environment variable is required");
      }

      const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
      const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

      cachedProvider = new DeepSeekProvider({
        apiKey,
        model,
        baseUrl,
      });
      break;
    }
    case "openai":
    default: {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is required");
      }

      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const baseUrl = process.env.OPENAI_BASE_URL;

      cachedProvider = new OpenAIProvider({
        apiKey,
        model,
        baseUrl,
      });
      break;
    }
  }

  return cachedProvider;
}

/**
 * 获取验证 AI Provider（用于语义审查）
 * 优先使用 DeepSeek，如果配置了的话
 */
export function getValidationAIProvider(): {
  provider: AIProvider;
  providerName: string;
  modelName: string;
  fallback: boolean;
} {
  if (cachedValidationProvider) {
    const providerName = process.env.VALIDATION_AI_PROVIDER || "deepseek";
    const modelName = providerName === "deepseek"
      ? (process.env.DEEPSEEK_VALIDATION_MODEL || "deepseek-v4-pro")
      : (process.env.OPENAI_MODEL || "gpt-4o-mini");
    return {
      provider: cachedValidationProvider,
      providerName,
      modelName,
      fallback: false,
    };
  }

  const providerName = process.env.VALIDATION_AI_PROVIDER || "deepseek";

  if (providerName === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.warn("DEEPSEEK_API_KEY not set, falling back to main provider");
      return {
        provider: getAIProvider(),
        providerName: process.env.AI_PROVIDER || "openai",
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        fallback: true,
      };
    }

    const model = process.env.DEEPSEEK_VALIDATION_MODEL || "deepseek-v4-pro";
    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

    cachedValidationProvider = new DeepSeekProvider({
      apiKey,
      model,
      baseUrl,
    });

    return {
      provider: cachedValidationProvider,
      providerName: "deepseek",
      modelName: model,
      fallback: false,
    };
  }

  // Fall back to main provider
  return {
    provider: getAIProvider(),
    providerName: process.env.AI_PROVIDER || "openai",
    modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
    fallback: true,
  };
}
