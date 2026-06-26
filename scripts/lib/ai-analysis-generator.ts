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

  // 准备反馈文本
  const feedbackTexts = normalizedItems.map((item) => ({
    id: item.feedback_id,
    text: item.normalized_text || item.raw_text,
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
  const systemPrompt = `你是一个产品分析专家。你的任务是分析用户反馈数据，识别核心问题和主题。

## 输出要求

请以 JSON 格式输出分析结果，包含以下字段：

{
  "segments": [
    {
      "segment_id": "seg-xxx",
      "name": "分组名称",
      "feedback_count": 数量,
      "business_goal": "业务目标",
      "issue_cluster_ids": ["cluster-xxx"]
    }
  ],
  "issue_clusters": [
    {
      "cluster_id": "cluster-xxx",
      "segment_id": "seg-xxx",
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

## 重要规则

1. **evidence_feedback_ids 必须引用真实的 feedback_id**，不能凭空编造
2. **如果反馈信息不足，应该输出"信息不足/无法判断"**，不能编造具体问题
3. **问题描述必须基于实际反馈内容**，不能过度推断
4. **机会评分**应与反馈数量和优先级匹配

## 优先级规则（必须严格遵守）

**P0 只允许用于高频、高影响、证据充足的问题：**
- feedback_count >= 5 才能标记为 P0
- 必须有明确的用户痛点和业务影响
- 证据必须充分（至少 5 条 feedback 支持）

**P1 用于中频或需验证的问题：**
- feedback_count >= 3 可以标记为 P1
- 问题需要进一步验证或影响范围有限

**P2 用于低频或建议性问题：**
- feedback_count < 3 最高只能是 P2
- 建议性反馈或低优先级改进

**绝对禁止：**
- 不允许为了显得严重而把低样本问题标为 P0
- feedback_count < 5 的问题禁止标记为 P0
- feedback_count < 3 的问题最高只能是 P2
- 如果证据不足，必须降级，不得夸大

请只输出 JSON，不要输出其他内容。`;

  const userPrompt = `请分析以下用户反馈数据，识别核心问题和主题。

## 反馈数据

${feedbackTexts.map((f) => `- [${f.id}] ${f.text}`).join("\n")}

## 要求

1. 将反馈分成 3-5 个业务分组
2. 每个分组识别 2-4 个核心问题
3. 每个问题必须引用真实的 feedback_id 作为证据
4. 如果反馈信息不足，请明确说明

请输出 JSON 格式的分析结果。`;

  try {
    console.log(`[AIAnalysis] Calling AI model...`);

    // 构建端点 URL
    // 如果 baseUrl 已经包含 /v1，直接使用 /chat/completions
    // 否则使用 /v1/chat/completions
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
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AIAnalysis] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `AI API error: ${response.status} - ${errorText}. Provider: ${provider}, Model: ${model}, BaseURL: ${baseUrl}`,
      };
    }

    const data = await response.json();
    console.log(`[AIAnalysis] Response data:`, JSON.stringify(data).slice(0, 500));

    const content = data.choices?.[0]?.message?.content || data.content || data.text || "";

    console.log(`[AIAnalysis] AI response length: ${content.length}`);
    console.log(`[AIAnalysis] AI response preview: ${content.slice(0, 200)}`);

    if (!content || content.trim().length === 0) {
      console.error(`[AIAnalysis] Empty response from AI model`);
      return {
        success: false,
        error: `Empty response from AI model. Provider: ${provider}, Model: ${model}`,
      };
    }

    // 解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`[AIAnalysis] failed to extract JSON from response`);
      return {
        success: false,
        error: `Failed to extract JSON from AI response. Response: ${content.slice(0, 200)}`,
      };
    }

    const aiResult = JSON.parse(jsonMatch[0]);

    // 验证 evidence_feedback_ids
    const validFeedbackIds = new Set(normalizedItems.map((item) => item.feedback_id));
    for (const cluster of aiResult.issue_clusters || []) {
      if (cluster.evidence_feedback_ids) {
        cluster.evidence_feedback_ids = cluster.evidence_feedback_ids.filter((id: string) =>
          validFeedbackIds.has(id)
        );
      }
    }

    // Deterministic post-processing guard: 优先级降级
    // 确保低样本问题不会被标记为高优先级
    console.log(`[AIAnalysis] Applying priority guard...`);
    for (const cluster of aiResult.issue_clusters || []) {
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
    for (const segment of aiResult.segments || []) {
      const segClusters = (aiResult.issue_clusters || []).filter(
        (c: any) => c.segment_id === segment.segment_id
      );
      const p0Count = segClusters.filter((c: any) => c.priority === "P0").length;
      if (segment.p0Count !== undefined) {
        segment.p0Count = p0Count;
      }
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
        segment_count: aiResult.segments?.length || 0,
        business_segment_count: aiResult.segments?.length || 0,
        noise_segment_count: 0,
        positive_segment_count: 0,
        unknown_segment_count: 0,
        non_business_segment_count: 0,
        cluster_count: aiResult.issue_clusters?.length || 0,
        is_mixed_dataset: false,
      },
      segments: aiResult.segments || [],
      issue_clusters: aiResult.issue_clusters || [],
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
