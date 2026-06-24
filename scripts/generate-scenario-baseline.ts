/**
 * InsightPM AI - Parameterized Scenario Baseline Generator
 * 运行: npx tsx scripts/generate-scenario-baseline.ts --scenario onboarding-activation --variant v1 --count 150
 *
 * 支持 5 类业务场景:
 *   onboarding-activation, ai-product-experience, internal-tools-efficiency,
 *   ecommerce-conversion, bi-dashboard-renewal
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const PROJECT_ROOT = path.join(__dirname, "..");
const BASELINE_DIR = path.join(PROJECT_ROOT, "baseline");

// ── Scenario Definitions ─────────────────────────────────────────

interface ScenarioDef {
  name: string;
  description: string;
  productType: string;
  businessGoal: string;
  themes: { segment: string; segmentName: string; businessGoal: string; weight: number }[];
  generationPrompt: string;
  normalizationSegments: string;
}

const SCENARIOS: Record<string, ScenarioDef> = {
  "onboarding-activation": {
    name: "onboarding-activation",
    description: "用户激活、注册、登录、权限、邀请、首次使用、引导文档",
    productType: "SaaS-onboarding",
    businessGoal: "提升激活率 / 降低上手门槛",
    themes: [
      { segment: "seg-onboarding-activation", segmentName: "激活流程问题", businessGoal: "提升激活成功率", weight: 0.18 },
      { segment: "seg-onboarding-registration", segmentName: "注册与登录问题", businessGoal: "降低注册流失", weight: 0.15 },
      { segment: "seg-onboarding-invitation", segmentName: "邀请与权限问题", businessGoal: "提升团队协作效率", weight: 0.12 },
      { segment: "seg-onboarding-guidance", segmentName: "引导与文档问题", businessGoal: "降低上手难度", weight: 0.15 },
      { segment: "seg-onboarding-first-use", segmentName: "首次使用体验", businessGoal: "提升首次使用满意度", weight: 0.12 },
      { segment: "seg-onboarding-config", segmentName: "初始配置问题", businessGoal: "简化配置流程", weight: 0.10 },
      { segment: "seg-onboarding-performance", segmentName: "性能与加载问题", businessGoal: "提升系统响应速度", weight: 0.08 },
    ],
    generationPrompt: `产品背景：SaaS 产品的用户激活和上手流程，包括注册、登录、邀请、首次使用、引导文档等。

严格要求：
1. 不要包含标准答案字段
2. 数据必须混合多个激活/上手相关问题类型
3. 数据必须混合多个来源：客服工单、销售转述、用户访谈、问卷、App评论、邮件反馈、NPS评论
4. 包含短句反馈（5-15字）
5. 包含转述反馈
6. 必须包含 5-8 条重复或近似重复反馈
7. 包含噪声反馈（无关、情绪化、无意义）
8. 包含口语表达、错别字
9. 包含少量正向反馈（约 5-8 条）
10. 不允许出现真实手机号、邮箱、身份证、真实公司名、真实个人名
11. 约 30% 反馈应超过 40 字，约 10% 应超过 80 字

激活/上手场景分布：
- 激活流程/注册：约 25 条
- 登录/验证码：约 20 条
- 邀请/权限：约 18 条
- 引导/文档：约 20 条
- 首次使用体验：约 18 条
- 初始配置：约 15 条
- 性能/加载：约 12 条
- 噪声/正向/无效：约 22 条`,
    normalizationSegments: `- 激活流程: seg-onboarding-activation
- 注册登录: seg-onboarding-registration
- 邀请权限: seg-onboarding-invitation
- 引导文档: seg-onboarding-guidance
- 首次使用: seg-onboarding-first-use
- 初始配置: seg-onboarding-config
- 性能加载: seg-onboarding-performance
- 噪声: seg-noise
- 正向: seg-positive
- 未知: seg-unknown`,
  },

  "ai-product-experience": {
    name: "ai-product-experience",
    description: "AI 输出质量、幻觉、推荐准确性、AI 客服、使用量、数据安全",
    productType: "AI-product",
    businessGoal: "提升 AI 输出质量 / 降低幻觉率",
    themes: [
      { segment: "seg-ai-output-quality", segmentName: "AI 输出质量问题", businessGoal: "提升输出准确性", weight: 0.20 },
      { segment: "seg-ai-hallucination", segmentName: "AI 幻觉与错误", businessGoal: "降低幻觉率", weight: 0.15 },
      { segment: "seg-ai-recommendation", segmentName: "推荐准确性问题", businessGoal: "提升推荐相关性", weight: 0.15 },
      { segment: "seg-ai-customer-service", segmentName: "AI 客服体验", businessGoal: "提升客服满意度", weight: 0.12 },
      { segment: "seg-ai-usage", segmentName: "使用量与配额", businessGoal: "优化使用量管理", weight: 0.10 },
      { segment: "seg-ai-data-security", segmentName: "数据安全与隐私", businessGoal: "提升数据安全信任", weight: 0.10 },
      { segment: "seg-ai-performance", segmentName: "AI 响应速度", businessGoal: "提升响应效率", weight: 0.08 },
    ],
    generationPrompt: `产品背景：AI 驱动的 SaaS 产品，包括 AI 输出、推荐系统、AI 客服、使用量管理等。

严格要求：
1. 不要包含标准答案字段
2. 数据必须混合多个 AI 体验相关问题类型
3. 数据必须混合多个来源：客服工单、用户访谈、问卷、App评论、NPS评论、社区反馈
4. 包含短句反馈（5-15字）
5. 包含转述反馈
6. 必须包含 5-8 条重复或近似重复反馈
7. 包含噪声反馈
8. 包含口语表达、错别字
9. 包含少量正向反馈（约 5-8 条）
10. 不允许出现真实个人信息
11. 约 30% 反馈应超过 40 字，约 10% 应超过 80 字

AI 体验场景分布：
- AI 输出质量：约 25 条
- 幻觉/错误：约 20 条
- 推荐准确性：约 20 条
- AI 客服：约 18 条
- 使用量/配额：约 15 条
- 数据安全：约 15 条
- 响应速度：约 12 条
- 噪声/正向/无效：约 25 条`,
    normalizationSegments: `- AI 输出质量: seg-ai-output-quality
- 幻觉错误: seg-ai-hallucination
- 推荐准确性: seg-ai-recommendation
- AI 客服: seg-ai-customer-service
- 使用量配额: seg-ai-usage
- 数据安全: seg-ai-data-security
- 响应速度: seg-ai-performance
- 噪声: seg-noise
- 正向: seg-positive
- 未知: seg-unknown`,
  },

  "internal-tools-efficiency": {
    name: "internal-tools-efficiency",
    description: "内部系统效率、降本、员工使用、流程配置、系统稳定性、培训成本",
    productType: "internal-tools",
    businessGoal: "提升内部效率 / 降低运营成本",
    themes: [
      { segment: "seg-internal-efficiency", segmentName: "系统效率问题", businessGoal: "提升工作效率", weight: 0.18 },
      { segment: "seg-internal-cost", segmentName: "成本与降本问题", businessGoal: "降低运营成本", weight: 0.15 },
      { segment: "seg-internal-adoption", segmentName: "员工使用与采纳", businessGoal: "提升系统使用率", weight: 0.15 },
      { segment: "seg-internal-config", segmentName: "流程配置问题", businessGoal: "简化配置管理", weight: 0.12 },
      { segment: "seg-internal-stability", segmentName: "系统稳定性问题", businessGoal: "提升系统可用性", weight: 0.12 },
      { segment: "seg-internal-training", segmentName: "培训成本问题", businessGoal: "降低培训成本", weight: 0.10 },
      { segment: "seg-internal-integration", segmentName: "集成与打通问题", businessGoal: "提升系统集成度", weight: 0.08 },
    ],
    generationPrompt: `产品背景：企业内部工具/系统，用于提升员工效率、降低运营成本。

严格要求：
1. 不要包含标准答案字段
2. 数据必须混合多个内部效率相关问题类型
3. 数据必须混合多个来源：IT工单、员工反馈、部门经理转述、内部问卷、系统日志分析
4. 包含短句反馈（5-15字）
5. 包含转述反馈
6. 必须包含 5-8 条重复或近似重复反馈
7. 包含噪声反馈
8. 包含口语表达
9. 包含少量正向反馈（约 5-8 条）
10. 不允许出现真实个人信息
11. 约 30% 反馈应超过 40 字

内部工具场景分布：
- 系统效率：约 25 条
- 成本降本：约 20 条
- 员工使用：约 20 条
- 流程配置：约 18 条
- 系统稳定性：约 18 条
- 培训成本：约 15 条
- 集成打通：约 12 条
- 噪声/正向/无效：约 22 条`,
    normalizationSegments: `- 系统效率: seg-internal-efficiency
- 成本降本: seg-internal-cost
- 员工使用: seg-internal-adoption
- 流程配置: seg-internal-config
- 系统稳定性: seg-internal-stability
- 培训成本: seg-internal-training
- 集成打通: seg-internal-integration
- 噪声: seg-noise
- 正向: seg-positive
- 未知: seg-unknown`,
  },

  "ecommerce-conversion": {
    name: "ecommerce-conversion",
    description: "下单转化率、支付失败、性能、推荐、促销、数据打通",
    productType: "ecommerce",
    businessGoal: "提升下单转化率 / 降低支付失败",
    themes: [
      { segment: "seg-ecommerce-checkout", segmentName: "下单流程问题", businessGoal: "提升下单成功率", weight: 0.20 },
      { segment: "seg-ecommerce-payment", segmentName: "支付失败问题", businessGoal: "降低支付失败率", weight: 0.15 },
      { segment: "seg-ecommerce-performance", segmentName: "性能与加载问题", businessGoal: "提升页面加载速度", weight: 0.12 },
      { segment: "seg-ecommerce-recommendation", segmentName: "推荐与搜索问题", businessGoal: "提升推荐准确性", weight: 0.12 },
      { segment: "seg-ecommerce-promotion", segmentName: "促销与优惠问题", businessGoal: "提升促销转化", weight: 0.12 },
      { segment: "seg-ecommerce-data", segmentName: "数据打通问题", businessGoal: "提升数据一致性", weight: 0.10 },
      { segment: "seg-ecommerce-mobile", segmentName: "移动端体验问题", businessGoal: "提升移动端转化", weight: 0.08 },
    ],
    generationPrompt: `产品背景：电商平台的下单转化优化，包括支付、推荐、促销、性能等。

严格要求：
1. 不要包含标准答案字段
2. 数据必须混合多个电商转化相关问题类型
3. 数据必须混合多个来源：客服工单、用户反馈、运营数据、App评论、NPS、竞品分析
4. 包含短句反馈（5-15字）
5. 包含转述反馈
6. 必须包含 5-8 条重复或近似重复反馈
7. 包含噪声反馈
8. 包含口语表达
9. 包含少量正向反馈（约 5-8 条）
10. 不允许出现真实个人信息
11. 约 30% 反馈应超过 40 字

电商转化场景分布：
- 下单流程：约 25 条
- 支付失败：约 20 条
- 性能加载：约 18 条
- 推荐搜索：约 18 条
- 促销优惠：约 18 条
- 数据打通：约 15 条
- 移动端：约 12 条
- 噪声/正向/无效：约 24 条`,
    normalizationSegments: `- 下单流程: seg-ecommerce-checkout
- 支付失败: seg-ecommerce-payment
- 性能加载: seg-ecommerce-performance
- 推荐搜索: seg-ecommerce-recommendation
- 促销优惠: seg-ecommerce-promotion
- 数据打通: seg-ecommerce-data
- 移动端: seg-ecommerce-mobile
- 噪声: seg-noise
- 正向: seg-positive
- 未知: seg-unknown`,
  },

  "bi-dashboard-renewal": {
    name: "bi-dashboard-renewal",
    description: "报表导出、数据准确性、仪表盘配置、性能、续费价值感知",
    productType: "BI-dashboard",
    businessGoal: "提升报表价值 / 降低续费流失",
    themes: [
      { segment: "seg-bi-export", segmentName: "报表导出问题", businessGoal: "提升导出可靠性", weight: 0.18 },
      { segment: "seg-bi-accuracy", segmentName: "数据准确性问题", businessGoal: "提升数据可信度", weight: 0.15 },
      { segment: "seg-bi-dashboard", segmentName: "仪表盘配置问题", businessGoal: "简化配置流程", weight: 0.15 },
      { segment: "seg-bi-performance", segmentName: "查询性能问题", businessGoal: "提升查询速度", weight: 0.12 },
      { segment: "seg-bi-value", segmentName: "续费价值感知", businessGoal: "提升价值感知", weight: 0.15 },
      { segment: "seg-bi-integration", segmentName: "数据源集成问题", businessGoal: "提升数据集成度", weight: 0.10 },
      { segment: "seg-bi-visualization", segmentName: "可视化与图表问题", businessGoal: "提升可视化能力", weight: 0.08 },
    ],
    generationPrompt: `产品背景：BI 数据分析/仪表盘产品，用于企业数据可视化和报表分析。

严格要求：
1. 不要包含标准答案字段
2. 数据必须混合多个 BI/报表相关问题类型
3. 数据必须混合多个来源：客服工单、数据分析师反馈、IT部门反馈、问卷、续费沟通记录
4. 包含短句反馈（5-15字）
5. 包含转述反馈
6. 必须包含 5-8 条重复或近似重复反馈
7. 包含噪声反馈
8. 包含口语表达
9. 包含少量正向反馈（约 5-8 条）
10. 不允许出现真实个人信息
11. 约 30% 反馈应超过 40 字

BI/报表场景分布：
- 报表导出：约 25 条
- 数据准确性：约 20 条
- 仪表盘配置：约 20 条
- 查询性能：约 18 条
- 续费价值：约 20 条
- 数据源集成：约 15 条
- 可视化图表：约 12 条
- 噪声/正向/无效：约 20 条`,
    normalizationSegments: `- 报表导出: seg-bi-export
- 数据准确性: seg-bi-accuracy
- 仪表盘配置: seg-bi-dashboard
- 查询性能: seg-bi-performance
- 续费价值: seg-bi-value
- 数据源集成: seg-bi-integration
- 可视化图表: seg-bi-visualization
- 噪声: seg-noise
- 正向: seg-positive
- 未知: seg-unknown`,
  },
};

// ── Shared Types & Functions ─────────────────────────────────────

interface RawFeedbackItem {
  raw_id: string;
  source: string;
  raw_text: string;
}

interface NormalizedFeedback {
  feedback_id: string;
  raw_id: string;
  raw_index: number;
  raw_content: string;
  raw_content_type: string;
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

function parseArgs() {
  const args = process.argv.slice(2);
  let scenario = "";
  let variant = "v1";
  let count = 150;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--scenario" && args[i + 1]) scenario = args[++i];
    if (args[i] === "--variant" && args[i + 1]) variant = args[++i];
    if (args[i] === "--count" && args[i + 1]) count = parseInt(args[++i], 10);
  }

  if (!scenario || !SCENARIOS[scenario]) {
    console.error(`Usage: tsx scripts/generate-scenario-baseline.ts --scenario <${Object.keys(SCENARIOS).join("|")}> [--variant v1] [--count 150]`);
    process.exit(1);
  }

  return { scenario, variant, count };
}

async function callAI(apiKey: string, baseUrl: string, model: string, system: string, user: string, temperature = 0.9): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature }),
  });
  if (!response.ok) throw new Error(`AI API error: ${response.status} - ${await response.text()}`);
  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

function parseJsonArray(content: string): any[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found");
  let jsonStr = jsonMatch[0].replace(/[""]/g, '"').replace(/['']/g, "'");
  try { return JSON.parse(jsonStr); } catch {
    jsonStr = jsonStr.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}').replace(/[\x00-\x1f]/g, ' ');
    try { return JSON.parse(jsonStr); } catch {
      const objStrs = jsonStr.split(/\}\s*,\s*\{/);
      if (objStrs.length > 1) {
        return objStrs.map((s, i) => {
          let obj = i === 0 ? s + '}' : i === objStrs.length - 1 ? '{' + s : '{' + s + '}';
          try { return JSON.parse(obj.replace(/,\s*}/g, '}')); } catch {
            const text = obj.match(/"raw_text"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] || '';
            const src = obj.match(/"source"\s*:\s*"([^"]*)"/)?.[1] || '';
            return text ? { raw_id: '', source: src, raw_text: text } : null;
          }
        }).filter(Boolean);
      }
      throw new Error("Cannot parse JSON");
    }
  }
}

function saveCSV(items: RawFeedbackItem[], filePath: string) {
  const header = "raw_id,source,raw_text";
  const rows = items.map(item => {
    let text = item.raw_text;
    if (text.includes(",") || text.includes('"') || text.includes("\n")) text = `"${text.replace(/"/g, '""')}"`;
    return `${item.raw_id},${item.source},${text}`;
  });
  fs.writeFileSync(filePath, [header, ...rows].join("\n"), "utf-8");
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const { scenario, variant, count } = parseArgs();
  const def = SCENARIOS[scenario];
  const caseName = `${scenario}-${variant}`;
  const dataset = scenario;
  const baselinePath = path.join(BASELINE_DIR, caseName);

  const apiKey = process.env.MIMO_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.MIMO_GENERATION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) { console.error("MIMO_API_KEY required"); process.exit(1); }

  console.log("=".repeat(60));
  console.log(`Generate Scenario Baseline: ${caseName}`);
  console.log(`  Scenario: ${def.description}`);
  console.log(`  Count: ${count}`);
  console.log("=".repeat(60));

  // Step 1: Generate raw CSV
  console.log("  Generating raw feedback...");
  const system = `你是一个真实用户反馈数据生成专家。${def.generationPrompt}`;
  const user = `请生成约 ${count} 条${def.description}相关原始用户反馈数据。

输出 JSON 数组，每条包含：
{ "raw_id": "RAW001", "source": "来源", "raw_text": "原始反馈内容" }

要求：raw_text 必须像真实用户说的话，口语化，包含各种长度和质量。
只输出 JSON 数组。`;

  let rawItems: RawFeedbackItem[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const content = await callAI(apiKey, baseUrl, model, system, user, 0.9);
      const items = parseJsonArray(content);
      rawItems = items.map((item: any, i: number) => ({
        raw_id: `RAW${String(i + 1).padStart(3, "0")}`,
        source: item.source || "未知来源",
        raw_text: item.raw_text || "",
      }));
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`  Attempt ${attempt} failed, retrying...`);
    }
  }
  console.log(`  Generated ${rawItems.length} raw items`);

  // Step 2: Normalize
  console.log("  Normalizing...");
  const normSystem = `你是一个用户反馈数据清洗和结构化专家。请将原始反馈数据标准化。

输出要求：feedback_id, raw_id, raw_index, raw_content, raw_content_type, cleaned_content, detected_source, detected_user_type, detected_problem_type, detected_theme, detected_product_type, detected_business_goal, detected_segment_id, confidence, unknown_reason

Segment ID 规则：
${def.normalizationSegments}`;

  const allNormalized: NormalizedFeedback[] = [];
  const batchSize = 30;
  for (let i = 0; i < rawItems.length; i += batchSize) {
    const batch = rawItems.slice(i, i + batchSize);
    const batchUser = `请标准化以下原始反馈数据：\n\n${JSON.stringify(batch, null, 2)}\n\n输出 JSON 数组。`;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const content = await callAI(apiKey, baseUrl, model, normSystem, batchUser, 0.1);
        const items = parseJsonArray(content);
        const fixed = items.map((item: any, j: number) => ({
          ...item,
          feedback_id: `FB${allNormalized.length + j + 1}`,
          raw_id: batch[j]?.raw_id || item.raw_id,
          raw_index: allNormalized.length + j + 1,
          raw_content: batch[j]?.raw_text || item.raw_content,
          detected_product_type: item.detected_product_type || def.productType,
          detected_business_goal: item.detected_business_goal || def.businessGoal,
        }));
        allNormalized.push(...fixed);
        console.log(`    Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawItems.length / batchSize)} done`);
        break;
      } catch (error) {
        if (attempt === 3) throw error;
        console.log(`    Batch retry ${attempt}/3...`);
      }
    }
  }
  console.log(`  Normalized ${allNormalized.length} items`);

  // Step 3: Generate segments
  const segmentMap = new Map<string, NormalizedFeedback[]>();
  for (const item of allNormalized) {
    const segId = item.detected_segment_id || "seg-unknown";
    if (!segmentMap.has(segId)) segmentMap.set(segId, []);
    segmentMap.get(segId)!.push(item);
  }

  const segments: any[] = [];
  for (const [segId, items] of segmentMap) {
    const themes = new Set<string>();
    for (const item of items) {
      if (item.detected_theme && item.detected_theme !== "unknown") themes.add(item.detected_theme);
    }
    const themeDef = def.themes.find(t => t.segment === segId);
    const isNoise = segId === "seg-noise";
    const isUnknown = segId === "seg-unknown";
    const isPositive = segId === "seg-positive";
    segments.push({
      segment_id: segId,
      segment_type: isNoise ? "noise" : isUnknown ? "unknown" : isPositive ? "positive" : "business",
      name: themeDef?.segmentName || (isNoise ? "噪声/无效反馈" : isUnknown ? "未分类反馈" : isPositive ? "正向反馈汇总" : segId),
      product_type: def.productType,
      business_goal: themeDef?.businessGoal || "unknown",
      feedback_count: items.length,
      feedback_ids: items.map(i => i.feedback_id),
      main_themes: Array.from(themes).slice(0, 5),
    });
  }

  const segmentsData = {
    dataset,
    is_mixed_dataset: segments.filter(s => s.segment_type === "business").length > 1,
    segment_count: segments.length,
    business_segment_count: segments.filter(s => s.segment_type === "business").length,
    noise_segment_count: segments.filter(s => s.segment_type === "noise").length,
    positive_segment_count: segments.filter(s => s.segment_type === "positive").length,
    segments,
  };
  console.log(`  Generated ${segmentsData.segment_count} segments (${segmentsData.business_segment_count} business)`);

  // Step 4: Generate clusters
  console.log("  Generating clusters...");
  const allClusters: any[] = [];

  for (const segment of segments) {
    const segItems = allNormalized.filter(i => i.detected_segment_id === segment.segment_id);
    if (segItems.length === 0) continue;

    if (segment.segment_type !== "business") {
      allClusters.push({
        cluster_id: `${segment.segment_id}-cluster-001`,
        segment_id: segment.segment_id,
        name: segment.segment_type === "noise" ? "无效/噪声反馈" : segment.segment_type === "positive" ? "正向反馈汇总" : "未分类反馈",
        summary: `${segment.name}相关反馈`,
        feedback_count: segItems.length,
        evidence_feedback_ids: segItems.map(i => i.feedback_id),
        secondary_themes: [], possible_metrics: [],
        priority: "P3", opportunity_score: 0,
        recommendation: segment.segment_type === "noise" ? "不进入核心问题排序。" : segment.segment_type === "positive" ? "保留为产品亮点参考。" : "需要人工复核。",
      });
      continue;
    }

    // Business segment: generate clusters via AI
    const feedbackList = segItems.map(item => `ID: ${item.feedback_id}\n内容: ${item.cleaned_content}\n主题: ${item.detected_theme}`).join("\n---\n");
    const clusterUser = `分组：${segment.name}
产品类型：${segment.product_type}
业务目标：${segment.business_goal}
反馈数量：${segItems.length}

反馈数据：
${feedbackList}

请生成问题聚类，输出 JSON 数组：
[{
  "cluster_id": "${segment.segment_id}-cluster-001",
  "segment_id": "${segment.segment_id}",
  "name": "具体问题名称",
  "summary": "问题摘要",
  "feedback_count": 5,
  "evidence_feedback_ids": ["FB1", "FB2", "FB3"],
  "secondary_themes": [],
  "possible_metrics": ["指标1"],
  "priority": "P0",
  "opportunity_score": 85,
  "recommendation": "具体可操作建议"
}]

只输出 JSON 数组，不要输出其他内容。`;

    let clusters: any[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const content = await callAI(apiKey, baseUrl, model,
          `你是一个产品分析专家。请基于反馈数据生成问题聚类。

要求：
1. 每个 cluster 必须有 evidence_feedback_ids，必须真实存在于输入数据中
2. 每个 cluster 至少 2 条证据
3. priority 必须根据反馈数量合理分配：feedback_count >= 8 为 P0，5-7 为 P1，< 5 为 P2
4. opportunity_score 必须根据反馈数量和影响程度差异化（范围 40-90），不能全部相同
5. recommendation 必须针对具体问题给出可操作建议，不能是"需要进一步分析"
6. name 和 summary 必须描述具体问题，不能是"问题 1"这样的占位符
7. 不要编造不存在的数据
8. cluster_id 格式: ${segment.segment_id}-cluster-{NNN}`,
          clusterUser, 0.3);
        clusters = parseJsonArray(content);
        break;
      } catch {
        if (attempt === 3) {
          clusters = [{ cluster_id: `${segment.segment_id}-cluster-001`, name: `${segment.name}主要问题`, summary: `${segment.name}相关反馈汇总`, feedback_count: segItems.length, evidence_feedback_ids: segItems.slice(0, 3).map(i => i.feedback_id) }];
        }
      }
    }

    // Fix clusters
    const validIds = new Set(segItems.map(it => it.feedback_id));
    const usedIds = new Set<string>();
    const fixedClusters = clusters.map((c: any, i: number) => {
      let evidenceIds = Array.isArray(c.evidence_feedback_ids) ? c.evidence_feedback_ids : [];
      // Normalize evidence IDs: uppercase, fix common typos (Fb→FB, FP→FB)
      evidenceIds = evidenceIds.map((id: string) => {
        let normalized = String(id).toUpperCase();
        if (/^FB\d+$/.test(normalized)) return normalized;
        // Try to extract number and rebuild
        const num = normalized.match(/\d+/);
        if (num) return `FB${num[0]}`;
        return normalized;
      });
      // Filter to only valid IDs
      evidenceIds = evidenceIds.filter((id: string) => validIds.has(id));
      const fc = c.feedback_count || evidenceIds.length || 0;
      // Deduplicate evidence
      evidenceIds = evidenceIds.filter((id: string) => !usedIds.has(id));
      const available = segItems.filter(it => !usedIds.has(it.feedback_id) && !evidenceIds.includes(it.feedback_id)).map(it => it.feedback_id);
      while (evidenceIds.length < fc && available.length > 0) evidenceIds.push(available.shift()!);
      for (const id of evidenceIds) usedIds.add(id);
      // Cap feedback_count to actual evidence length (handles AI overcounting after dedup)
      const actualCount = evidenceIds.length;
      let priority = c.priority || "P2";
      if (actualCount < 5 && priority === "P0") priority = "P1";
      return {
        cluster_id: c.cluster_id || `${segment.segment_id}-cluster-${String(i + 1).padStart(3, "0")}`,
        segment_id: segment.segment_id,
        name: c.name || `问题 ${i + 1}`,
        summary: c.summary || c.name || `问题 ${i + 1}`,
        feedback_count: actualCount,
        evidence_feedback_ids: evidenceIds,
        secondary_themes: Array.isArray(c.secondary_themes) ? c.secondary_themes : [],
        possible_metrics: Array.isArray(c.possible_metrics) ? c.possible_metrics : [],
        priority,
        opportunity_score: c.opportunity_score || 50,
        recommendation: c.recommendation || "需要进一步分析。",
      };
    });

    // Closure fix: add unused feedback IDs as evidence to largest cluster
    const clusterSum = fixedClusters.reduce((s, c) => s + c.feedback_count, 0);
    if (clusterSum < segItems.length && fixedClusters.length > 0) {
      const unusedIds = segItems.filter(it => !usedIds.has(it.feedback_id)).map(it => it.feedback_id);
      const largest = fixedClusters.sort((a, b) => b.feedback_count - a.feedback_count)[0];
      const deficit = segItems.length - clusterSum;
      const toAdd = unusedIds.slice(0, deficit);
      largest.evidence_feedback_ids.push(...toAdd);
      largest.feedback_count = largest.evidence_feedback_ids.length;
      for (const id of toAdd) usedIds.add(id);
    }
    allClusters.push(...fixedClusters);
  }
  console.log(`  Generated ${allClusters.length} clusters`);

  // Step 5: Build analysis JSONs
  const overallJson = {
    project_id: "", analysis_run_id: "",
    summary: {
      total_feedback_count: allNormalized.length,
      analyzed_feedback_count: allNormalized.length,
      clustered_feedback_count: allNormalized.length,
      unclustered_feedback_count: 0, unanalyzed_feedback_count: 0,
      segment_count: segmentsData.segment_count,
      business_segment_count: segmentsData.business_segment_count,
      noise_segment_count: segmentsData.noise_segment_count,
      positive_segment_count: segmentsData.positive_segment_count,
      cluster_count: allClusters.length,
      is_mixed_dataset: segmentsData.is_mixed_dataset,
    },
    segments: segments.map(seg => ({
      segment_id: seg.segment_id, name: seg.name, feedback_count: seg.feedback_count,
      business_goal: seg.business_goal,
      issue_cluster_ids: allClusters.filter(c => c.segment_id === seg.segment_id).map(c => c.cluster_id),
    })),
    issue_clusters: allClusters,
    report_path: "",
  };

  const segmentsJson = {
    dataset, is_mixed_dataset: segmentsData.is_mixed_dataset,
    segment_count: segmentsData.segment_count,
    business_segment_count: segmentsData.business_segment_count,
    noise_segment_count: segmentsData.noise_segment_count,
    positive_segment_count: segmentsData.positive_segment_count,
    segments,
  };

  // Step 6: Save to baseline (clean first to remove stale files)
  if (fs.existsSync(baselinePath)) {
    fs.rmSync(baselinePath, { recursive: true, force: true });
  }
  const inputDir = path.join(baselinePath, "input");
  const normalizedDir = path.join(baselinePath, "normalized");
  const analysisDir = path.join(baselinePath, "analysis");
  const segDir = path.join(analysisDir, dataset, "segments");
  ensureDir(inputDir);
  ensureDir(normalizedDir);
  ensureDir(segDir);

  saveCSV(rawItems, path.join(inputDir, `${dataset}.csv`));
  fs.writeFileSync(path.join(normalizedDir, `${dataset}.normalized.json`), JSON.stringify(allNormalized, null, 2), "utf-8");
  fs.writeFileSync(path.join(analysisDir, `${dataset}.segments.json`), JSON.stringify(segmentsJson, null, 2), "utf-8");
  fs.writeFileSync(path.join(analysisDir, `${dataset}.overall.analysis.json`), JSON.stringify(overallJson, null, 2), "utf-8");

  for (const segment of segments) {
    const segClusters = allClusters.filter(c => c.segment_id === segment.segment_id);
    const segItems = allNormalized.filter(i => i.detected_segment_id === segment.segment_id);
    fs.writeFileSync(path.join(segDir, `${segment.segment_id}.analysis.json`), JSON.stringify({
      segment_id: segment.segment_id, segment_type: segment.segment_type,
      summary: { feedback_count: segItems.length, cluster_count: segClusters.length, clustered_feedback_count: segItems.length, unclustered_feedback_count: 0 },
      issue_clusters: segClusters,
    }, null, 2), "utf-8");
  }

  console.log(`  Saved: ${Object.keys(allClusters).length} segment JSONs`);
  console.log("");
  console.log("=".repeat(60));
  console.log(`Baseline created: ${baselinePath}`);
  console.log(`  Raw: ${rawItems.length} | Normalized: ${allNormalized.length} | Segments: ${segmentsData.segment_count} | Clusters: ${allClusters.length}`);
  console.log("");
  console.log(`Next: npx tsx scripts/run-pipeline.ts --case ${caseName} --count ${rawItems.length} --baseline ${caseName} --dataset ${dataset} --stage hard`);
  console.log("=".repeat(60));
}

main().catch(error => { console.error("Failed:", error); process.exit(1); });
