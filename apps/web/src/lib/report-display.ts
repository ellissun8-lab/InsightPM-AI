const SCENARIO_NAMES: Record<string, string> = {
  "general-feedback": "通用产品反馈",
  "enterprise-saas-renewal": "企业 SaaS 续费",
  "onboarding-activation": "新用户激活",
  "ai-product-experience": "AI 产品体验",
  "internal-tools-efficiency": "内部工具效率",
  "ecommerce-conversion": "电商转化",
  "bi-dashboard-renewal": "BI 报表续费",
  "mixed-feedback": "混合反馈",
  "b2b-activation": "B2B 激活",
  "b2b-renewal": "B2B 续费",
  "support-bug-feedback": "客服 / Bug 反馈",
  "churn-risk-feedback": "流失风险反馈",
};

export function getScenarioDisplayName(scenarioId: string): string {
  return SCENARIO_NAMES[scenarioId] ?? scenarioId;
}
