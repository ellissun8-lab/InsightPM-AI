import { getAIProvider } from "@/lib/ai";
import type { ProjectInfo } from "@/lib/ai/types";
import {
  getDefaultMetrics,
  calculateConfidenceLevel,
  CONFIDENCE_LABELS,
  getSuggestedActionLabel,
  inferProductType,
} from "@/lib/config/product-analysis-context";

type ClusterData = {
  id: string;
  name: string;
  summary: string;
  feedback_count: number;
  opportunity_score: number | null;
  priority: string | null;
  sentiment_score: number | null;
  recommendation: string | null;
  suggested_action: string | null;
  risk_notes: string | null;
  missing_evidence: string | null;
  evidence_feedback_ids: string[] | null;
};

type FeedbackItem = {
  id: string;
  raw_content: string;
  ai_summary: string | null;
  sentiment: string | null;
  feedback_type: string | null;
};

function getConfidenceLabel(level: "high" | "medium" | "low"): string {
  return CONFIDENCE_LABELS[level] || level;
}

function getPriorityLabel(priority: string | null): string {
  return priority || "P3";
}

function getSentimentLabel(score: number | null): string {
  if (!score) return "中性";
  if (score >= 4) return "强烈负面";
  if (score >= 3) return "负面";
  if (score >= 2) return "中性";
  return "正面";
}

export async function generateReport(
  project: ProjectInfo,
  clusters: ClusterData[],
  feedbackItems: FeedbackItem[],
  feedbackMap: Map<string, FeedbackItem>
): Promise<{ title: string; summary: string; content: string }> {
  const provider = getAIProvider();

  // ===== Code-computed statistics =====
  const totalFeedback = feedbackItems.length;
  const validFeedback = feedbackItems.filter((f) => f.sentiment !== null).length;

  // Sort by feedback_count for Top 5 high-frequency issues
  const top5ByCount = [...clusters]
    .sort((a, b) => b.feedback_count - a.feedback_count)
    .slice(0, 5);

  // Sort by opportunity_score for high-priority opportunities
  const highPriority = [...clusters]
    .filter((c) => c.priority === "P0" || c.priority === "P1")
    .sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0));

  // Sentiment distribution
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0, strong_negative: 0 };
  feedbackItems.forEach((f) => {
    if (f.sentiment === "positive") sentimentCounts.positive++;
    else if (f.sentiment === "negative") sentimentCounts.negative++;
    else if (f.sentiment === "strong_negative") sentimentCounts.strong_negative++;
    else sentimentCounts.neutral++;
  });
  const negativePercent = totalFeedback > 0
    ? Math.round(((sentimentCounts.negative + sentimentCounts.strong_negative) / totalFeedback) * 100)
    : 0;

  // Determine metrics based on project type
  const productType = inferProductType(project.product_type);
  const isB2B = productType === "b2b_saas";
  const defaultMetrics = getDefaultMetrics(project.product_type);

  // Build clusters data with confidence levels
  const clustersWithConfidence = clusters.map((c) => {
    const evidenceCount = c.evidence_feedback_ids?.length || 0;
    const confidence = calculateConfidenceLevel(c.feedback_count, evidenceCount, project.product_type);
    return { ...c, confidence, confidenceLabel: getConfidenceLabel(confidence) };
  });

  // Prepare representative feedback for AI
  const clustersForAI = clustersWithConfidence.map((c) => {
    const representativeFeedback = (c.evidence_feedback_ids || [])
      .map((id) => feedbackMap.get(id))
      .filter(Boolean)
      .slice(0, 3)
      .map((f) => f!.raw_content.substring(0, 200));

    return {
      name: c.name,
      summary: c.summary,
      feedback_count: c.feedback_count,
      priority: getPriorityLabel(c.priority),
      opportunity_score: c.opportunity_score || 0,
      sentiment_score: c.sentiment_score,
      confidence: c.confidenceLabel,
      suggested_action: getSuggestedActionLabel(c.suggested_action),
      recommendation: c.recommendation,
      risk_notes: c.risk_notes,
      missing_evidence: c.missing_evidence,
      representative_feedback: representativeFeedback,
    };
  });

  // ===== AI generates ONLY analysis text, not data =====
  const system = `你是一个资深产品负责人。请基于以下**已计算好的数据**，撰写分析报告的文字部分。

重要规则：
1. 只写分析文字，不要编造任何数字、百分比、排名
2. 所有数据已在输入中提供，直接引用
3. 不要提到不在"产品名称"中的产品
4. 如果"当前业务目标"为空，不要假设任何目标
5. 输出 Markdown 格式`;

  const businessGoalSection = project.business_goal
    ? `- 当前业务目标：${project.business_goal}`
    : "- 当前业务目标：未设定（请勿假设）";

  const metricsSection = isB2B && (!project.key_metric || project.key_metric === "")
    ? `- B端 SaaS 建议关注指标：${defaultMetrics.join("、")}`
    : project.key_metric
    ? `- 关键指标：${project.key_metric}`
    : "";

  const user = `产品名称：${project.name}
产品类型：${project.product_type || "未指定"}
${businessGoalSection}
目标用户：${project.target_user || "未指定"}
${metricsSection}

已计算的统计数据（必须使用这些数字，不要自己编造）：
- 总反馈数：${totalFeedback}
- 有效反馈数：${validFeedback}
- 问题簇数量：${clusters.length}
- P0 问题数：${clusters.filter((c) => c.priority === "P0").length}
- P1 问题数：${clusters.filter((c) => c.priority === "P1").length}
- 负面反馈占比：${negativePercent}%

高频问题 Top 5（按反馈数量排序）：
${top5ByCount.map((c, i) => `${i + 1}. ${c.name} - ${c.feedback_count} 条反馈, 机会分 ${c.opportunity_score || 0}, 优先级 ${getPriorityLabel(c.priority)}`).join("\n")}

高优先级机会（P0/P1，按机会分排序）：
${highPriority.map((c) => `- ${c.name}: 机会分 ${c.opportunity_score || 0}, ${c.feedback_count} 条反馈, 建议 ${getSuggestedActionLabel(c.suggested_action)}`).join("\n")}

问题簇详情：
${clustersForAI.map((c) => `### ${c.name}
- 摘要：${c.summary}
- 反馈数：${c.feedback_count}
- 优先级：${c.priority}
- 机会分：${c.opportunity_score}
- 情绪分：${c.sentiment_score || "无"}
- 置信度：${c.confidence}
- 建议动作：${c.suggested_action}
- 建议：${c.recommendation || "无"}
- 风险：${c.risk_notes || "无"}
- 缺少证据：${c.missing_evidence || "无"}
- 代表性反馈：
${c.representative_feedback.map((f) => `  > "${f}"`).join("\n")}`).join("\n\n")}

请撰写以下部分的分析文字（使用 Markdown）：

## 二、核心结论
基于以上数据，总结 3-5 个最重要的结论。每个结论必须引用具体的问题簇名称和数据。

## 五、建议行动
给出具体的行动建议，区分短期和长期。

## 六、风险提醒
列出可能的风险。

## 七、需要进一步验证的问题
列出证据不足（置信度为"低"）的问题簇，说明需要什么额外验证。

## 八、给老板看的摘要
用 3-5 句话概括最重要的发现和建议，适合向上汇报。`;

  const aiContent = await provider.generateText(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.3 }
  );

  // ===== Assemble final report with code-computed sections =====
  const report = `# 产品反馈分析报告

## 一、分析范围

- **产品名称**：${project.name}
- **产品类型**：${project.product_type || "未指定"}
- **总反馈数**：${totalFeedback}
- **有效反馈数**：${validFeedback}
- **问题簇数量**：${clusters.length}
- **负面反馈占比**：${negativePercent}%
${isB2B ? `- **关注指标**：${defaultMetrics.join("、")}` : ""}

---

${aiContent.split("## 二、核心结论")[1] ? "## 二、核心结论" + aiContent.split("## 二、核心结论")[1].split("## 五、建议行动")[0] : "## 二、核心结论\n\n暂无分析。"}

---

## 三、高频问题 Top 5（按反馈数量排序）

| 排名 | 问题名称 | 反馈数 | 机会分 | 优先级 | 置信度 |
|------|----------|--------|--------|--------|--------|
${top5ByCount.map((c, i) => {
  const conf = calculateConfidenceLevel(c.feedback_count, c.evidence_feedback_ids?.length || 0, project.product_type);
  return `| ${i + 1} | ${c.name} | ${c.feedback_count} | ${c.opportunity_score || 0} | ${getPriorityLabel(c.priority)} | ${getConfidenceLabel(conf)} |`;
}).join("\n")}

---

## 四、高优先级机会（按机会分排序）

| 问题名称 | 机会分 | 反馈数 | 优先级 | 建议动作 |
|----------|--------|--------|--------|----------|
${highPriority.map((c) => `| ${c.name} | ${c.opportunity_score || 0} | ${c.feedback_count} | ${getPriorityLabel(c.priority)} | ${getSuggestedActionLabel(c.suggested_action)} |`).join("\n")}

${highPriority.length === 0 ? "暂无 P0/P1 级别的问题。\n" : ""}
---

${aiContent.includes("## 五、建议行动") ? "## 五、建议行动" + aiContent.split("## 五、建议行动")[1].split("## 六、风险提醒")[0] : "## 五、建议行动\n\n暂无建议。\n"}

---

${aiContent.includes("## 六、风险提醒") ? "## 六、风险提醒" + aiContent.split("## 六、风险提醒")[1].split("## 七、需要进一步验证的问题")[0] : "## 六、风险提醒\n\n暂无风险提醒。\n"}

---

${aiContent.includes("## 七、需要进一步验证的问题") ? "## 七、需要进一步验证的问题" + aiContent.split("## 七、需要进一步验证的问题")[1].split("## 八、给老板看的摘要")[0] : "## 七、需要进一步验证的问题\n\n" + clustersWithConfidence.filter((c) => c.confidence === "low").map((c) => `- **${c.name}**：反馈数 ${c.feedback_count}，证据不足，需要更多用户反馈验证。${c.missing_evidence ? `缺少：${c.missing_evidence}` : ""}`).join("\n") + (clustersWithConfidence.filter((c) => c.confidence === "low").length === 0 ? "所有问题簇置信度充足。" : "") + "\n"}

---

${aiContent.includes("## 八、给老板看的摘要") ? "## 八、给老板看的摘要" + aiContent.split("## 八、给老板看的摘要")[1] : "## 八、给老板看的摘要\n\n暂无摘要。\n"}

---

## 附录：问题簇详情

${clustersWithConfidence.map((c) => `### ${c.name}

| 指标 | 值 |
|------|-----|
| 反馈数 | ${c.feedback_count} |
| 优先级 | ${getPriorityLabel(c.priority)} |
| 机会分 | ${c.opportunity_score || 0} |
| 情绪分 | ${c.sentiment_score || "-"} |
| 置信度 | ${c.confidenceLabel} |
| 建议动作 | ${getSuggestedActionLabel(c.suggested_action)} |

**摘要**：${c.summary}

${c.recommendation ? `**建议**：${c.recommendation}` : ""}

${c.risk_notes ? `**风险**：${c.risk_notes}` : ""}

${c.missing_evidence ? `**缺少证据**：${c.missing_evidence}` : ""}

**代表性反馈**：
${(c.evidence_feedback_ids || []).map((id) => {
  const f = feedbackMap.get(id);
  return f ? `> "${f.raw_content.substring(0, 200)}"` : null;
}).filter(Boolean).join("\n")}
`).join("\n---\n")}
`;

  const title = `${project.name} - 产品反馈分析报告`;
  const summary = `基于 ${totalFeedback} 条用户反馈分析，发现 ${clusters.length} 个问题簇，其中 ${highPriority.length} 个高优先级问题。负面反馈占比 ${negativePercent}%。`;

  return { title, summary, content: report };
}
