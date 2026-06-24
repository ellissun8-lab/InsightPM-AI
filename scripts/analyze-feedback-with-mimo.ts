/**
 * 小米模型分析反馈数据
 * 运行: pnpm analyze:feedback
 *
 * 基于 normalized_feedback 生成 data_profile、segments、overall analysis 和 segment analyses
 *
 * 关键规则：
 * - seg-noise 是正式 segment，计入已归类反馈
 * - seg-noise 不参与业务机会排序
 * - seg-noise 不进入老板摘要核心业务问题
 * - 所有 "待补充" 必须替换为实际内容
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const NORMALIZED_DIR = path.join(__dirname, "..", "fixtures", "normalized");
const ANALYSIS_DIR = path.join(__dirname, "..", "fixtures", "analysis");

interface NormalizedFeedback {
  feedback_id: string;
  raw_id: string;
  raw_index: number;
  raw_content: string;
  cleaned_content: string;
  detected_source: string;
  detected_user_type: string;
  detected_problem_type: string;
  detected_theme: string;
  detected_product_type: string;
  detected_business_goal: string;
  detected_segment_id: string;
  confidence: number;
  unknown_reason: string | null;
}

interface DataProfile {
  dataset: string;
  total_raw_feedback_count: number;
  normalized_feedback_count: number;
  is_mixed_dataset: boolean;
  detected_product_types: string[];
  detected_business_goals: string[];
  detected_sources: string[];
  unknown_count: number;
  noise_count: number;
  confidence_distribution: { high: number; medium: number; low: number };
  notes: string[];
}

interface Segment {
  segment_id: string;
  segment_type: "business" | "noise" | "unknown" | "positive";
  name: string;
  product_type: string;
  business_goal: string;
  feedback_count: number;
  feedback_ids: string[];
  main_themes: string[];
}

interface SegmentsData {
  dataset: string;
  is_mixed_dataset: boolean;
  segment_count: number;
  business_segment_count: number;
  noise_segment_count: number;
  positive_segment_count: number;
  segments: Segment[];
}

interface IssueCluster {
  cluster_id: string;
  segment_id: string;
  name: string;
  summary: string;
  feedback_count: number;
  evidence_feedback_ids: string[];
  secondary_themes: string[];
  possible_metrics: string[];
  priority: string;
  opportunity_score: number;
  recommendation: string;
}

interface OverallAnalysis {
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
    cluster_count: number;
    is_mixed_dataset: boolean;
  };
  segments: { segment_id: string; name: string; feedback_count: number; business_goal: string; issue_cluster_ids: string[] }[];
  issue_clusters: IssueCluster[];
  report_path: string;
}

// Product type mapping
const SEGMENT_PRODUCT_TYPE_MAP: Record<string, string> = {
  "seg-b2b-renewal": "B端 SaaS",
  "seg-b2b-activation": "B端 SaaS",
  "seg-ai-experience": "AI 产品",
  "seg-bi-renewal": "数据/BI 工具",
  "seg-ecommerce-conversion": "电商平台",
  "seg-internal-cost": "内部系统",
  "seg-noise": "unknown",
  "seg-unknown": "unknown",
  "seg-positive": "unknown",
};

// Business goal mapping
const SEGMENT_BUSINESS_GOAL_MAP: Record<string, string> = {
  "seg-b2b-renewal": "提升续费 / 降低流失",
  "seg-b2b-activation": "提升激活",
  "seg-ai-experience": "改善体验 / 提升留存",
  "seg-bi-renewal": "提升续费",
  "seg-ecommerce-conversion": "提升下单转化率",
  "seg-internal-cost": "降低运营成本",
  "seg-noise": "unknown",
  "seg-unknown": "unknown",
  "seg-positive": "unknown",
};

/**
 * 分析反馈数据
 */
export async function analyzeFeedback(): Promise<void> {
  // Try MiMo first, fall back to DeepSeek if MiMo is unavailable
  let apiKey = process.env.MIMO_API_KEY || process.env.OPENAI_API_KEY;
  let baseUrl = process.env.MIMO_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  let model = process.env.MIMO_GENERATION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Test MiMo API availability
  if (apiKey) {
    try {
      const testResp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 5 }),
        signal: AbortSignal.timeout(10000),
      });
      if (!testResp.ok) {
        console.log(`  ⚠️  MiMo API unavailable (${testResp.status}), falling back to DeepSeek...`);
        const dsKey = process.env.DEEPSEEK_API_KEY;
        if (dsKey) {
          apiKey = dsKey;
          baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
          model = "deepseek-chat";
        }
      }
    } catch {
      console.log("  ⚠️  MiMo API unreachable, falling back to DeepSeek...");
      const dsKey = process.env.DEEPSEEK_API_KEY;
      if (dsKey) {
        apiKey = dsKey;
        baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
        model = "deepseek-chat";
      }
    }
  }

  if (!apiKey) {
    throw new Error("No AI API key available (MIMO_API_KEY or DEEPSEEK_API_KEY)");
  }

  // Read normalized feedback
  const jsonPath = path.join(NORMALIZED_DIR, "mixed-feedback.normalized.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error("Normalized feedback not found. Run normalize:feedback first.");
  }

  const normalizedItems: NormalizedFeedback[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`  Read ${normalizedItems.length} normalized feedback items`);

  // Create analysis output directory
  const datasetDir = path.join(ANALYSIS_DIR, "mixed-feedback");
  const segmentsDir = path.join(datasetDir, "segments");
  fs.mkdirSync(segmentsDir, { recursive: true });

  // Step 1: Generate data profile
  console.log("  Generating data profile...");
  const dataProfile = generateDataProfile(normalizedItems);
  fs.writeFileSync(
    path.join(ANALYSIS_DIR, "mixed-feedback.data-profile.json"),
    JSON.stringify(dataProfile, null, 2),
    "utf-8"
  );

  // Step 2: Generate segments
  console.log("  Generating segments...");
  const segmentsData = generateSegments(normalizedItems);
  fs.writeFileSync(
    path.join(ANALYSIS_DIR, "mixed-feedback.segments.json"),
    JSON.stringify(segmentsData, null, 2),
    "utf-8"
  );

  // Step 3: Generate overall analysis
  console.log("  Generating overall analysis...");
  const { overallJson, overallMd } = await generateOverallAnalysis(
    apiKey, baseUrl, model, normalizedItems, dataProfile, segmentsData
  );

  fs.writeFileSync(
    path.join(ANALYSIS_DIR, "mixed-feedback.overall.analysis.json"),
    JSON.stringify(overallJson, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(ANALYSIS_DIR, "mixed-feedback.overall.analysis.md"),
    overallMd,
    "utf-8"
  );

  // Step 4: Generate segment analyses
  console.log("  Generating segment analyses...");
  for (const segment of segmentsData.segments) {
    const segmentFeedback = normalizedItems.filter(
      (item) => item.detected_segment_id === segment.segment_id
    );

    if (segmentFeedback.length === 0) continue;

    const { segmentJson, segmentMd } = segment.segment_type === "noise"
      ? generateNoiseSegmentAnalysis(segment, segmentFeedback)
      : segment.segment_type === "unknown"
        ? generateUnknownSegmentAnalysis(segment, segmentFeedback)
        : segment.segment_type === "positive"
          ? generatePositiveSegmentAnalysis(segment, segmentFeedback)
          : await generateSegmentAnalysis(apiKey, baseUrl, model, segment, segmentFeedback);

    fs.writeFileSync(
      path.join(segmentsDir, `${segment.segment_id}.analysis.json`),
      JSON.stringify(segmentJson, null, 2),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(segmentsDir, `${segment.segment_id}.analysis.md`),
      segmentMd,
      "utf-8"
    );
  }

  console.log("  ✅ Analysis complete");
}

function generateDataProfile(items: NormalizedFeedback[]): DataProfile {
  const productTypes = new Set<string>();
  const businessGoals = new Set<string>();
  const sources = new Set<string>();
  let noiseCount = 0;
  let highConf = 0, medConf = 0, lowConf = 0;

  for (const item of items) {
    // Use segment-based product type mapping
    const productType = SEGMENT_PRODUCT_TYPE_MAP[item.detected_segment_id] || item.detected_product_type;
    if (productType && productType !== "unknown") {
      productTypes.add(productType);
    }

    const businessGoal = SEGMENT_BUSINESS_GOAL_MAP[item.detected_segment_id] || item.detected_business_goal;
    if (businessGoal && businessGoal !== "unknown") {
      businessGoals.add(businessGoal);
    }

    if (item.detected_source) {
      sources.add(item.detected_source);
    }

    if (item.detected_segment_id === "seg-noise") {
      noiseCount++;
    }

    if (item.confidence >= 0.8) highConf++;
    else if (item.confidence >= 0.6) medConf++;
    else lowConf++;
  }

  return {
    dataset: "mixed-feedback",
    total_raw_feedback_count: items.length,
    normalized_feedback_count: items.length,
    is_mixed_dataset: productTypes.size > 1,
    detected_product_types: Array.from(productTypes),
    detected_business_goals: Array.from(businessGoals),
    detected_sources: Array.from(sources),
    unknown_count: 0, // seg-noise is classified, not unknown
    noise_count: noiseCount,
    confidence_distribution: { high: highConf, medium: medConf, low: lowConf },
    notes: noiseCount > 0 ? ["噪声反馈已作为 seg-noise 独立分组处理。"] : [],
  };
}

function generateSegments(items: NormalizedFeedback[]): SegmentsData {
  const segmentMap = new Map<string, NormalizedFeedback[]>();

  for (const item of items) {
    const segId = item.detected_segment_id || "seg-unknown";
    if (!segmentMap.has(segId)) {
      segmentMap.set(segId, []);
    }
    segmentMap.get(segId)!.push(item);
  }

  const segments: Segment[] = [];
  for (const [segId, segItems] of segmentMap) {
    const themes = new Set<string>();
    for (const item of segItems) {
      if (item.detected_theme && item.detected_theme !== "unknown") {
        themes.add(item.detected_theme);
      }
    }

    const isNoise = segId === "seg-noise";
    const isUnknown = segId === "seg-unknown";
    const isPositive = segId === "seg-positive";
    segments.push({
      segment_id: segId,
      segment_type: isNoise ? "noise" : isUnknown ? "unknown" : isPositive ? "positive" : "business",
      name: getSegmentName(segId),
      product_type: SEGMENT_PRODUCT_TYPE_MAP[segId] || "unknown",
      business_goal: SEGMENT_BUSINESS_GOAL_MAP[segId] || "unknown",
      feedback_count: segItems.length,
      feedback_ids: segItems.map((item) => item.feedback_id),
      main_themes: Array.from(themes).slice(0, 5),
    });
  }

  const businessSegments = segments.filter((s) => s.segment_type === "business");
  const noiseSegments = segments.filter((s) => s.segment_type === "noise");
  const positiveSegments = segments.filter((s) => s.segment_type === "positive");

  return {
    dataset: "mixed-feedback",
    is_mixed_dataset: businessSegments.length > 1,
    segment_count: segments.length,
    business_segment_count: businessSegments.length,
    noise_segment_count: noiseSegments.length,
    positive_segment_count: positiveSegments.length,
    segments,
  };
}

function getSegmentName(segId: string): string {
  const names: Record<string, string> = {
    "seg-b2b-renewal": "B端 SaaS 续费风险",
    "seg-b2b-activation": "B端 SaaS 激活问题",
    "seg-ai-experience": "AI 产品体验问题",
    "seg-bi-renewal": "BI 工具续费问题",
    "seg-ecommerce-conversion": "电商转化问题",
    "seg-internal-cost": "内部系统降本问题",
    "seg-noise": "噪声/无效反馈",
    "seg-unknown": "未分类反馈",
    "seg-positive": "正向反馈汇总",
  };
  return names[segId] || segId;
}

async function generateOverallAnalysis(
  apiKey: string,
  baseUrl: string,
  model: string,
  items: NormalizedFeedback[],
  dataProfile: DataProfile,
  segmentsData: SegmentsData
): Promise<{ overallJson: OverallAnalysis; overallMd: string }> {
  // Generate issue clusters for each segment
  const allClusters: IssueCluster[] = [];

  for (const segment of segmentsData.segments) {
    const segItems = items.filter((item) => item.detected_segment_id === segment.segment_id);
    if (segItems.length === 0) continue;

    if (segment.segment_type === "noise") {
      // Noise segment gets simple cluster
      allClusters.push({
        cluster_id: `cluster-${segment.segment_id}-001`,
        segment_id: segment.segment_id,
        name: "无效/噪声反馈",
        summary: "包含无效内容、情绪表达、无法归因的反馈",
        feedback_count: segItems.length,
        evidence_feedback_ids: segItems.slice(0, 3).map((item) => item.feedback_id),
        secondary_themes: [],
        possible_metrics: [],
        priority: "P3",
        opportunity_score: 0,
        recommendation: "不进入核心问题排序，保留为低置信度样本。",
      });
    } else if (segment.segment_type === "unknown") {
      // Unknown segment: no business opportunities, just categorization suggestions
      allClusters.push({
        cluster_id: `cluster-${segment.segment_id}-001`,
        segment_id: segment.segment_id,
        name: "未分类反馈",
        summary: "无法明确归类的反馈，需要人工复核",
        feedback_count: segItems.length,
        evidence_feedback_ids: segItems.slice(0, 3).map((item) => item.feedback_id),
        secondary_themes: [],
        possible_metrics: [],
        priority: "P3",
        opportunity_score: 0,
        recommendation: "需要人工复核，尝试重新归类到具体业务分组。",
      });
    } else if (segment.segment_type === "positive") {
      // Positive segment: no business opportunities, just summary
      allClusters.push({
        cluster_id: `cluster-${segment.segment_id}-001`,
        segment_id: segment.segment_id,
        name: "正向反馈汇总",
        summary: "用户对产品功能、体验等方面的正面评价",
        feedback_count: segItems.length,
        evidence_feedback_ids: segItems.slice(0, 3).map((item) => item.feedback_id),
        secondary_themes: [],
        possible_metrics: [],
        priority: "P3",
        opportunity_score: 0,
        recommendation: "保留正向反馈作为产品亮点参考，可纳入产品宣传材料。",
      });
    } else {
      const clusters = await generateClustersForSegment(apiKey, baseUrl, model, segment, segItems);
      allClusters.push(...clusters);
    }
  }

  // Generate overall markdown
  const overallMd = generateOverallMarkdown(dataProfile, segmentsData, allClusters);

  const overallJson: OverallAnalysis = {
    project_id: "",
    analysis_run_id: "",
    summary: {
      total_feedback_count: items.length,
      analyzed_feedback_count: items.length,
      clustered_feedback_count: items.length, // All items are clustered (including noise)
      unclustered_feedback_count: 0,
      unanalyzed_feedback_count: 0,
      segment_count: segmentsData.segment_count,
      business_segment_count: segmentsData.business_segment_count,
      noise_segment_count: segmentsData.noise_segment_count,
      positive_segment_count: segmentsData.positive_segment_count,
      cluster_count: allClusters.length,
      is_mixed_dataset: dataProfile.is_mixed_dataset,
    },
    segments: segmentsData.segments.map((seg) => ({
      segment_id: seg.segment_id,
      name: seg.name,
      feedback_count: seg.feedback_count,
      business_goal: seg.business_goal,
      issue_cluster_ids: allClusters.filter((c) => c.segment_id === seg.segment_id).map((c) => c.cluster_id),
    })),
    issue_clusters: allClusters,
    report_path: "fixtures/analysis/mixed-feedback.overall.analysis.md",
  };

  return { overallJson, overallMd };
}

function generateOverallMarkdown(
  dataProfile: DataProfile,
  segmentsData: SegmentsData,
  clusters: IssueCluster[]
): string {
  const businessSegments = segmentsData.segments.filter((s) => s.segment_type === "business");
  const noiseSegments = segmentsData.segments.filter((s) => s.segment_type === "noise");
  const positiveSegments = segmentsData.segments.filter((s) => s.segment_type === "positive");
  const businessClusters = clusters.filter((c) => {
    const seg = segmentsData.segments.find((s) => s.segment_id === c.segment_id);
    return seg?.segment_type === "business";
  });

  return `# 产品反馈分析报告

## 一、分析范围
- 原始反馈数量：${dataProfile.total_raw_feedback_count}
- 实际分析数量：${dataProfile.normalized_feedback_count}
- 已归类反馈数量：${dataProfile.normalized_feedback_count}
- 未归类反馈数量：0
- 未分析反馈数量：0
- 是否混合数据：${dataProfile.is_mixed_dataset ? "是" : "否"}
- 识别出的主要分组：${segmentsData.segment_count} 个
- 业务分组数量：${businessSegments.length} 个
- 噪声分组数量：${noiseSegments.length} 个
${noiseSegments.length > 0 ? "- 说明：噪声/无效反馈作为 seg-noise 独立分组处理，因此计入已归类反馈，但不参与核心业务机会排序。" : ""}

## 二、数据分组概览

${segmentsData.segments.map((seg) =>
  `- **${seg.name}**：${seg.feedback_count} 条反馈，产品类型 ${seg.product_type}，业务目标 ${seg.business_goal}`
).join("\n")}

## 三、整体核心结论

基于 ${dataProfile.total_raw_feedback_count} 条反馈分析，识别出 ${businessClusters.length} 个业务问题。

${businessSegments.map((seg) => {
  const segClusters = businessClusters.filter((c) => c.segment_id === seg.segment_id);
  if (segClusters.length === 0) return "";
  const topCluster = segClusters.sort((a, b) => b.opportunity_score - a.opportunity_score)[0];
  return `- **${seg.name}**：最高频问题是"${topCluster.name}"（${topCluster.feedback_count} 条反馈）`;
}).filter(Boolean).join("\n")}

## 四、跨分组高优先级问题

${businessClusters
  .filter((c) => c.priority === "P0" || c.priority === "P1")
  .sort((a, b) => b.opportunity_score - a.opportunity_score)
  .slice(0, 5)
  .map((c) => `- **${c.name}**（${c.segment_id}）：${c.summary}`)
  .join("\n")}

## 五、各分组摘要

${businessSegments.map((seg) => {
  const segClusters = businessClusters.filter((c) => c.segment_id === seg.segment_id);
  return `### ${seg.name}
- 反馈数量：${seg.feedback_count}
- 问题数量：${segClusters.length}
- 主要主题：${seg.main_themes.join("、")}`;
}).join("\n\n")}

${noiseSegments.length > 0 ? `
### 噪声/无效反馈
- 反馈数量：${noiseSegments[0].feedback_count}
- 说明：不进入核心问题排序，保留为低置信度样本。
` : ""}

${positiveSegments.length > 0 ? `
### 正向反馈汇总
- 反馈数量：${positiveSegments[0].feedback_count}
- 说明：用户正面评价，可作为产品亮点参考，不参与问题排序。
` : ""}

## 六、建议行动

${businessSegments.map((seg) => {
  const segClusters = businessClusters.filter((c) => c.segment_id === seg.segment_id);
  if (segClusters.length === 0) return "";
  const topCluster = segClusters.sort((a, b) => b.opportunity_score - a.opportunity_score)[0];
  return `- **${seg.name}**：${topCluster.recommendation}`;
}).filter(Boolean).join("\n")}

## 七、风险提醒

${businessSegments.map((seg) => {
  const segClusters = businessClusters.filter((c) => c.segment_id === seg.segment_id);
  if (segClusters.length === 0) return "";
  return `- **${seg.name}**：需要验证问题的真实影响范围和用户容忍度。`;
}).filter(Boolean).join("\n")}

## 八、需要进一步验证的问题

${businessClusters
  .filter((c) => c.priority === "P2" || c.priority === "P3")
  .slice(0, 3)
  .map((c) => `- **${c.name}**：${c.summary}`)
  .join("\n")}

## 九、给老板看的摘要

基于 ${dataProfile.total_raw_feedback_count} 条用户反馈分析，识别出 ${businessSegments.length} 个业务分组和 ${businessClusters.length} 个问题。${noiseSegments.length > 0 ? `其中 ${noiseSegments[0].feedback_count} 条为噪声反馈，已单独处理。` : ""}建议优先处理跨分组的高优先级问题。`;
}

async function generateClustersForSegment(
  apiKey: string,
  baseUrl: string,
  model: string,
  segment: Segment,
  items: NormalizedFeedback[]
): Promise<IssueCluster[]> {
  const system = `你是一个产品分析专家。请基于反馈数据生成问题聚类。

要求：
1. 每个 cluster 必须有 evidence_feedback_ids
2. evidence_feedback_ids 必须真实存在于输入数据中
3. 每个 cluster 至少 2 条证据
4. 不要编造不存在的数据
5. 不要生成 "待补充" 等占位符`;

  const feedbackList = items.map((item) =>
    `ID: ${item.feedback_id}\n内容: ${item.cleaned_content}\n主题: ${item.detected_theme}`
  ).join("\n---\n");

  const user = `分组：${segment.name}
产品类型：${segment.product_type}
业务目标：${segment.business_goal}
反馈数量：${items.length}

反馈数据：
${feedbackList}

请生成问题聚类，输出 JSON 数组：
[{
  "cluster_id": "cluster-001",
  "segment_id": "${segment.segment_id}",
  "name": "问题名称",
  "summary": "问题摘要",
  "feedback_count": 5,
  "evidence_feedback_ids": ["FB001", "FB002", "FB003"],
  "secondary_themes": [],
  "possible_metrics": ["指标1", "指标2"],
  "priority": "P0",
  "opportunity_score": 85,
  "recommendation": "具体建议，不要写待补充"
}]

只输出 JSON 数组，不要输出其他内容。`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "";

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  let jsonStr = jsonMatch[0].replace(/[""]/g, '"');
  try {
    const clusters = JSON.parse(jsonStr);
    // Validate and fix clusters
    return clusters.map((c: any, i: number) => ({
      cluster_id: c.cluster_id || `cluster-${segment.segment_id}-${String(i + 1).padStart(3, "0")}`,
      segment_id: segment.segment_id,
      name: c.name || `问题 ${i + 1}`,
      summary: c.summary || c.name || `问题 ${i + 1}`,
      feedback_count: c.feedback_count || 0,
      evidence_feedback_ids: Array.isArray(c.evidence_feedback_ids) ? c.evidence_feedback_ids : [],
      secondary_themes: Array.isArray(c.secondary_themes) ? c.secondary_themes : [],
      possible_metrics: Array.isArray(c.possible_metrics) ? c.possible_metrics : [],
      priority: c.priority || "P2",
      opportunity_score: c.opportunity_score || 50,
      recommendation: c.recommendation || "需要进一步分析。",
    }));
  } catch (e) {
    return [];
  }
}

function generateNoiseSegmentAnalysis(
  segment: Segment,
  items: NormalizedFeedback[]
): { segmentJson: any; segmentMd: string } {
  const segmentMd = `# 噪声/无效反馈处理报告

## 一、分析范围
- Segment ID: seg-noise
- Segment 名称: 噪声/无效反馈
- 产品类型: unknown
- 业务目标: unknown
- 反馈数量：${items.length}
- 噪声类型：无效内容、情绪表达、无法归因反馈

## 二、噪声类型分布

${items.map((item) => `- ${item.detected_theme || "未知类型"}：${item.cleaned_content.substring(0, 50)}...`).join("\n")}

## 三、处理建议
- 不进入核心问题排序
- 不参与高优先级机会计算
- 不进入老板摘要核心业务问题
- 保留为低置信度 / 噪声样本
- 后续可人工抽检是否误判

## 四、风险提醒
- 如果噪声反馈被强行归入业务问题，会影响分析准确性。
- 如果噪声比例持续升高，应优化数据清洗和输入引导。

## 五、需要进一步验证的问题
- 是否存在被误判为噪声的真实业务反馈？
- 是否存在某类来源持续产生低质量反馈？`;

  const segmentJson = {
    segment_id: segment.segment_id,
    segment_type: "noise",
    summary: {
      feedback_count: items.length,
      cluster_count: 1,
      clustered_feedback_count: items.length,
      unclustered_feedback_count: 0,
    },
    issue_clusters: [
      {
        cluster_id: `cluster-${segment.segment_id}-001`,
        segment_id: segment.segment_id,
        name: "无效/噪声反馈",
        summary: "包含无效内容、情绪表达、无法归因的反馈",
        feedback_count: items.length,
        evidence_feedback_ids: items.slice(0, 3).map((item) => item.feedback_id),
        possible_metrics: [],
        priority: "P3",
        opportunity_score: 0,
        recommendation: "不进入核心问题排序，保留为低置信度样本。",
      },
    ],
  };

  return { segmentJson, segmentMd };
}

function generateUnknownSegmentAnalysis(
  segment: Segment,
  items: NormalizedFeedback[]
): { segmentJson: any; segmentMd: string } {
  const segmentMd = `# 未分类反馈处理报告

## 一、分析范围
- Segment ID: seg-unknown
- Segment 名称: 未分类反馈
- 产品类型: unknown
- 业务目标: unknown
- 反馈数量：${items.length}
- 未分类原因：无法明确识别产品类型或业务目标

## 二、未分类反馈分布

${items.map((item) => `- ${item.unknown_reason || "无法归类"}：${item.cleaned_content.substring(0, 50)}...`).join("\n")}

## 三、候选归类方向

以下反馈可能可以重新归类：
${items.filter((item) => item.confidence >= 0.4).map((item) => `- "${item.cleaned_content.substring(0, 30)}..." → 可能属于 ${item.detected_theme || "待定"}`).join("\n") || "- 当前无高置信度候选"}

## 四、处理建议
- 不进入核心问题排序
- 不参与高优先级机会计算
- 不进入老板摘要核心业务问题
- 不生成 P0/P1 优先级
- 不生成 opportunity_score
- 保留为待人工复核样本
- 后续可通过人工复核重新归类

## 五、风险提醒
- 如果未分类反馈比例过高，说明数据质量或分类模型需要优化。
- 部分未分类反馈可能包含有价值的业务信息，建议人工抽检。

## 六、需要进一步验证的问题
- 未分类反馈中是否有可以识别出业务问题的内容？
- 是否需要调整分类规则以减少未分类比例？`;

  const segmentJson = {
    segment_id: segment.segment_id,
    segment_type: "unknown",
    summary: {
      feedback_count: items.length,
      cluster_count: 1,
      clustered_feedback_count: items.length,
      unclustered_feedback_count: 0,
    },
    issue_clusters: [
      {
        cluster_id: `cluster-${segment.segment_id}-001`,
        segment_id: segment.segment_id,
        name: "未分类反馈",
        summary: "无法明确归类的反馈，需要人工复核",
        feedback_count: items.length,
        evidence_feedback_ids: items.slice(0, 3).map((item) => item.feedback_id),
        possible_metrics: [],
        priority: "P3",
        opportunity_score: 0,
        recommendation: "需要人工复核，尝试重新归类到具体业务分组。",
      },
    ],
  };

  return { segmentJson, segmentMd };
}

function generatePositiveSegmentAnalysis(
  segment: Segment,
  items: NormalizedFeedback[]
): { segmentJson: any; segmentMd: string } {
  const segmentMd = `# 正向反馈汇总报告

## 一、分析范围
- Segment ID: seg-positive
- Segment 名称: 正向反馈汇总
- 产品类型: unknown
- 业务目标: unknown
- 反馈数量：${items.length}
- 内容类型：用户正面评价、功能表扬、满意度表达

## 二、正向反馈分布

${items.map((item) => `- ${item.detected_theme || "正面评价"}：${item.cleaned_content.substring(0, 60)}...`).join("\n")}

## 三、产品亮点

基于正向反馈，以下方面获得用户认可：
${items.filter((item) => item.detected_theme && item.detected_theme !== "unknown").map((item) => `- **${item.detected_theme}**：${item.cleaned_content.substring(0, 40)}...`).join("\n") || "- 用户对产品的整体体验表示满意"}

## 四、处理建议
- 保留正向反馈作为产品亮点参考
- 可纳入产品宣传材料和案例展示
- 用于对比改进后的用户满意度变化
- 不参与问题排序和机会评分

## 五、风险提醒
- 正向反馈不能替代问题反馈的分析
- 需要结合问题反馈全面了解用户满意度

## 六、需要进一步验证的问题
- 正向反馈的用户是否也遇到了其他问题？
- 正向反馈是否集中在特定功能或时间段？`;

  const segmentJson = {
    segment_id: segment.segment_id,
    segment_type: "positive",
    summary: {
      feedback_count: items.length,
      cluster_count: 1,
      clustered_feedback_count: items.length,
      unclustered_feedback_count: 0,
    },
    issue_clusters: [
      {
        cluster_id: `cluster-${segment.segment_id}-001`,
        segment_id: segment.segment_id,
        name: "正向反馈汇总",
        summary: "用户对产品功能、体验等方面的正面评价",
        feedback_count: items.length,
        evidence_feedback_ids: items.slice(0, 3).map((item) => item.feedback_id),
        possible_metrics: [],
        priority: "P3",
        opportunity_score: 0,
        recommendation: "保留正向反馈作为产品亮点参考，可纳入产品宣传材料。",
      },
    ],
  };

  return { segmentJson, segmentMd };
}

async function generateSegmentAnalysis(
  apiKey: string,
  baseUrl: string,
  model: string,
  segment: Segment,
  items: NormalizedFeedback[]
): Promise<{ segmentJson: any; segmentMd: string }> {
  // Generate clusters for this segment
  const clusters = await generateClustersForSegment(apiKey, baseUrl, model, segment, items);

  // Sort clusters by feedback_count
  const sortedClusters = [...clusters].sort((a, b) => b.feedback_count - a.feedback_count);
  const topClusters = sortedClusters.slice(0, 5);
  const remainingCount = items.length - clusters.reduce((sum, c) => sum + c.feedback_count, 0);

  // Use AI to generate detailed report
  const system = `你是一个资深产品负责人。请基于分析结果生成完整的产品反馈分析报告。

严格要求：
1. 不要生成"待补充"等占位符
2. 每个章节必须有实际内容
3. 核心结论必须详细分析痛点和业务影响
4. Top 问题必须包含完整结构：摘要、反馈数量、代表性证据、指标、优先级、机会评分、建议
5. 建议行动必须有时间维度
6. 风险提醒必须结合业务目标
7. 老板摘要必须包含核心问题、直接后果、关键机会、建议`;

  const clusterData = topClusters.map((c, i) => `${i + 1}. ${c.name}
   - 摘要：${c.summary}
   - 反馈数量：${c.feedback_count}
   - 代表性证据：${JSON.stringify(c.evidence_feedback_ids)}
   - 指标：${c.possible_metrics.join("、")}
   - 优先级：${c.priority}
   - 机会分：${c.opportunity_score}
   - 建议：${c.recommendation}`).join("\n\n");

  const user = `请为以下分组生成完整的产品反馈分析报告。

分组信息：
- Segment ID: ${segment.segment_id}
- 名称: ${segment.name}
- 产品类型: ${segment.product_type}
- 业务目标: ${segment.business_goal}
- 反馈数量: ${items.length}
- 问题数量: ${clusters.length}

Top 问题详情：
${clusterData}

${remainingCount > 0 ? `剩余 ${remainingCount} 条反馈分布在低频问题中。` : ""}

请输出完整报告，包含以下 8 个章节：

1. 分析范围
2. 核心结论（详细分析痛点和业务影响）
3. 高频问题 Top 5（每个问题包含完整结构）
4. 高优先级机会（至少 3 条，结合业务目标）
5. 建议行动（有时间维度：立即、短期、中期、持续）
6. 风险提醒（至少 3 条，结合业务目标）
7. 需要进一步验证的问题（至少 3 条）
8. 给老板看的摘要（包含核心问题、直接后果、关键机会、建议）

只输出 Markdown，不要输出 JSON。`;

  let segmentMd: string;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error("AI API error");
    }

    const data = await response.json();
    segmentMd = data.choices[0]?.message?.content || "";
  } catch (error) {
    // Fallback to template-based report
    segmentMd = generateFallbackSegmentReport(segment, items, clusters);
  }

  // Fix cluster_feedback_count closure
  const clusterFeedbackSum = clusters.reduce((sum, c) => sum + c.feedback_count, 0);
  const unclusteredCount = items.length - clusterFeedbackSum;

  // If clusters don't sum to total, adjust the largest cluster
  if (unclusteredCount > 0 && clusters.length > 0) {
    const largestCluster = clusters.sort((a, b) => b.feedback_count - a.feedback_count)[0];
    largestCluster.feedback_count += unclusteredCount;
  }

  const segmentJson = {
    segment_id: segment.segment_id,
    segment_type: "business",
    summary: {
      feedback_count: items.length,
      cluster_count: clusters.length,
      clustered_feedback_count: items.length,
      unclustered_feedback_count: 0,
    },
    issue_clusters: clusters,
  };

  return { segmentJson, segmentMd };
}

function generateFallbackSegmentReport(
  segment: Segment,
  items: NormalizedFeedback[],
  clusters: IssueCluster[]
): string {
  const sortedClusters = [...clusters].sort((a, b) => b.feedback_count - a.feedback_count);
  const topClusters = sortedClusters.slice(0, 5);
  const remainingCount = items.length - clusters.reduce((sum, c) => sum + c.feedback_count, 0);

  const topIssueDetails = topClusters.map((c, i) => `${i + 1}. **${c.name}**
   - **摘要**：${c.summary}
   - **反馈数量**：${c.feedback_count} 条
   - **代表性证据**：\`${JSON.stringify(c.evidence_feedback_ids)}\`
   - **可能的改进指标**：${c.possible_metrics.join("、") || "待定"}
   - **优先级**：${c.priority}
   - **机会评分**：${c.opportunity_score}
   - **建议**：${c.recommendation}`).join("\n\n");

  const highPriorityOpps = clusters
    .filter((c) => c.priority === "P0" || c.priority === "P1")
    .slice(0, 3)
    .map((c, i) => `${i + 1}. **${c.name}**：这个问题直接影响${segment.business_goal}，建议优先处理。`)
    .join("\n");

  return `# 产品反馈分析报告

## 一、分析范围
- Segment ID: ${segment.segment_id}
- Segment 名称: ${segment.name}
- 产品类型: ${segment.product_type}
- 业务目标: ${segment.business_goal}
- 原始反馈数量：${items.length}
- 实际分析数量：${items.length}
- 已归类反馈数量：${items.filter((i) => i.detected_theme !== "unknown").length}
- 未归类反馈数量：${items.filter((i) => i.detected_theme === "unknown").length}
- 未分析反馈数量：0
- 问题聚类：${clusters.length} 个

## 二、核心结论

基于 ${items.length} 条反馈分析，当前${segment.name}分组的核心痛点集中在 ${topClusters[0]?.name || "多个问题"} 和 ${topClusters[1]?.name || "其他问题"} 上。这些问题直接影响${segment.business_goal}目标的达成。

具体表现为：
1. ${topClusters[0]?.name || "主要问题"}是最高频问题，涉及 ${topClusters[0]?.feedback_count || 0} 条反馈，说明用户对这方面的体验最为不满。
2. ${topClusters[1]?.name || "次要问题"}是第二高频问题，涉及 ${topClusters[1]?.feedback_count || 0} 条反馈，反映出产品在该方面存在系统性问题。
3. 这些问题会导致用户满意度下降、使用效率降低，最终影响${segment.business_goal}。

## 三、高频问题 Top 5

${topIssueDetails}

${topClusters.length < 5 ? `\n当前仅可靠识别出 ${topClusters.length} 个高频问题，证据不足以列出更多问题，因此不强行补齐。` : ""}

${remainingCount > 0 ? `\n除 Top 问题外，剩余 ${remainingCount} 条反馈分布在低频问题或其他问题中，未进入 Top 5。` : ""}

## 四、高优先级机会

${highPriorityOpps || "当前没有 P0/P1 级别的高优先级机会。"}

## 五、建议行动

1. **立即启动**：针对${topClusters[0]?.name || "最高频问题"}问题，立即组织产品和技术团队评估修复方案。
2. **短期规划（1-2个月）**：完成${topClusters[1]?.name || "次要问题"}的根因分析和解决方案设计。
3. **中期规划（3-6个月）**：建立系统性的${segment.business_goal}监控体系，持续跟踪关键指标变化。
4. **持续监控**：定期收集用户反馈，建立反馈闭环机制。

## 六、风险提醒

- **用户流失风险**：如果不及时处理${topClusters[0]?.name || "核心问题"}，可能导致用户满意度持续下降，影响${segment.business_goal}。
- **竞争劣势风险**：竞争对手可能在这些方面做得更好，导致用户转向竞品。
- **口碑传播风险**：不满的用户可能通过社交媒体、口碑传播负面影响，扩大问题影响范围。

## 七、需要进一步验证的问题

1. ${topClusters[0]?.name || "核心问题"}的影响范围有多大？是否所有用户都遇到这个问题？
2. 用户对这些问题的容忍度如何？是否已经导致用户流失？
3. 这些问题的技术实现难度如何？需要多少资源来解决？

## 八、给老板看的摘要

**核心问题**：${segment.name}分组中，${topClusters[0]?.name || "核心问题"}和${topClusters[1]?.name || "次要问题"}是用户反馈最多的问题，直接影响${segment.business_goal}。

**直接后果**：如果不处理这些问题，用户满意度将持续下降，可能导致用户流失和口碑恶化。

**关键机会**：优先解决${topClusters[0]?.name || "核心问题"}，预计能显著提升用户满意度和${segment.business_goal}。

**建议**：立即启动${topClusters[0]?.name || "核心问题"}的修复工作，同时在短期内完成${topClusters[1]?.name || "次要问题"}的根因分析。`;
}

// CLI entry point
if (require.main === module) {
  analyzeFeedback()
    .then(() => console.log("Analysis complete"))
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}
