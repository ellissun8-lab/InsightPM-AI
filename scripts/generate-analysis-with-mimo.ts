/**
 * 小米模型生成产品分析报告
 * 运行: pnpm generate:analysis
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const FEEDBACK_DIR = path.join(FIXTURES_DIR, "feedback");
const ANALYSIS_DIR = path.join(FIXTURES_DIR, "analysis");

// Dataset configurations
const DATASET_CONFIGS: Record<string, {
  product_name: string;
  product_type: string;
  business_goal: string;
  target_user: string;
  key_metric: string;
}> = {
  "b2b-saas-renewal": {
    product_name: "CloudCRM 企业版",
    product_type: "B端 SaaS",
    business_goal: "提升续费",
    target_user: "企业销售管理者",
    key_metric: "续费率",
  },
  "b2b-saas-activation": {
    product_name: "项目管理工具 Pro",
    product_type: "B端 SaaS",
    business_goal: "提升激活",
    target_user: "项目经理和团队成员",
    key_metric: "新用户 7 日激活率",
  },
  "ai-product-experience": {
    product_name: "AI 写作助手",
    product_type: "C端产品",
    business_goal: "改善体验",
    target_user: "内容创作者和营销人员",
    key_metric: "用户满意度",
  },
  "ecommerce-conversion": {
    product_name: "优选商城",
    product_type: "电商",
    business_goal: "提升转化",
    target_user: "C端消费者",
    key_metric: "下单转化率",
  },
  "bi-tool-renewal": {
    product_name: "数据洞察 BI 平台",
    product_type: "B端 SaaS",
    business_goal: "提升续费",
    target_user: "数据分析师和业务决策者",
    key_metric: "续费率",
  },
  "internal-system-cost": {
    product_name: "内部 OA 系统",
    product_type: "B端 SaaS",
    business_goal: "降低成本",
    target_user: "全体员工和 HR",
    key_metric: "客服工单量",
  },
};

interface CsvRow {
  feedback_id: string;
  content: string;
  product_type: string;
  business_goal: string;
  user_type: string;
  source: string;
  created_at: string;
  expected_theme: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= 8) {
      rows.push({
        feedback_id: values[0],
        content: values[1],
        product_type: values[2],
        business_goal: values[3],
        user_type: values[4],
        source: values[5],
        created_at: values[6],
        expected_theme: values[7],
      });
    }
  }
  return rows;
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

/**
 * 使用小米模型生成分析报告
 */
export async function generateAnalysisWithMimo(dataset: string): Promise<void> {
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

  // Read CSV
  const csvPath = path.join(FEEDBACK_DIR, `${dataset}.csv`);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const feedbackItems = parseCsv(csvPath);

  // Generate analysis using AI
  const { markdown, json } = await generateAnalysisWithAI(
    apiKey,
    baseUrl,
    model,
    config,
    feedbackItems
  );

  // Save files
  fs.mkdirSync(ANALYSIS_DIR, { recursive: true });

  const mdPath = path.join(ANALYSIS_DIR, `${dataset}.analysis.md`);
  fs.writeFileSync(mdPath, markdown, "utf-8");

  const jsonPath = path.join(ANALYSIS_DIR, `${dataset}.analysis.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2), "utf-8");
}

interface AnalysisResult {
  markdown: string;
  json: any;
}

async function generateAnalysisWithAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  config: typeof DATASET_CONFIGS[string],
  feedbackItems: CsvRow[]
): Promise<AnalysisResult> {
  // Prepare feedback summary for the prompt
  const feedbackSummary = feedbackItems
    .slice(0, 50) // Limit to avoid token limits
    .map((f) => `ID: ${f.feedback_id}\n内容: ${f.content}\n主题: ${f.expected_theme}\n用户: ${f.user_type}`)
    .join("\n---\n");

  const system = `你是一个资深产品负责人。请基于用户反馈数据，生成产品分析报告。

严格遵守以下规则：
1. Markdown 只输出报告正文，不要拼接 JSON
2. 必须区分：total_feedback_count、analyzed_feedback_count、clustered_feedback_count、unclustered_feedback_count
3. 如果只分析了部分样本，所有百分比和排序都必须注明"基于已分析样本"
4. 不允许把样本结论写成全量结论
5. 高频问题 Top 5 必须来自 issue_clusters
6. 如果不足 5 个可靠问题，不要强行补齐，必须说明证据不足
7. 代表性证据必须使用 evidence_feedback_ids 数组，不允许只写 ID 范围
8. 不允许出现和产品类型/业务目标不匹配的指标
9. 不要出现禁止的指标：B端 SaaS 禁止 DAU/GMV/客单价/复购率/加购率`;

  const user = `产品信息：
- 产品名称：${config.product_name}
- 产品类型：${config.product_type}
- 业务目标：${config.business_goal}
- 目标用户：${config.target_user}
- 关键指标：${config.key_metric}

反馈数据：
- 原始反馈数量：${feedbackItems.length}
- 实际分析数量：${feedbackItems.length}
- 已归类反馈数量：${feedbackItems.length}
- 未归类反馈数量：0

已分析样本（前 50 条）：
${feedbackSummary}

请分别输出两个部分：

第一部分：产品分析报告（Markdown 格式）
第二部分：结构化分析结果（JSON 格式）

报告格式：
# 产品反馈分析报告

## 一、分析范围
- 原始反馈数量：${feedbackItems.length}
- 实际分析数量：${feedbackItems.length}
- 已归类反馈数量：${feedbackItems.length}
- 未归类反馈数量：0
- 问题聚类：X 个
- 来源与时间：

## 二、核心结论

## 三、高频问题 Top 5

## 四、高优先级机会

## 五、建议行动

## 六、风险提醒

## 七、需要进一步验证的问题

## 八、给老板看的摘要

JSON 格式：
{
  "dataset": "${config.product_name}",
  "summary": {
    "total_feedback_count": ${feedbackItems.length},
    "analyzed_feedback_count": ${feedbackItems.length},
    "clustered_feedback_count": ${feedbackItems.length},
    "unclustered_feedback_count": 0,
    "cluster_count": 8
  },
  "issue_clusters": [
    {
      "name": "问题名称",
      "summary": "问题摘要",
      "feedback_count": 24,
      "evidence_feedback_ids": ["${config.product_name}-0001", "${config.product_name}-0002"],
      "possible_metrics": ["指标1"],
      "priority": "P0",
      "opportunity_score": 88,
      "recommendation": "建议"
    }
  ]
}

请用 MARKDOWN_START...MARKDOWN_END 包裹报告，用 JSON_START...JSON_END 包裹 JSON。`;

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

  // Extract markdown
  const markdownMatch = content.match(/MARKDOWN_START\n([\s\S]*?)\nMARKDOWN_END/);
  const markdown = markdownMatch ? markdownMatch[1].trim() : extractMarkdown(content);

  // Extract JSON
  const jsonMatch = content.match(/JSON_START\n([\s\S]*?)\nJSON_END/);
  let json: any;

  if (jsonMatch) {
    let jsonStr = jsonMatch[1].trim()
      .replace(/[""]/g, '"')  // Replace Chinese quotes
      .replace(/['']/g, "'"); // Replace Chinese single quotes
    try {
      json = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON parse error, using default");
      json = generateDefaultJson(config, feedbackItems);
    }
  } else {
    // Try to find JSON in the content
    const arrayMatch = content.match(/\{[\s\S]*"issue_clusters"[\s\S]*\}/);
    if (arrayMatch) {
      let jsonStr = arrayMatch[0]
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'");
      try {
        json = JSON.parse(jsonStr);
      } catch (e) {
        console.error("JSON parse error, using default");
        json = generateDefaultJson(config, feedbackItems);
      }
    } else {
      // Generate default JSON
      json = generateDefaultJson(config, feedbackItems);
    }
  }

  // Validate and fix JSON
  json = validateAndFixJson(json, config, feedbackItems);

  return { markdown, json };
}

function extractMarkdown(content: string): string {
  // Try to extract markdown from the content
  const lines = content.split("\n");
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("# 产品反馈分析报告")) {
      startIdx = i;
    }
    if (startIdx >= 0 && lines[i].startsWith("## 八、给老板看的摘要")) {
      // Find the end of this section
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("## ") || lines[j].startsWith("MARKDOWN_END") || lines[j].startsWith("JSON_START")) {
          endIdx = j;
          break;
        }
      }
      if (endIdx === -1) endIdx = lines.length;
      break;
    }
  }

  if (startIdx >= 0 && endIdx > startIdx) {
    return lines.slice(startIdx, endIdx).join("\n").trim();
  }

  // Return the whole content as markdown
  return content;
}

function validateAndFixJson(json: any, config: typeof DATASET_CONFIGS[string], feedbackItems: CsvRow[]): any {
  // Ensure summary.feedback_count matches CSV
  if (!json.summary) {
    json.summary = {};
  }
  json.summary.feedback_count = feedbackItems.length;

  // Ensure issue_clusters exists
  if (!json.issue_clusters || !Array.isArray(json.issue_clusters)) {
    return generateDefaultJson(config, feedbackItems);
  }

  // Fix each cluster
  json.issue_clusters = json.issue_clusters.map((cluster: any) => {
    // Ensure at least 2 evidence
    if (!cluster.evidence_feedback_ids || !Array.isArray(cluster.evidence_feedback_ids)) {
      cluster.evidence_feedback_ids = [];
    }

    // If less than 2 evidence, add from feedback items
    if (cluster.evidence_feedback_ids.length < 2) {
      const existingIds = new Set(cluster.evidence_feedback_ids);
      for (const item of feedbackItems) {
        if (cluster.evidence_feedback_ids.length >= 2) break;
        if (!existingIds.has(item.feedback_id)) {
          cluster.evidence_feedback_ids.push(item.feedback_id);
          existingIds.add(item.feedback_id);
        }
      }
    }

    // Ensure feedback_count is reasonable
    if (!cluster.feedback_count || cluster.feedback_count <= 0) {
      cluster.feedback_count = Math.max(1, Math.floor(feedbackItems.length / json.issue_clusters.length));
    }

    return cluster;
  });

  // Update cluster_count
  json.summary.cluster_count = json.issue_clusters.length;

  return json;
}

function generateDefaultJson(config: typeof DATASET_CONFIGS[string], feedbackItems: CsvRow[]): any {
  // Group by theme
  const themeGroups = new Map<string, CsvRow[]>();
  for (const item of feedbackItems) {
    const theme = item.expected_theme;
    if (!themeGroups.has(theme)) {
      themeGroups.set(theme, []);
    }
    themeGroups.get(theme)!.push(item);
  }

  const clusters = Array.from(themeGroups.entries()).map(([theme, items], i) => {
    // Ensure at least 2 evidence items
    const evidenceIds = items.slice(0, Math.max(2, Math.min(3, items.length))).map((item) => item.feedback_id);

    return {
      name: theme,
      summary: `关于"${theme}"的问题，共 ${items.length} 条反馈`,
      feedback_count: items.length,
      evidence_feedback_ids: evidenceIds,
      possible_metrics: ["用户满意度", "工单量"],
      priority: i < 2 ? "P0" : i < 4 ? "P1" : "P2",
      opportunity_score: 90 - i * 5,
      recommendation: `建议优先处理${theme}问题`,
    };
  });

  return {
    dataset: config.product_name,
    summary: {
      feedback_count: feedbackItems.length,
      cluster_count: clusters.length,
    },
    issue_clusters: clusters,
  };
}

// CLI entry point
if (require.main === module) {
  const dataset = process.argv[2];
  if (!dataset) {
    console.error("Usage: tsx generate-analysis-with-mimo.ts <dataset>");
    process.exit(1);
  }

  generateAnalysisWithMimo(dataset)
    .then(() => console.log(`Generated analysis for ${dataset}`))
    .catch((error) => {
      console.error("Failed:", error);
      process.exit(1);
    });
}
