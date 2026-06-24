/**
 * 清洗和结构化反馈数据
 * 运行: pnpm normalize:feedback
 *
 * 新增 raw_content_type 分类：
 * - feedback: 普通用户反馈
 * - metric_note: 运营记录中的指标数据
 * - hypothesis: 带推测性表述（"可能"、"也许"、"应该是"）
 * - noise: 无效/噪声反馈
 * - positive: 正向反馈
 *
 * 人名匿名化：李总→某客户负责人, 王经理→某部门经理 等
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const RAW_INPUTS_DIR = path.join(__dirname, "..", "fixtures", "raw-inputs");
const NORMALIZED_DIR = path.join(__dirname, "..", "fixtures", "normalized");

interface RawFeedbackItem {
  raw_id: string;
  source: string;
  raw_text: string;
}

export interface NormalizedFeedback {
  feedback_id: string;
  raw_id: string;
  raw_index: number;
  raw_content: string;
  raw_content_type: "feedback" | "metric_note" | "hypothesis" | "noise" | "positive";
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

/**
 * 人名匿名化映射
 */
function anonymizeNames(text: string): string {
  const namePatterns: [RegExp, string][] = [
    [/李总/g, "某客户负责人"],
    [/王总/g, "某客户负责人"],
    [/赵总/g, "某客户负责人"],
    [/刘总/g, "某客户负责人"],
    [/张总/g, "某客户负责人"],
    [/陈总/g, "某客户负责人"],
    [/周总/g, "某客户负责人"],
    [/吴总/g, "某客户负责人"],
    [/王经理/g, "某部门经理"],
    [/李经理/g, "某部门经理"],
    [/赵经理/g, "某部门经理"],
    [/刘经理/g, "某部门经理"],
    [/张经理/g, "某部门经理"],
    [/刘总监/g, "某部门总监"],
    [/王总监/g, "某部门总监"],
    [/李总监/g, "某部门总监"],
    [/张总监/g, "某部门总监"],
    [/小王/g, "某员工"],
    [/小李/g, "某员工"],
    [/小张/g, "某员工"],
    [/小刘/g, "某员工"],
  ];

  let result = text;
  for (const [pattern, replacement] of namePatterns) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * 清洗和结构化反馈数据
 */
export async function normalizeFeedback(): Promise<number> {
  let apiKey = process.env.MIMO_API_KEY || process.env.OPENAI_API_KEY;
  let baseUrl = process.env.MIMO_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  let model = process.env.MIMO_GENERATION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  // Fall back to DeepSeek if MiMo unavailable
  if (apiKey && baseUrl.includes("xiaomimimo")) {
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
    throw new Error("No AI API key available");
  }

  // Read raw input
  const csvPath = path.join(RAW_INPUTS_DIR, "mixed-feedback.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error("Raw input not found. Run generate:raw-feedback first.");
  }

  const rawItems = parseRawCsv(csvPath);
  console.log(`  Read ${rawItems.length} raw feedback items`);

  // Normalize feedback
  const normalizedItems = await normalizeFeedbackWithAI(apiKey, baseUrl, model, rawItems);

  // Save normalized feedback
  fs.mkdirSync(NORMALIZED_DIR, { recursive: true });
  const jsonPath = path.join(NORMALIZED_DIR, "mixed-feedback.normalized.json");
  fs.writeFileSync(jsonPath, JSON.stringify(normalizedItems, null, 2), "utf-8");

  console.log(`  ✅ Normalized ${normalizedItems.length} feedback items`);

  // Print content type distribution
  const typeCounts: Record<string, number> = {};
  for (const item of normalizedItems) {
    typeCounts[item.raw_content_type] = (typeCounts[item.raw_content_type] || 0) + 1;
  }
  console.log(`  📊 Content types: ${Object.entries(typeCounts).map(([k, v]) => `${k}:${v}`).join(", ")}`);

  return normalizedItems.length;
}

function parseRawCsv(filePath: string): RawFeedbackItem[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const items: RawFeedbackItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= 3) {
      items.push({
        raw_id: values[0],
        source: values[1],
        raw_text: anonymizeNames(values[2]),
      });
    }
  }
  return items;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

async function normalizeFeedbackWithAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  rawItems: RawFeedbackItem[]
): Promise<NormalizedFeedback[]> {
  const BATCH_SIZE = 20;
  const results: NormalizedFeedback[] = [];

  for (let i = 0; i < rawItems.length; i += BATCH_SIZE) {
    const batch = rawItems.slice(i, i + BATCH_SIZE);
    console.log(`  Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rawItems.length / BATCH_SIZE)}...`);

    const batchResults = await normalizeBatch(apiKey, baseUrl, model, batch, i);
    results.push(...batchResults);
  }

  return results;
}

async function normalizeBatch(
  apiKey: string,
  baseUrl: string,
  model: string,
  batch: RawFeedbackItem[],
  startIndex: number
): Promise<NormalizedFeedback[]> {
  const system = `你是一个反馈数据清洗专家。请将原始用户反馈转换为结构化数据。

核心规则：
1. 保留原始内容 raw_content
2. 生成清洗后内容 cleaned_content（不改变原意）
3. 识别内容类型 raw_content_type（见下方分类）
4. 人名已匿名化，不需要再处理

raw_content_type 分类（必须精确判断）：
- feedback: 普通用户反馈、问题描述、功能建议
- metric_note: 运营记录中的具体指标数据（如"点击率很高"、"转化率掉了"、"月活下降"）。注意：不要把含有指标的反馈扩大成全量结论
- hypothesis: 带推测性表述的反馈（如"可能页面加载问题"、"应该是网络原因"、"感觉像是权限问题"）。这些是推测，不是确认的事实
- noise: 无效内容、乱码、纯情绪表达、无意义文本
- positive: 正向反馈、表扬、满意表达

detected_problem_type 可选：
- 体验问题
- 功能需求
- 性能问题
- 价格问题
- 数据问题
- 权限问题
- 集成问题
- AI幻觉
- 支付问题
- 客服问题
- 噪声
- 正向反馈
- unknown

detected_segment_id 分配规则（必须严格执行，不允许随意使用 seg-unknown）：

seg-b2b-renewal（B端续费相关）：
- 续费价格、续费流程、续费提醒、合同条款、续约犹豫、降价需求
- 关键词：续费、价格、合同、续约、折扣、降本

seg-b2b-activation（B端激活相关）：
- 注册、登录、邀请、初始设置、新手引导、激活流程、权限配置
- 关键词：注册、登录、激活、邀请码、初始、上手、权限

seg-ai-experience（AI产品体验）：
- AI功能体验、AI准确性、AI响应、AI学习曲线、AI自动化
- 关键词：AI、智能、自动、识别、生成、对话

seg-bi-renewal（BI工具续费）：
- 报表、数据可视化、BI工具、数据导出、图表、仪表盘
- 关键词：报表、图表、BI、数据、导出、可视化

seg-ecommerce-conversion（电商转化）：
- 下单、支付、购物车、转化率、结算、优惠券、促销
- 关键词：下单、支付、购物车、转化、结算、优惠、促销

seg-internal-cost（内部系统降本）：
- 内部系统、报销、OA、HR系统、内部工具、效率、成本
- 关键词：内部、报销、OA、HR、系统、效率、成本

seg-noise（噪声/无效）：
- 乱码、无意义、纯情绪、无关内容
- 只有当 raw_content_type = noise 时才使用

seg-positive（正向反馈）：
- 表扬、满意、好评、功能好用
- 只有当 raw_content_type = positive 时才使用

seg-unknown（无法判断）：
- 仅当反馈确实无法归类到任何上述分组时使用
- seg-unknown 比例不应超过 10%
- 如果能识别出任何业务问题，必须归类到对应 segment

重要：
- 正向反馈（positive）必须标记为 seg-positive，不要放入 seg-noise
- 噪声反馈（noise）放入 seg-noise
- 运营指标数据（metric_note）标记类型但不要扩大结论
- 推测性表述（hypothesis）标记类型，detected_problem_type 用"体验问题"或"性能问题"
- 绝大多数反馈都应该能归类到业务 segment，seg-unknown 应该很少`;

  const rawItemsStr = batch.map((item, i) =>
    `${i + 1}. [${item.source}] ${item.raw_text}`
  ).join("\n");

  const user = `请清洗以下原始反馈数据：

${rawItemsStr}

输出 JSON 数组，每条包含：
{
  "feedback_id": "FB${startIndex + 1}",
  "raw_id": "${batch[0].raw_id}",
  "raw_index": ${startIndex + 1},
  "raw_content": "原始内容",
  "raw_content_type": "feedback/metric_note/hypothesis/noise/positive",
  "cleaned_content": "清洗后内容",
  "detected_source": "识别的来源",
  "detected_user_type": "识别的用户类型",
  "detected_problem_type": "问题类型",
  "detected_theme": "识别的主题",
  "detected_product_type": "产品类型",
  "detected_business_goal": "业务目标",
  "detected_segment_id": "分组ID",
  "confidence": 0.85,
  "unknown_reason": null
}

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
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "";

  // Extract JSON
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }

  let jsonStr = jsonMatch[0]
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");

  let items: any[];
  try {
    items = JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON parse error, attempting to fix...");
    jsonStr = jsonStr
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    try {
      items = JSON.parse(jsonStr);
    } catch (e2) {
      // Generate default items
      items = batch.map((item, i) => ({
        feedback_id: `FB${startIndex + i + 1}`,
        raw_id: item.raw_id,
        raw_index: startIndex + i + 1,
        raw_content: item.raw_text,
        raw_content_type: "feedback",
        cleaned_content: item.raw_text,
        detected_source: item.source,
        detected_user_type: "unknown",
        detected_problem_type: "unknown",
        detected_theme: "unknown",
        detected_product_type: "unknown",
        detected_business_goal: "unknown",
        detected_segment_id: "seg-unknown",
        confidence: 0.3,
        unknown_reason: "AI 解析失败",
      }));
    }
  }

  // Ensure items have correct IDs and required fields
  return items.map((item: any, i: number) => ({
    ...item,
    feedback_id: `FB${startIndex + i + 1}`,
    raw_id: batch[i]?.raw_id || `RAW${startIndex + i + 1}`,
    raw_index: startIndex + i + 1,
    raw_content: batch[i]?.raw_text || item.raw_content,
    raw_content_type: item.raw_content_type || "feedback",
    cleaned_content: item.cleaned_content || item.raw_content || batch[i]?.raw_text || "",
    detected_segment_id: item.detected_segment_id || "seg-unknown",
    confidence: item.confidence ?? 0.5,
  }));
}

// CLI entry point
if (require.main === module) {
  normalizeFeedback()
    .then((count) => console.log(`Normalized ${count} feedback items`))
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}
