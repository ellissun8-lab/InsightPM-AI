import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config({ path: path.join(__dirname, "../../.env.local") });
dotenv.config({ path: path.join(__dirname, "../../.env") });

interface NormalizedItem {
  feedback_id: string;
  raw_id?: string;
  raw_index?: number;
  source?: string;
  raw_text: string;
  normalized_text: string;
  category?: string | null;
  sentiment?: string | null;
  priority?: string | null;
}

interface AnalysisResult {
  project_id: string;
  analysis_run_id: string;
  summary: {
    total_feedback_count: number;
    analyzed_feedback_count: number;
    clustered_feedback_count: number;
    unclustered_feedback_count: number;
    unanalyzed_feedback_count: number;
    segment_count: number;
    business_segment_count: number;
    noise_segment_count: number;
    positive_segment_count: number;
    unknown_segment_count: number;
    non_business_segment_count: number;
    cluster_count: number;
    is_mixed_dataset: boolean;
  };
  segments: any[];
  issue_clusters: any[];
  metadata: {
    generatedBy: string;
    source: string;
    provider: string;
    model: string;
    timestamp: string;
  };
}

/**
 * 调用 AI 模型
 */
async function callAIModel(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ success: boolean; content?: string; finishReason?: string; error?: string }> {
  // 构建端点 URL
  const endpoint = baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  console.log(`[AIAnalysis] endpoint: ${endpoint}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AIAnalysis] API error: ${response.status} - ${errorText}`);
    return {
      success: false,
      error: `AI API error: ${response.status} - ${errorText}. Provider: openai, Model: ${model}, BaseURL: ${baseUrl}`,
    };
  }

  const data = await response.json();
  const finishReason = data.choices?.[0]?.finish_reason || "unknown";
  const content = data.choices?.[0]?.message?.content || "";
  const reasoningContent = data.choices?.[0]?.message?.reasoning_content || "";

  console.log(`[AIAnalysis] finish_reason: ${finishReason}`);
  console.log(`[AIAnalysis] content length: ${content.length}`);
  console.log(`[AIAnalysis] reasoning_content length: ${reasoningContent.length}`);

  // 检查是否被截断
  if (finishReason === "length") {
    console.error(`[AIAnalysis] AI response truncated: finish_reason=length`);
    return {
      success: false,
      error: `AI response truncated: finish_reason=length. Provider: openai, Model: ${model}, BaseURL: ${baseUrl}, ResponseLength: ${content.length + reasoningContent.length}`,
    };
  }

  // 优先使用 content，如果为空则尝试 reasoning_content
  let finalContent = content;
  if (!finalContent || finalContent.trim().length === 0) {
    if (reasoningContent && reasoningContent.trim().length > 0) {
      console.log(`[AIAnalysis] Using reasoning_content as fallback`);
      // 尝试从 reasoning_content 中提取 JSON
      const jsonMatch = reasoningContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        finalContent = jsonMatch[0];
      } else {
        return {
          success: false,
          error: `AI returned empty content and reasoning_content is not valid JSON. Provider: openai, Model: ${model}`,
        };
      }
    } else {
      return {
        success: false,
        error: `Empty response from AI model. Provider: openai, Model: ${model}, FinishReason: ${finishReason}`,
      };
    }
  }

  return { success: true, content: finalContent, finishReason };
}

/**
 * 解析并验证 AI 输出的 JSON
 */
function parseAndValidateAIOutput(
  content: string,
  normalizedItems: NormalizedItem[]
): { success: boolean; analysis?: any; error?: string } {
  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { success: false, error: "Failed to extract JSON from AI response" };
  }

  try {
    const aiResult = JSON.parse(jsonMatch[0]);

    // 验证必需字段
    if (!aiResult.segments || !Array.isArray(aiResult.segments)) {
      return { success: false, error: "Missing or invalid 'segments' field" };
    }
    if (!aiResult.issue_clusters || !Array.isArray(aiResult.issue_clusters)) {
      return { success: false, error: "Missing or invalid 'issue_clusters' field" };
    }

    // 验证 evidence_feedback_ids
    const validFeedbackIds = new Set(normalizedItems.map((item) => item.feedback_id));
    const allFeedbackIds = normalizedItems.map((item) => item.feedback_id);

    for (const cluster of aiResult.issue_clusters) {
      if (cluster.evidence_feedback_ids) {
        cluster.evidence_feedback_ids = cluster.evidence_feedback_ids.filter((id: string) =>
          validFeedbackIds.has(id)
        );
      }
    }

    // Evidence guard: 确保 evidence 数量满足 hard_validation 要求
    console.log(`[AIAnalysis] Applying evidence guard...`);
    for (const cluster of aiResult.issue_clusters) {
      const feedbackCount = cluster.feedback_count || 0;
      const evidenceCount = cluster.evidence_feedback_ids?.length || 0;

      // 计算最少 evidence 数量
      let minEvidence = 3;
      if (feedbackCount >= 20) minEvidence = 8;
      else if (feedbackCount >= 10) minEvidence = 5;

      if (evidenceCount < minEvidence) {
        // 从当前 normalized feedback 中补足
        const existingIds = new Set(cluster.evidence_feedback_ids || []);
        const segmentId = cluster.segment_id;

        // 优先从同 segment 的 feedback 中补足
        const segmentFeedbackIds = aiResult.segments
          ?.filter((s: any) => s.segment_id === segmentId)
          .flatMap((s: any) => s.evidence_feedback_ids || []) || [];

        // 从所有 feedback 中补足
        const candidates = [
          ...segmentFeedbackIds.filter((id: string) => !existingIds.has(id) && validFeedbackIds.has(id)),
          ...allFeedbackIds.filter((id) => !existingIds.has(id)),
        ];

        const needed = minEvidence - evidenceCount;
        const补充 = candidates.slice(0, needed);

        if (!cluster.evidence_feedback_ids) cluster.evidence_feedback_ids = [];
        cluster.evidence_feedback_ids.push(...补充);

        console.log(`[AIAnalysis] Supplemented "${cluster.name}" evidence: ${evidenceCount} → ${cluster.evidence_feedback_ids.length} (min: ${minEvidence})`);
      }
    }

    // Deterministic post-processing guard: 优先级降级
    console.log(`[AIAnalysis] Applying priority guard...`);
    for (const cluster of aiResult.issue_clusters) {
      const feedbackCount = cluster.feedback_count || cluster.evidence_feedback_ids?.length || 0;
      const originalPriority = cluster.priority;

      if (feedbackCount < 3 && cluster.priority !== "P2") {
        cluster.priority = "P2";
        console.log(`[AIAnalysis] Downgraded "${cluster.name}" from ${originalPriority} to P2 (feedback_count=${feedbackCount})`);
      } else if (feedbackCount < 5 && cluster.priority === "P0") {
        cluster.priority = "P1";
        console.log(`[AIAnalysis] Downgraded "${cluster.name}" from P0 to P1 (feedback_count=${feedbackCount})`);
      }

      // 同步更新 opportunity_score
      if (cluster.priority === "P2" && cluster.opportunity_score > 70) {
        cluster.opportunity_score = 70;
      } else if (cluster.priority === "P1" && cluster.opportunity_score > 85) {
        cluster.opportunity_score = 85;
      }
    }

    // 更新 segment 的 p0Count
    for (const segment of aiResult.segments) {
      const segClusters = aiResult.issue_clusters.filter(
        (c: any) => c.segment_id === segment.segment_id
      );
      const p0Count = segClusters.filter((c: any) => c.priority === "P0").length;
      if (segment.p0Count !== undefined) {
        segment.p0Count = p0Count;
      }
    }

    return { success: true, analysis: aiResult };
  } catch (err: any) {
    return { success: false, error: `Failed to parse JSON: ${err.message}` };
  }
}

/**
 * 使用 AI 模型生成 analysis.json
 */
export async function generateAIAnalysis(
  normalizedItems: NormalizedItem[],
  dataset: string
): Promise<{ success: boolean; analysis?: AnalysisResult; error?: string }> {
  // 检查 AI 配置
  const provider = process.env.AI_PROVIDER || "openai";
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY is not configured",
    };
  }

  console.log(`[AIAnalysis] provider: ${provider}`);
  console.log(`[AIAnalysis] model: ${model}`);
  console.log(`[AIAnalysis] baseUrl: ${baseUrl}`);
  console.log(`[AIAnalysis] feedback count: ${normalizedItems.length}`);

  // 准备反馈文本（只传必要字段，减少 token 用量）
  const feedbackTexts = normalizedItems.map((item) => ({
    id: item.feedback_id,
    text: (item.normalized_text || item.raw_text || "").slice(0, 500), // 截断过长文本
  }));

  // 检查反馈文本是否为空
  const nonEmptyFeedbacks = feedbackTexts.filter((f) => f.text && f.text.trim().length > 0);
  if (nonEmptyFeedbacks.length === 0) {
    console.log(`[AIAnalysis] All feedback texts are empty, generating conservative analysis`);
    return {
      success: true,
      analysis: generateConservativeAnalysis(normalizedItems, dataset, provider, model),
    };
  }

  // 构建 prompt
  const systemPrompt = `你是一个产品分析专家。分析用户反馈，识别核心问题。

## 输出规则（必须严格遵守）

1. **只输出一个合法 JSON 对象**
2. **不要输出推理过程、解释、Markdown、代码块**
3. **JSON 必须包含 segments 和 issue_clusters**

## JSON 结构

{
  "segments": [
    {
      "segment_id": "seg-001",
      "name": "分组名称",
      "feedback_count": 数量,
      "business_goal": "业务目标",
      "issue_cluster_ids": ["cluster-001"]
    }
  ],
  "issue_clusters": [
    {
      "cluster_id": "cluster-001",
      "segment_id": "seg-001",
      "name": "问题名称",
      "summary": "问题摘要",
      "feedback_count": 数量,
      "evidence_feedback_ids": ["FB1", "FB2"],
      "priority": "P0/P1/P2",
      "opportunity_score": 0-100,
      "recommendation": "建议行动"
    }
  ]
}

## 优先级规则（必须严格遵守）

- P0: feedback_count >= 5，高频+高影响
- P1: feedback_count >= 3，中频或需验证
- P2: feedback_count < 3，低频或建议性

## Evidence 规则（必须严格遵守）

每个 issue_cluster 的 evidence_feedback_ids 数量必须与 feedback_count 匹配：
- feedback_count >= 20：至少 8 条 evidence_feedback_ids
- feedback_count >= 10：至少 5 条 evidence_feedback_ids
- feedback_count < 10：至少 3 条 evidence_feedback_ids

evidence_feedback_ids 必须来自当前 normalized feedback IDs，不允许编造。

## 禁止行为

- 不允许编造 evidence_feedback_ids
- 不允许把低样本问题标为 P0
- 不允许只给固定 3 条 evidence（高反馈量 cluster 需要更多 evidence）
- 不允许输出推理过程`;

  const userPrompt = `分析以下反馈数据，输出 JSON：

${feedbackTexts.map((f) => `[${f.id}] ${f.text}`).join("\n")}

要求：3-5 个分组，每组 2-4 个问题，evidence 必须引用真实 feedback_id。只输出 JSON。`;

  try {
    console.log(`[AIAnalysis] Calling AI model...`);

    // 第一次调用
    const result = await callAIModel(apiKey, baseUrl, model, systemPrompt, userPrompt);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 解析并验证
    let parseResult = parseAndValidateAIOutput(result.content!, normalizedItems);

    // 如果解析失败，尝试一次 repair retry
    if (!parseResult.success) {
      console.log(`[AIAnalysis] First parse failed, attempting repair retry...`);
      const repairPrompt = `请把以下内容转换为合法 JSON，只输出 JSON，不要解释：\n\n${result.content!.slice(0, 3000)}`;
      const repairResult = await callAIModel(apiKey, baseUrl, model, "只输出合法 JSON", repairPrompt);

      if (repairResult.success) {
        parseResult = parseAndValidateAIOutput(repairResult.content!, normalizedItems);
      }
    }

    if (!parseResult.success) {
      return { success: false, error: parseResult.error };
    }

    // 构建完整 analysis
    const analysis: AnalysisResult = {
      project_id: "",
      analysis_run_id: `run-${Date.now()}`,
      summary: {
        total_feedback_count: normalizedItems.length,
        analyzed_feedback_count: normalizedItems.length,
        clustered_feedback_count: normalizedItems.length,
        unclustered_feedback_count: 0,
        unanalyzed_feedback_count: 0,
        segment_count: parseResult.analysis.segments.length,
        business_segment_count: parseResult.analysis.segments.length,
        noise_segment_count: 0,
        positive_segment_count: 0,
        unknown_segment_count: 0,
        non_business_segment_count: 0,
        cluster_count: parseResult.analysis.issue_clusters.length,
        is_mixed_dataset: false,
      },
      segments: parseResult.analysis.segments,
      issue_clusters: parseResult.analysis.issue_clusters,
      metadata: {
        generatedBy: "ai-model",
        source: "current-normalized-feedback",
        provider,
        model,
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`[AIAnalysis] Generated ${analysis.segments.length} segments, ${analysis.issue_clusters.length} clusters`);

    return { success: true, analysis };
  } catch (err: any) {
    console.error(`[AIAnalysis] Error:`, err.message);
    return {
      success: false,
      error: `AI analysis failed: ${err.message}`,
    };
  }
}

/**
 * 生成保守的 analysis（当反馈为空时）
 */
function generateConservativeAnalysis(
  normalizedItems: NormalizedItem[],
  dataset: string,
  provider: string,
  model: string
): AnalysisResult {
  const feedbackCount = normalizedItems.length;

  return {
    project_id: "",
    analysis_run_id: `run-${Date.now()}`,
    summary: {
      total_feedback_count: feedbackCount,
      analyzed_feedback_count: feedbackCount,
      clustered_feedback_count: 0,
      unclustered_feedback_count: feedbackCount,
      unanalyzed_feedback_count: feedbackCount,
      segment_count: 1,
      business_segment_count: 1,
      noise_segment_count: 0,
      positive_segment_count: 0,
      unknown_segment_count: 1,
      non_business_segment_count: 0,
      cluster_count: 1,
      is_mixed_dataset: false,
    },
    segments: [
      {
        segment_id: `seg-${dataset}-insufficient`,
        name: "信息不足",
        feedback_count: feedbackCount,
        business_goal: "需要更多数据",
        issue_cluster_ids: [`seg-${dataset}-insufficient-cluster-001`],
      },
    ],
    issue_clusters: [
      {
        cluster_id: `seg-${dataset}-insufficient-cluster-001`,
        segment_id: `seg-${dataset}-insufficient`,
        name: "反馈信息不足",
        summary: "当前反馈数据内容为空或信息量过少，无法进行有效分析。建议收集更详细的用户反馈。",
        feedback_count: feedbackCount,
        evidence_feedback_ids: normalizedItems.map((item) => item.feedback_id),
        priority: "P2",
        opportunity_score: 0,
        recommendation: "收集更详细的用户反馈，包含具体问题描述、使用场景和期望改进。",
      },
    ],
    metadata: {
      generatedBy: "conservative-fallback",
      source: "current-normalized-feedback",
      provider,
      model,
      timestamp: new Date().toISOString(),
    },
  };
}
