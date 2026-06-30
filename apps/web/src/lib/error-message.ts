/**
 * 把内部错误分类转换成用户可读的文案
 */

interface ErrorDisplay {
  title: string;
  description: string;
  actionHint: string;
}

const ERROR_MAP: Record<string, ErrorDisplay> = {
  semantic_validation: {
    title: "语义校验未通过",
    description: "报告内容与原始反馈证据的一致性不足。",
    actionHint: "请检查输入数据质量，或重新运行分析。",
  },
  hard_validation: {
    title: "硬性校验未通过",
    description: "输入格式或结构性规则不满足要求。",
    actionHint: "请检查 CSV 格式和必需字段，修正后重新上传。",
  },
  network: {
    title: "网络请求失败",
    description: "AI 服务或存储访问超时。",
    actionHint: "该错误可自动重试，系统将自动处理。",
  },
  storage: {
    title: "文件访问失败",
    description: "系统无法读取上传的 CSV 文件。",
    actionHint: "请重新上传文件后再试。",
  },
  training_data: {
    title: "训练数据处理失败",
    description: "分析结果写入训练数据时出错。",
    actionHint: "请查看技术详情或联系管理员。",
  },
  artifact_write: {
    title: "报告产物写入失败",
    description: "分析完成但报告文件保存失败。",
    actionHint: "该错误可自动重试，系统将自动处理。",
  },
  ai_generation: {
    title: "AI 分析生成失败",
    description: "AI 模型在生成分析报告时出错。",
    actionHint: "该错误可自动重试。如持续失败，请检查 AI 服务配置。",
  },
  unknown: {
    title: "分析失败",
    description: "系统处理时发生未知错误。",
    actionHint: "请查看技术详情或稍后重试。",
  },
};

const DEFAULT_ERROR: ErrorDisplay = ERROR_MAP.unknown;

export function getErrorDisplay(category?: string): ErrorDisplay {
  if (!category) return DEFAULT_ERROR;
  return ERROR_MAP[category] || DEFAULT_ERROR;
}

export function getStatusDescription(status: string): string {
  switch (status) {
    case "pending":
      return "任务已创建，等待处理。";
    case "running":
      return "正在分析，可能需要几分钟。";
    case "completed":
      return "分析完成，可以查看报告。";
    case "failed":
      return "分析失败，请查看错误原因。";
    default:
      return "";
  }
}
