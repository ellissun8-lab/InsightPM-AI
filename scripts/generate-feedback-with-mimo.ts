/**
 * 小米模型生成测试反馈数据
 * 运行: pnpm generate:feedback
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "feedback");

// Dataset configurations
const DATASET_CONFIGS: Record<string, {
  product_name: string;
  product_type: string;
  business_goal: string;
  target_user: string;
  themes: string[];
}> = {
  "b2b-saas-renewal": {
    product_name: "CloudCRM 企业版",
    product_type: "B端 SaaS",
    business_goal: "提升续费",
    target_user: "企业销售管理者",
    themes: ["权限配置复杂", "数据准确性不足", "报表导出困难", "系统集成需求", "性能稳定性问题", "价格套餐不清晰", "客户成功支持不足"],
  },
  "b2b-saas-activation": {
    product_name: "项目管理工具 Pro",
    product_type: "B端 SaaS",
    business_goal: "提升激活",
    target_user: "项目经理和团队成员",
    themes: ["新手引导不清晰", "首次配置复杂", "示例数据缺失", "关键功能找不到", "登录注册问题", "术语理解困难"],
  },
  "ai-product-experience": {
    product_name: "AI 写作助手",
    product_type: "C端产品",
    business_goal: "改善体验",
    target_user: "内容创作者和营销人员",
    themes: ["AI 幻觉", "回复不稳定", "响应速度慢", "结果不可解释", "缺少原始证据", "提示词门槛高"],
  },
  "ecommerce-conversion": {
    product_name: "优选商城",
    product_type: "电商",
    business_goal: "提升转化",
    target_user: "C端消费者",
    themes: ["商品页信息不清晰", "优惠规则复杂", "支付失败", "物流费用不透明", "搜索结果不准确", "购物车体验差"],
  },
  "bi-tool-renewal": {
    product_name: "数据洞察 BI 平台",
    product_type: "B端 SaaS",
    business_goal: "提升续费",
    target_user: "数据分析师和业务决策者",
    themes: ["数据口径不一致", "报表加载慢", "导出格式混乱", "权限配置复杂", "自动报告不稳定", "数据刷新不及时"],
  },
  "internal-system-cost": {
    product_name: "内部 OA 系统",
    product_type: "B端 SaaS",
    business_goal: "降低成本",
    target_user: "全体员工和 HR",
    themes: ["审批流程复杂", "重复录入", "权限申请慢", "数据导入麻烦", "人工核对成本高", "通知不及时"],
  },
};

/**
 * 使用小米模型生成反馈数据
 */
export async function generateFeedbackWithMimo(dataset: string): Promise<number> {
  const config = DATASET_CONFIGS[dataset];
  if (!config) {
    throw new Error(`Unknown dataset: ${dataset}`);
  }

  const apiKey = process.env.MIMO_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.MIMO_GENERATION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("MIMO_API_KEY or OPENAI_API_KEY is required");
  }

  // Generate feedback using AI
  const feedbackItems = await generateFeedbackWithAI(
    apiKey,
    baseUrl,
    model,
    config,
    120,
    dataset
  );

  // Save to CSV
  const csvPath = path.join(FIXTURES_DIR, `${dataset}.csv`);
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  const header = "feedback_id,content,product_type,business_goal,user_type,source,created_at,expected_theme";
  const rows = feedbackItems.map((item) => {
    let content = item.content;
    if (content.includes(",") || content.includes('"') || content.includes("\n")) {
      content = `"${content.replace(/"/g, '""')}"`;
    }
    return `${item.feedback_id},${content},${item.product_type},${item.business_goal},${item.user_type},${item.source},${item.created_at},${item.expected_theme}`;
  });

  fs.writeFileSync(csvPath, [header, ...rows].join("\n"), "utf-8");

  return feedbackItems.length;
}

interface FeedbackItem {
  feedback_id: string;
  content: string;
  product_type: string;
  business_goal: string;
  user_type: string;
  source: string;
  created_at: string;
  expected_theme: string;
}

async function generateFeedbackWithAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  config: typeof DATASET_CONFIGS[string],
  count: number,
  dataset: string
): Promise<FeedbackItem[]> {
  const system = `你是一个用户反馈生成专家。请生成像真实用户写的反馈数据。

要求：
1. 每条反馈像真实用户说的话，不要太正式
2. 包含口语化表达、情绪化表达
3. 不要出现真实个人信息、公司名、手机号
4. 每条反馈对应一个明确的主题
5. 输出 JSON 数组`;

  const user = `产品信息：
- 产品名称：${config.product_name}
- 产品类型：${config.product_type}
- 业务目标：${config.business_goal}
- 目标用户：${config.target_user}

主题列表：
${config.themes.map((t, i) => `${i + 1}. ${t}`).join("\n")}

请生成 ${count} 条用户反馈，每条反馈包含：
{
  "content": "用户反馈内容",
  "user_type": "用户类型",
  "source": "来源（客服/问卷/访谈/App Store/销售反馈/社交媒体）",
  "expected_theme": "对应的主题"
}

要求：
- 每个主题大约 ${Math.floor(count / config.themes.length)} 条
- user_type 多样化
- source 多样化
- created_at 分布在最近 60 天

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
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "";

  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }

  // Clean up Chinese quotes only (don't escape newlines in JSON strings)
  let jsonStr = jsonMatch[0]
    .replace(/[""]/g, '"')  // Replace Chinese quotes
    .replace(/['']/g, "'"); // Replace Chinese single quotes

  let items: { content: string; user_type: string; source: string; expected_theme: string }[];
  try {
    items = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error("JSON parse error, attempting to fix...");
    // Try to fix common JSON issues
    jsonStr = jsonStr
      .replace(/,\s*]/g, ']')  // Remove trailing commas
      .replace(/,\s*}/g, '}');  // Remove trailing commas in objects
    try {
      items = JSON.parse(jsonStr);
    } catch (e) {
      // Last resort: try to extract individual JSON objects
      const objectMatches = jsonStr.match(/\{[^{}]*\}/g);
      if (objectMatches) {
        items = objectMatches.map((m: string) => JSON.parse(m));
      } else {
        throw new Error("Failed to parse JSON even after fixes");
      }
    }
  }

  // Add IDs and dates
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);

  return items.map((item, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + Math.floor(Math.random() * 60));

    return {
      feedback_id: `${dataset}-${String(i + 1).padStart(4, "0")}`,
      content: item.content,
      product_type: config.product_type,
      business_goal: config.business_goal,
      user_type: item.user_type,
      source: item.source,
      created_at: date.toISOString().split("T")[0],
      expected_theme: item.expected_theme,
    };
  });
}

// CLI entry point
if (require.main === module) {
  const dataset = process.argv[2];
  if (!dataset) {
    console.error("Usage: tsx generate-feedback-with-mimo.ts <dataset>");
    process.exit(1);
  }

  generateFeedbackWithMimo(dataset)
    .then((count) => console.log(`Generated ${count} feedback items for ${dataset}`))
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}
