/**
 * 产品分析上下文配置
 * 定义不同产品类型的默认分析指标和规则
 */

export type ProductType = "b2b_saas" | "b2c" | "ecommerce" | "tool" | "other";

export interface ProductAnalysisConfig {
  /** 产品类型标识 */
  type: ProductType;
  /** 产品类型显示名称 */
  label: string;
  /** 默认关注指标 */
  defaultMetrics: string[];
  /** 默认业务目标选项 */
  businessGoalOptions: string[];
  /** 情绪分析阈值 */
  sentimentThresholds: {
    strongNegative: number;
    negative: number;
    neutral: number;
  };
  /** 置信度计算规则 */
  confidenceRules: {
    high: { minFeedbackCount: number; minEvidenceCount: number };
    medium: { minFeedbackCount: number; minEvidenceCount: number };
  };
  /** 优先级阈值 */
  priorityThresholds: {
    P0: number;
    P1: number;
    P2: number;
  };
}

/** B2B SaaS 产品配置 */
const B2B_SAAS_CONFIG: ProductAnalysisConfig = {
  type: "b2b_saas",
  label: "B端 SaaS",
  defaultMetrics: [
    "续费率",
    "留存率",
    "试用转化率",
    "客户满意度 (CSAT)",
    "客服成本",
    "管理员效率",
    "功能采纳率",
    "NPS",
  ],
  businessGoalOptions: [
    "提升续费",
    "提升留存",
    "提升试用转化",
    "降低客服成本",
    "提升管理员效率",
    "提升客户满意度",
    "提升增长",
    "提升激活",
    "探索机会",
  ],
  sentimentThresholds: {
    strongNegative: 4,
    negative: 3,
    neutral: 2,
  },
  confidenceRules: {
    high: { minFeedbackCount: 10, minEvidenceCount: 3 },
    medium: { minFeedbackCount: 5, minEvidenceCount: 2 },
  },
  priorityThresholds: {
    P0: 80,
    P1: 65,
    P2: 45,
  },
};

/** B2C 产品配置 */
const B2C_CONFIG: ProductAnalysisConfig = {
  type: "b2c",
  label: "C端产品",
  defaultMetrics: [
    "DAU",
    "MAU",
    "留存率",
    "用户时长",
    "转化率",
    "NPS",
    "App Store 评分",
  ],
  businessGoalOptions: [
    "提升增长",
    "提升激活",
    "提升留存",
    "提升转化",
    "提升用户时长",
    "提升满意度",
    "探索机会",
  ],
  sentimentThresholds: {
    strongNegative: 4,
    negative: 3,
    neutral: 2,
  },
  confidenceRules: {
    high: { minFeedbackCount: 20, minEvidenceCount: 5 },
    medium: { minFeedbackCount: 10, minEvidenceCount: 3 },
  },
  priorityThresholds: {
    P0: 80,
    P1: 65,
    P2: 45,
  },
};

/** 电商产品配置 */
const ECOMMERCE_CONFIG: ProductAnalysisConfig = {
  type: "ecommerce",
  label: "电商",
  defaultMetrics: [
    "GMV",
    "转化率",
    "客单价",
    "复购率",
    "退货率",
    "客服响应时间",
    "NPS",
  ],
  businessGoalOptions: [
    "提升 GMV",
    "提升转化",
    "提升复购",
    "降低退货",
    "提升客单价",
    "降低客服成本",
    "提升满意度",
  ],
  sentimentThresholds: {
    strongNegative: 4,
    negative: 3,
    neutral: 2,
  },
  confidenceRules: {
    high: { minFeedbackCount: 15, minEvidenceCount: 4 },
    medium: { minFeedbackCount: 8, minEvidenceCount: 2 },
  },
  priorityThresholds: {
    P0: 80,
    P1: 65,
    P2: 45,
  },
};

/** 工具产品配置 */
const TOOL_CONFIG: ProductAnalysisConfig = {
  type: "tool",
  label: "工具产品",
  defaultMetrics: [
    "DAU",
    "功能使用率",
    "任务完成率",
    "NPS",
    "用户满意度",
  ],
  businessGoalOptions: [
    "提升活跃",
    "提升功能采纳",
    "提升效率",
    "提升满意度",
    "探索机会",
  ],
  sentimentThresholds: {
    strongNegative: 4,
    negative: 3,
    neutral: 2,
  },
  confidenceRules: {
    high: { minFeedbackCount: 10, minEvidenceCount: 3 },
    medium: { minFeedbackCount: 5, minEvidenceCount: 2 },
  },
  priorityThresholds: {
    P0: 80,
    P1: 65,
    P2: 45,
  },
};

/** 所有产品配置 */
const PRODUCT_CONFIGS: Record<ProductType, ProductAnalysisConfig> = {
  b2b_saas: B2B_SAAS_CONFIG,
  b2c: B2C_CONFIG,
  ecommerce: ECOMMERCE_CONFIG,
  tool: TOOL_CONFIG,
  other: B2C_CONFIG, // 默认使用 B2C 配置
};

/**
 * 根据产品类型字符串推断产品类型
 */
export function inferProductType(productType?: string | null): ProductType {
  if (!productType) return "other";

  const lower = productType.toLowerCase();

  if (
    lower.includes("b端") ||
    lower.includes("b2b") ||
    lower.includes("saas") ||
    lower.includes("企业") ||
    lower.includes("to b") ||
    lower.includes("tob")
  ) {
    return "b2b_saas";
  }

  if (
    lower.includes("c端") ||
    lower.includes("b2c") ||
    lower.includes("消费") ||
    lower.includes("to c") ||
    lower.includes("toc")
  ) {
    return "b2c";
  }

  if (
    lower.includes("电商") ||
    lower.includes("商城") ||
    lower.includes("购物") ||
    lower.includes("零售")
  ) {
    return "ecommerce";
  }

  if (
    lower.includes("工具") ||
    lower.includes("效率") ||
    lower.includes("utility")
  ) {
    return "tool";
  }

  return "other";
}

/**
 * 获取产品分析配置
 */
export function getProductAnalysisConfig(
  productType?: string | null
): ProductAnalysisConfig {
  const inferredType = inferProductType(productType);
  return PRODUCT_CONFIGS[inferredType];
}

/**
 * 获取默认指标列表
 */
export function getDefaultMetrics(productType?: string | null): string[] {
  return getProductAnalysisConfig(productType).defaultMetrics;
}

/**
 * 获取业务目标选项
 */
export function getBusinessGoalOptions(productType?: string | null): string[] {
  return getProductAnalysisConfig(productType).businessGoalOptions;
}

/**
 * 计算置信度
 */
export function calculateConfidenceLevel(
  feedbackCount: number,
  evidenceCount: number,
  productType?: string | null
): "high" | "medium" | "low" {
  const config = getProductAnalysisConfig(productType);

  if (
    feedbackCount >= config.confidenceRules.high.minFeedbackCount &&
    evidenceCount >= config.confidenceRules.high.minEvidenceCount
  ) {
    return "high";
  }

  if (
    feedbackCount >= config.confidenceRules.medium.minFeedbackCount &&
    evidenceCount >= config.confidenceRules.medium.minEvidenceCount
  ) {
    return "medium";
  }

  return "low";
}

/**
 * 计算优先级
 */
export function calculatePriority(
  opportunityScore: number,
  productType?: string | null
): "P0" | "P1" | "P2" | "P3" {
  const config = getProductAnalysisConfig(productType);

  if (opportunityScore >= config.priorityThresholds.P0) return "P0";
  if (opportunityScore >= config.priorityThresholds.P1) return "P1";
  if (opportunityScore >= config.priorityThresholds.P2) return "P2";
  return "P3";
}

/**
 * 获取情绪标签
 */
export function getSentimentLabel(
  sentimentScore: number | null,
  productType?: string | null
): string {
  if (!sentimentScore) return "中性";

  const config = getProductAnalysisConfig(productType);

  if (sentimentScore >= config.sentimentThresholds.strongNegative)
    return "强烈负面";
  if (sentimentScore >= config.sentimentThresholds.negative) return "负面";
  if (sentimentScore >= config.sentimentThresholds.neutral) return "中性";
  return "正面";
}

/**
 * 建议动作标签映射
 */
export const SUGGESTED_ACTION_LABELS: Record<string, string> = {
  fix_now: "立即修复",
  improve_experience: "改善体验",
  add_to_backlog: "加入待办",
  validate_with_interviews: "用户访谈验证",
  validate_with_data: "数据验证",
  ignore_for_now: "暂时忽略",
  build_mvp: "构建 MVP",
};

/**
 * 获取建议动作标签
 */
export function getSuggestedActionLabel(action: string | null): string {
  if (!action) return "待定";
  return SUGGESTED_ACTION_LABELS[action] || action;
}

/**
 * 置信度标签
 */
export const CONFIDENCE_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/**
 * 置信度颜色
 */
export const CONFIDENCE_COLORS: Record<string, string> = {
  high: "text-green-600 border-green-600",
  medium: "text-yellow-600 border-yellow-600",
  low: "text-red-600 border-red-600",
};
