/**
 * 小米模型生成真实用户原始反馈数据
 * 运行: pnpm generate:raw-feedback
 *
 * 生成的数据像真实用户上传的混合反馈，不包含标准答案字段
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const RAW_INPUTS_DIR = path.join(__dirname, "..", "fixtures", "raw-inputs");

/**
 * 生成原始反馈数据
 */
export async function generateRawFeedback(): Promise<number> {
  const apiKey = process.env.MIMO_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.MIMO_GENERATION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("MIMO_API_KEY or OPENAI_API_KEY is required");
  }

  console.log("  Generating raw feedback data...");

  const feedbackItems = await generateRawFeedbackWithAI(apiKey, baseUrl, model);

  // Post-process: inject near-duplicate feedback if AI didn't generate enough
  const allTexts = new Set(feedbackItems.map(item => item.raw_text));
  const duplicateCandidates = [
    { source: "客服工单", text: "太慢了，点一下等半天" },
    { source: "微信群", text: "系统太慢了" },
    { source: "App评论", text: "加载好慢啊" },
    { source: "客服工单", text: "续费太贵了" },
    { source: "销售转述", text: "客户觉得价格太高" },
    { source: "问卷", text: "续费有点贵" },
    { source: "客服工单", text: "导出格式乱了" },
    { source: "运营记录", text: "导出来格式全乱了" },
    { source: "用户访谈", text: "报表导出格式有问题" },
  ];

  let injectIdx = feedbackItems.length;
  for (const candidate of duplicateCandidates) {
    // Only inject if similar text doesn't already exist
    const isDuplicate = [...allTexts].some(t =>
      t.includes(candidate.text.substring(0, 6)) || candidate.text.includes(t.substring(0, 6))
    );
    if (!isDuplicate) {
      injectIdx++;
      feedbackItems.push({
        raw_id: `RAW${String(injectIdx).padStart(3, "0")}`,
        source: candidate.source,
        raw_text: candidate.text,
      });
    }
  }

  // Save as CSV
  fs.mkdirSync(RAW_INPUTS_DIR, { recursive: true });
  const csvPath = path.join(RAW_INPUTS_DIR, "mixed-feedback.csv");

  const header = "raw_id,source,raw_text";
  const rows = feedbackItems.map((item) => {
    let text = item.raw_text;
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      text = `"${text.replace(/"/g, '""')}"`;
    }
    return `${item.raw_id},${item.source},${text}`;
  });

  fs.writeFileSync(csvPath, [header, ...rows].join("\n"), "utf-8");

  // Also save as TXT
  const txtPath = path.join(RAW_INPUTS_DIR, "mixed-feedback.txt");
  const txtContent = feedbackItems.map((item) => `[${item.source}] ${item.raw_text}`).join("\n\n");
  fs.writeFileSync(txtPath, txtContent, "utf-8");

  // Also save as MD
  const mdPath = path.join(RAW_INPUTS_DIR, "mixed-feedback.md");
  const mdContent = feedbackItems.map((item) =>
    `- **[${item.source}]** ${item.raw_text}`
  ).join("\n");
  fs.writeFileSync(mdPath, `# 原始用户反馈数据\n\n共 ${feedbackItems.length} 条\n\n${mdContent}`, "utf-8");

  console.log(`  ✅ Generated ${feedbackItems.length} raw feedback items`);
  return feedbackItems.length;
}

interface RawFeedbackItem {
  raw_id: string;
  source: string;
  raw_text: string;
}

async function generateRawFeedbackWithAI(
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<RawFeedbackItem[]> {
  const system = `你是一个真实用户反馈数据生成专家。请生成像真实用户上传的原始反馈数据。

严格要求：
1. 不要包含 expected_theme、product_type、business_goal 等标准答案字段
2. 数据必须混合多个问题类型
3. 数据必须混合多个来源（客服工单、销售转述、微信群、用户访谈、问卷/App评论）
4. 包含短句反馈（5-10字）
5. 包含转述反馈（"销售说客户觉得..."）
6. 必须包含 8-10 条重复或近似重复反馈（同一件事不同人说，或同一人反复说）
7. 包含噪声反馈（无关、情绪化、无意义）
8. 包含多问题反馈（一条反馈提到多个问题）
9. 包含语义不完整反馈
10. 包含口语表达、错别字
11. 包含少量正向反馈
12. 不允许出现真实手机号、邮箱、身份证、真实公司名、真实个人名

重复反馈示例（必须包含类似这样的重复）：
- "太慢了" 和 "系统太慢了" 和 "加载好慢"
- "续费太贵" 和 "价格太高了" 和 "续费有点贵"
- "导出格式乱" 和 "导出来格式全乱了"

隐含分布（不要写在数据里）：
- B端 SaaS 续费相关：约 20 条
- B端 SaaS 激活相关：约 20 条
- AI 产品体验相关：约 20 条
- BI / 数据工具续费相关：约 20 条
- 电商转化相关：约 15 条
- 内部系统降本相关：约 15 条
- 噪声 / 正向 / 无效反馈：约 10 条`;

  const user = `请生成约 120 条原始用户反馈数据。

输出 JSON 数组，每条包含：
{
  "raw_id": "RAW001",
  "source": "来源（客服工单/销售转述/微信群/用户访谈/问卷/App评论/客户成功/老板转述/运营记录）",
  "raw_text": "原始反馈内容"
}

要求：
- raw_text 必须像真实用户说的话
- 不要太正式，要口语化
- 包含各种长度的反馈
- 包含各种质量的反馈
- 不要每条都完美

只输出 JSON 数组，不要输出其他内容。`;

  // Retry logic for JSON parse failures
  for (let attempt = 1; attempt <= 3; attempt++) {
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
          temperature: 0.9,
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

      // Clean up Chinese quotes
      let jsonStr = jsonMatch[0]
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'");

      let items: { raw_id: string; source: string; raw_text: string }[];
      try {
        items = JSON.parse(jsonStr);
      } catch (e) {
        console.error(`JSON parse error (attempt ${attempt}/3), attempting to fix...`);
        jsonStr = jsonStr
          .replace(/,\s*]/g, ']')
          .replace(/,\s*}/g, '}');
        try {
          items = JSON.parse(jsonStr);
        } catch (e2) {
          // Try to extract individual objects
          const objectMatches = jsonStr.match(/\{[^{}]*\}/g);
          if (objectMatches) {
            items = objectMatches.map((m: string) => JSON.parse(m));
          } else if (attempt < 3) {
            console.log(`  Retrying (attempt ${attempt + 1}/3)...`);
            continue;
          } else {
            throw new Error("Failed to parse JSON even after fixes");
          }
        }
      }

      // Ensure raw_ids are sequential
      return items.map((item, i) => ({
        raw_id: `RAW${String(i + 1).padStart(3, "0")}`,
        source: item.source || "未知来源",
        raw_text: item.raw_text || "",
      }));
    } catch (error) {
      if (attempt === 3) throw error;
      console.log(`  Attempt ${attempt} failed, retrying...`);
    }
  }

  throw new Error("Failed to generate raw feedback after 3 attempts");
}

// CLI entry point
if (require.main === module) {
  generateRawFeedback()
    .then((count) => console.log(`Generated ${count} raw feedback items`))
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}
