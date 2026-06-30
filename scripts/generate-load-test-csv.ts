/**
 * 压力测试 CSV 生成脚本
 *
 * 生成 200 / 500 / 1000 条模拟用户反馈 CSV
 * 字段：feedback_id, source, user_role, product_area, feedback_text, created_at
 *
 * 用法：npx tsx scripts/generate-load-test-csv.ts
 */

import * as fs from "fs";
import * as path from "path";

const OUTPUT_DIR = path.resolve(process.cwd(), "data/load");

const SOURCES = ["survey", "support", "interview", "appstore", "in-app", "sales", "community"];
const ROLES = ["运营负责人", "销售经理", "产品经理", "技术负责人", "CEO", "客户成功", "市场总监", "数据分析师", "HR主管", "财务经理"];
const AREAS = ["BI报表", "导出功能", "数据分析", "用户管理", "权限配置", "API接口", "移动端", "通知系统", "搜索功能", "仪表盘"];

// 50 个真实反馈模板，涵盖不同长度、来源、主题
const TEMPLATES = [
  "续费看板金额和明细对不上，差了大概{num}万",
  "导出的字段顺序每次都不固定，能不能固定下来",
  "希望能导出 PDF 格式的报告，客户需要正式文档",
  "数据分析页面加载太慢了，{num}秒都打不开",
  "权限配置太复杂，新来的同事{num}天都搞不定",
  "移动端看板显示不全，iPhone上排版错乱",
  "API 返回的数据格式和文档不一致",
  "搜索功能经常搜不到想要的结果",
  "仪表盘的图表类型太少了，缺少漏斗图",
  "通知太多太频繁，希望能自定义规则",
  "报表刷新后数据没有更新，需要手动清理缓存",
  "用户分群的条件设置不够灵活",
  "漏斗分析的转化率计算好像有问题",
  "自定义指标的公式编辑器不好用",
  "数据导入的时候没有错误提示，导入完了才发现少数据",
  "希望能支持定时发送报表到邮箱",
  "多语言支持不够完善，英文界面有翻译错误",
  "数据权限设置太粗，不能按部门隔离",
  "报表模板太少，每次都得从头做",
  "实时数据更新延迟太高，{num}分钟才刷新一次",
  "客户反馈渠道分散，汇总太麻烦",
  "竞品分析模块数据来源不够权威",
  "NPS 评分趋势图时间范围选择不灵活",
  "客户画像标签体系不够完善",
  "工单分配逻辑不透明，经常分配错人",
  "SLA 超时预警不及时",
  "知识库搜索结果排序不合理",
  "客户生命周期阶段定义不够清晰",
  "自动化工作流配置门槛太高",
  "报表分享链接过期时间太短",
  "数据看板不能嵌入到我们自己的系统里",
  "A/B 测试结果分析维度不够",
  "用户行为路径分析太粗糙",
  "留存分析的同期群定义不直观",
  "漏斗步骤之间的时间窗口设置有限制",
  "自定义事件追踪配置太麻烦",
  "热力图数据不够精确",
  "会话回放加载太慢",
  "用户反馈情感分析准确率不高",
  "标签管理没有批量操作",
  "数据导出格式有限，缺少 Parquet",
  "Webhook 配置没有测试功能",
  "集成第三方工具的文档不完整",
  "Dashboard 权限继承关系不清晰",
  "报表订阅管理入口太深",
  "数据字典维护成本高",
  "告警规则配置没有模板",
  "API 调用频率限制文档不清楚",
  "数据回溯能力不足，只能看{num}天内的",
  "客户分层模型不够灵活，不能自定义维度",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateFeedback(index: number): string[] {
  const template = TEMPLATES[index % TEMPLATES.length];
  const text = template.replace(/\{num\}/g, String(randomInt(2, 30)));
  const date = new Date(2026, 5, randomInt(1, 28)); // June 2026

  return [
    `FB${String(index + 1).padStart(5, "0")}`,
    randomChoice(SOURCES),
    randomChoice(ROLES),
    randomChoice(AREAS),
    `"${text}"`,
    date.toISOString().slice(0, 10),
  ];
}

function generateCSV(count: number): string {
  const header = "feedback_id,source,user_role,product_area,feedback_text,created_at";
  const rows = Array.from({ length: count }, (_, i) => generateFeedback(i).join(","));
  return [header, ...rows].join("\n") + "\n";
}

function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const counts = [200, 500, 1000];
  for (const count of counts) {
    const csv = generateCSV(count);
    const filePath = path.join(OUTPUT_DIR, `prod-load-${count}.csv`);
    fs.writeFileSync(filePath, csv, "utf-8");
    console.log(`Generated: ${filePath} (${count} rows)`);
  }
}

main();
