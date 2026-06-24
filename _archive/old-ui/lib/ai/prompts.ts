import type { ProjectInfo, IssueClusterDraft, OpportunityScoreResult } from "./types";

export type ReportClusterData = {
  name: string;
  summary: string;
  feedback_count: number;
  opportunity_score: number;
  priority: string;
  recommendation: string;
  suggested_action: string;
  risk_notes: string;
  representative_feedback: string[];
};

export function buildClassificationPrompt(
  project: ProjectInfo,
  feedbackContent: string
): { system: string; user: string } {
  const system = `你是一个资深产品经理。请分析用户反馈，并输出严格 JSON。不要输出任何解释文字，只输出 JSON。`;

  const user = `产品背景：
- 产品名称：${project.name}
- 产品类型：${project.product_type || "未指定"}
- 当前业务目标：${project.business_goal || "未指定"}
- 目标用户：${project.target_user || "未指定"}
- 关键指标：${project.key_metric || "未指定"}

请分析以下用户反馈，输出 JSON 格式：
{
  "is_valid": true/false,
  "invalid_reason": "如果无效，说明原因",
  "cleaned_content": "清洗后的反馈内容",
  "feedback_type": "bug/ux_issue/feature_request/pricing/performance/complaint/praise/question/other",
  "product_module": "涉及的产品模块",
  "sentiment": "positive/neutral/negative/strong_negative",
  "sentiment_strength": 1-5,
  "user_intent": "用户真实诉求",
  "possible_metrics": ["可能影响的业务指标"],
  "ai_summary": "简短摘要",
  "labels": ["标签"]
}

用户反馈：
${feedbackContent}`;

  return { system, user };
}

export function buildClusteringPrompt(
  project: ProjectInfo,
  classifiedFeedbackList: string
): { system: string; user: string } {
  const system = `你是一个资深产品分析专家。请将相似反馈聚合为问题簇，输出严格 JSON 数组。不要输出任何解释文字，只输出 JSON。`;

  const user = `产品背景：
- 产品名称：${project.name}
- 当前业务目标：${project.business_goal || "未指定"}
- 目标用户：${project.target_user || "未指定"}
- 关键指标：${project.key_metric || "未指定"}

请将以下已分类的反馈聚合为问题簇。每个问题簇输出为 JSON 对象：
{
  "name": "问题名称",
  "summary": "问题摘要",
  "feedback_ids": ["关联的反馈ID"],
  "feedback_count": 反馈数量,
  "main_complaint": "用户主要抱怨",
  "affected_user_types": ["影响的用户类型"],
  "related_modules": ["相关产品模块"],
  "possible_metrics": ["可能影响的指标"],
  "representative_feedback_ids": ["代表性反馈ID，最多3个"]
}

要求：
- 不要编造反馈中没有的信息
- 每个问题簇必须引用真实 feedback_id
- 如果证据不足，不要强行聚类
- 最多输出 10 个问题簇
- 输出 JSON 数组

已分类反馈列表：
${classifiedFeedbackList}`;

  return { system, user };
}

export function buildScoringPrompt(
  project: ProjectInfo,
  clusters: IssueClusterDraft[]
): { system: string; user: string } {
  const system = `你是一个产品负责人。请为每个问题簇评估产品机会优先级，输出严格 JSON 数组。不要输出任何解释文字，只输出 JSON。`;

  const clustersStr = JSON.stringify(
    clusters.map((c) => ({
      name: c.name,
      summary: c.summary,
      feedback_count: c.feedback_count,
      main_complaint: c.main_complaint,
      affected_user_types: c.affected_user_types,
      related_modules: c.related_modules,
      possible_metrics: c.possible_metrics,
    })),
    null,
    2
  );

  const user = `产品背景：
- 产品名称：${project.name}
- 产品类型：${project.product_type || "未指定"}
- 当前业务目标：${project.business_goal || "未指定"}
- 目标用户：${project.target_user || "未指定"}
- 关键指标：${project.key_metric || "未指定"}

请为以下问题簇评估机会优先级。每个输出为 JSON 对象：
{
  "cluster_name": "问题簇名称",
  "frequency_score": 1-5,
  "sentiment_score": 1-5,
  "user_value_score": 1-5,
  "business_value_score": 1-5,
  "strategic_fit_score": 1-5,
  "complexity_score": 1-5,
  "evidence_score": 1-5,
  "recommendation": "建议说明",
  "suggested_action": "fix_now/improve_experience/add_to_backlog/validate_with_interviews/validate_with_data/ignore_for_now/build_mvp",
  "risk_notes": "风险说明",
  "missing_evidence": "缺少的证据"
}

评分说明：
- frequency_score: 反馈频率，1-5
- sentiment_score: 负面情绪程度，1-5（越高越负面）
- user_value_score: 用户价值，1-5
- business_value_score: 商业价值，1-5
- strategic_fit_score: 战略匹配度，1-5
- complexity_score: 实现复杂度，1-5（越高越复杂）
- evidence_score: 证据强度，1-5

注意：
- 不要计算最终 opportunity_score，最终分数由代码计算
- 不要夸大证据
- 没有证据的地方必须标记为推测
- 只输出 JSON 数组

问题簇：
${clustersStr}`;

  return { system, user };
}

export function buildReportPrompt(
  project: ProjectInfo,
  clustersWithScores: ReportClusterData[],
  totalFeedbackCount: number
): { system: string; user: string } {
  const system = `你是一个资深产品负责人。请基于分析结果，生成一份产品反馈分析报告。报告要结构清晰、结论明确、每个重要结论都要引用证据。输出 Markdown 格式。`;

  const clustersStr = clustersWithScores
    .map(
      (c, i) => `### 问题 ${i + 1}: ${c.name}
- 摘要: ${c.summary}
- 反馈数量: ${c.feedback_count}
- 机会分: ${c.opportunity_score}
- 优先级: ${c.priority}
- 建议: ${c.recommendation}
- 建议动作: ${c.suggested_action}
- 风险: ${c.risk_notes}
- 代表性反馈:
${c.representative_feedback.map((f) => `  - "${f}"`).join("\n")}`
    )
    .join("\n\n");

  const user = `产品背景：
- 产品名称：${project.name}
- 产品类型：${project.product_type || "未指定"}
- 当前业务目标：${project.business_goal || "未指定"}
- 目标用户：${project.target_user || "未指定"}
- 关键指标：${project.key_metric || "未指定"}

分析概况：
- 总反馈数量：${totalFeedbackCount}
- 问题簇数量：${clustersWithScores.length}

分析结果：
${clustersStr}

请生成报告，严格按照以下结构：

# 产品反馈分析报告

## 一、分析范围
说明本次分析覆盖的反馈数量、时间范围、来源等。

## 二、核心结论
列出 3-5 个最重要的结论，每个结论要引用证据。

## 三、高频问题 Top 5
按机会分排序，列出最重要的 5 个问题。

## 四、高优先级机会
列出 P0 和 P1 级别的机会，说明为什么是高优先级。

## 五、建议行动
给出具体的行动建议，区分短期和长期。

## 六、风险提醒
列出可能的风险和需要注意的事项。

## 七、需要进一步验证的问题
列出证据不足、需要进一步验证的假设。

## 八、给老板看的摘要
用 3-5 句话概括最重要的发现和建议，适合向上汇报。`;

  return { system, user };
}
