/**
 * 失败分类说明与慢步骤说明
 */

export const FAILURE_CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  semantic_validation: {
    label: "语义校验失败",
    description: "语义校验未通过，报告结论与原始反馈证据一致性不足。",
  },
  hard_validation: {
    label: "硬性校验失败",
    description: "硬性规则校验未通过，通常是输入结构、报告结构或证据数量不满足规则。",
  },
  storage: {
    label: "文件访问失败",
    description: "文件下载或存储访问失败。",
  },
  ai_generation: {
    label: "AI 生成失败",
    description: "AI 生成分析内容失败。",
  },
  network: {
    label: "网络错误",
    description: "外部服务或网络请求不稳定。",
  },
  training_data: {
    label: "训练数据错误",
    description: "训练数据或索引写入失败。",
  },
  artifact_write: {
    label: "产物写入失败",
    description: "报告产物写入失败。",
  },
  timeout: {
    label: "超时",
    description: "任务运行超时。",
  },
  unknown: {
    label: "未知错误",
    description: "未知错误。",
  },
};

export const STEP_LABELS: Record<string, string> = {
  generate_raw_feedback: "生成原始反馈",
  normalize_feedback: "标准化反馈",
  build_segments: "构建分析分组",
  split_segment_json: "拆分分组 JSON",
  rebuild_overall_json: "重建汇总 JSON",
  render_markdown: "渲染 Markdown",
  hard_validation: "硬性校验",
  semantic_validation: "语义校验",
  consistency_guard: "一致性检查",
  promote_to_training: "推广到训练数据",
  dataset_index_update: "更新数据集索引",
};

export function getCategoryLabel(category: string): string {
  return FAILURE_CATEGORY_LABELS[category]?.label || category;
}

export function getCategoryDescription(category: string): string {
  return FAILURE_CATEGORY_LABELS[category]?.description || "未知错误类型。";
}

export function getStepLabel(step: string): string {
  return STEP_LABELS[step] || step;
}
