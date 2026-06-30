/**
 * PPT 报告生成器
 *
 * 从 overall-md 和 summary-json 生成演示文稿
 */

import PptxGenJS from "pptxgenjs";

interface PptInput {
  caseName: string;
  feedbackCount: number;
  hardScore: number | null;
  semanticScore: number | null;
  segmentCount: number;
  clusterCount: number;
  overallMd: string;
  summary: any;
  segments: any[];
}

function extractSection(md: string, header: string): string {
  const regex = new RegExp(`##\\s+${header}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const match = md.match(regex);
  return match ? match[1].trim() : "";
}

function extractTopProblems(md: string): { name: string; segment: string; score: number; count: number }[] {
  const section = extractSection(md, "跨分组高优先级问题");
  const problems: { name: string; segment: string; score: number; count: number }[] = [];
  const lines = section.split("\n");
  for (const line of lines) {
    if (line.startsWith("|") && !line.startsWith("| ---") && !line.startsWith("| 排名")) {
      const cols = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cols.length >= 5) {
        problems.push({
          name: cols[1],
          segment: cols[2],
          score: parseInt(cols[3]) || 0,
          count: parseInt(cols[4]) || 0,
        });
      }
    }
  }
  return problems;
}

function extractActions(md: string): string[] {
  const section = extractSection(md, "建议行动");
  return section.split("\n")
    .filter(l => l.match(/^\d+\./))
    .map(l => l.replace(/^\d+\.\s+/, "").trim())
    .slice(0, 8);
}

function extractRisks(md: string): string[] {
  const section = extractSection(md, "风险提醒");
  return section.split("\n")
    .filter(l => l.startsWith("- "))
    .map(l => l.replace(/^-\s+/, "").replace(/\*\*/g, "").trim())
    .slice(0, 5);
}

function extractBossSummary(md: string): { core: string[]; consequences: string[]; opportunities: string[]; recommendations: string[] } {
  const section = extractSection(md, "给老板看的摘要");
  const result = { core: [] as string[], consequences: [] as string[], opportunities: [] as string[], recommendations: [] as string[] };
  let current = "";
  for (const line of section.split("\n")) {
    if (line.includes("核心问题")) { current = "core"; continue; }
    if (line.includes("直接后果")) { current = "consequences"; continue; }
    if (line.includes("关键机会")) { current = "opportunities"; continue; }
    if (line.includes("建议")) { current = "recommendations"; continue; }
    if (line.startsWith("- ") || line.match(/^\d+\./)) {
      const text = line.replace(/^-\s+/, "").replace(/^\d+\.\s+/, "").replace(/\*\*/g, "").trim();
      if (current && text) (result as any)[current]?.push(text);
    }
  }
  return result;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

export async function generatePptx(input: PptInput): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "InsightPM AI";
  pptx.title = `${input.caseName} 分析报告`;

  const topProblems = extractTopProblems(input.overallMd);
  const actions = extractActions(input.overallMd);
  const risks = extractRisks(input.overallMd);
  const bossSummary = extractBossSummary(input.overallMd);
  const scopeSection = extractSection(input.overallMd, "分析范围");

  // ─── Slide 1: Cover ───
  let slide = pptx.addSlide();
  slide.addText(`${input.caseName}`, { x: 0.8, y: 1.2, w: 8, h: 0.8, fontSize: 32, bold: true, color: "1a1a1a" });
  slide.addText("AI 用户反馈分析报告", { x: 0.8, y: 2.0, w: 8, h: 0.5, fontSize: 18, color: "666666" });
  slide.addText([
    { text: `反馈数量：${input.feedbackCount}`, options: { breakLine: true } },
    { text: `分组数量：${input.segmentCount}`, options: { breakLine: true } },
    { text: `聚类数量：${input.clusterCount}`, options: { breakLine: true } },
    { text: `生成时间：${new Date().toLocaleString("zh-CN")}`, options: {} },
  ], { x: 0.8, y: 3.2, w: 8, h: 1.5, fontSize: 14, color: "444444", lineSpacingMultiple: 1.5 });

  // ─── Slide 2: Executive Summary ───
  slide = pptx.addSlide();
  slide.addText("执行摘要", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

  const summaryLines: string[] = [];
  if (bossSummary.core.length > 0) {
    summaryLines.push("核心问题：");
    bossSummary.core.slice(0, 3).forEach(l => summaryLines.push(`  • ${truncate(l, 80)}`));
  }
  if (bossSummary.opportunities.length > 0) {
    summaryLines.push("关键机会：");
    bossSummary.opportunities.slice(0, 2).forEach(l => summaryLines.push(`  • ${truncate(l, 80)}`));
  }
  if (actions.length > 0) {
    summaryLines.push("优先动作：");
    actions.slice(0, 3).forEach(l => summaryLines.push(`  • ${truncate(l, 80)}`));
  }
  slide.addText(summaryLines.join("\n"), { x: 0.5, y: 1.1, w: 9, h: 4.2, fontSize: 13, color: "333333", lineSpacingMultiple: 1.4, valign: "top" });

  // ─── Slide 3: Analysis Scope ───
  slide = pptx.addSlide();
  slide.addText("分析范围", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

  const scopeRows: any[][] = [
    [{ text: "指标", options: { bold: true } }, { text: "数值", options: { bold: true } }],
    ["总反馈数量", String(input.feedbackCount)],
    ["分组数", String(input.segmentCount)],
    ["聚类数", String(input.clusterCount)],
    ["硬性校验", input.hardScore != null ? `${input.hardScore}/100` : "未统计"],
    ["语义评分", input.semanticScore != null ? `${input.semanticScore}/100` : "未统计"],
  ];
  slide.addTable(scopeRows, {
    x: 0.5, y: 1.1, w: 5, h: 2.5,
    fontSize: 13, color: "333333",
    border: { type: "solid", pt: 0.5, color: "cccccc" },
    colW: [2.5, 2.5],
    autoPage: false,
  });

  // ─── Slide 4: Top Problems ───
  if (topProblems.length > 0) {
    slide = pptx.addSlide();
    slide.addText("Top 问题总览", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

    const problemRows: any[][] = [[
      { text: "排名", options: { bold: true } },
      { text: "问题名称", options: { bold: true } },
      { text: "所属分组", options: { bold: true } },
      { text: "机会分", options: { bold: true } },
      { text: "反馈数", options: { bold: true } },
    ]];
    topProblems.slice(0, 8).forEach((p, i) => {
      problemRows.push([String(i + 1), truncate(p.name, 25), p.segment, String(p.score), String(p.count)]);
    });
    slide.addTable(problemRows, {
      x: 0.3, y: 1.1, w: 9.4, h: Math.min(4, problemRows.length * 0.4),
      fontSize: 11, color: "333333",
      border: { type: "solid", pt: 0.5, color: "cccccc" },
      colW: [0.6, 3, 2, 1.2, 1.2],
      autoPage: false,
    });
  }

  // ─── Slide 5: Segment Overview ───
  if (input.segments.length > 0) {
    slide = pptx.addSlide();
    slide.addText("分组洞察", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

    const segRows: any[][] = [[
      { text: "分组", options: { bold: true } },
      { text: "业务目标", options: { bold: true } },
      { text: "反馈数", options: { bold: true } },
      { text: "聚类数", options: { bold: true } },
    ]];
    input.segments.forEach((seg: any) => {
      segRows.push([
        seg.name || seg.segment_id,
        truncate(seg.business_goal || "-", 35),
        String(seg.feedback_count || 0),
        String((seg.issue_cluster_ids || []).length),
      ]);
    });
    slide.addTable(segRows, {
      x: 0.3, y: 1.1, w: 9.4, h: Math.min(3.5, segRows.length * 0.45),
      fontSize: 12, color: "333333",
      border: { type: "solid", pt: 0.5, color: "cccccc" },
      colW: [2, 4, 1.2, 1.2],
      autoPage: false,
    });
  }

  // ─── Slide 6: High Priority Opportunities ───
  if (topProblems.length > 0) {
    slide = pptx.addSlide();
    slide.addText("高优先级机会", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

    const oppText = topProblems.slice(0, 5).map((p, i) =>
      `${i + 1}. ${p.name}（${p.segment}，机会分 ${p.score}，${p.count} 条反馈）`
    ).join("\n");
    slide.addText(oppText, { x: 0.5, y: 1.1, w: 9, h: 4, fontSize: 14, color: "333333", lineSpacingMultiple: 1.6, valign: "top" });
  }

  // ─── Slide 7: Action Roadmap ───
  if (actions.length > 0) {
    slide = pptx.addSlide();
    slide.addText("建议行动路线图", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

    const actionText = actions.slice(0, 6).map((a, i) => `${i + 1}. ${truncate(a, 90)}`).join("\n");
    slide.addText(actionText, { x: 0.5, y: 1.1, w: 9, h: 4, fontSize: 13, color: "333333", lineSpacingMultiple: 1.5, valign: "top" });
  }

  // ─── Slide 8: Risk Warnings ───
  if (risks.length > 0) {
    slide = pptx.addSlide();
    slide.addText("风险提醒", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

    const riskText = risks.map(r => `• ${truncate(r, 100)}`).join("\n");
    slide.addText(riskText, { x: 0.5, y: 1.1, w: 9, h: 4, fontSize: 13, color: "333333", lineSpacingMultiple: 1.5, valign: "top" });
  }

  // ─── Slide 9: Boss Summary ───
  slide = pptx.addSlide();
  slide.addText("给老板看的摘要", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

  const bossLines: string[] = [];
  if (bossSummary.core.length > 0) {
    bossLines.push("核心问题：");
    bossSummary.core.slice(0, 4).forEach(l => bossLines.push(`  • ${truncate(l, 80)}`));
  }
  if (bossSummary.consequences.length > 0) {
    bossLines.push("直接后果：");
    bossSummary.consequences.slice(0, 3).forEach(l => bossLines.push(`  • ${truncate(l, 80)}`));
  }
  if (bossSummary.recommendations.length > 0) {
    bossLines.push("建议：");
    bossSummary.recommendations.slice(0, 3).forEach(l => bossLines.push(`  • ${truncate(l, 80)}`));
  }
  slide.addText(bossLines.join("\n") || "暂无", { x: 0.5, y: 1.1, w: 9, h: 4.2, fontSize: 13, color: "333333", lineSpacingMultiple: 1.4, valign: "top" });

  // ─── Slide 10: Appendix ───
  slide = pptx.addSlide();
  slide.addText("附录", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 24, bold: true, color: "1a1a1a" });

  const appendixLines = [
    `硬性校验：${input.hardScore != null ? input.hardScore + "/100" : "未统计"}`,
    `语义评分：${input.semanticScore != null ? input.semanticScore + "/100" : "未统计"}`,
    `Prompt 版本：${input.summary?.metrics?.aiConfig?.promptVersion || "未记录"}`,
    `AI 模型：${input.summary?.metrics?.aiModel || "未记录"}`,
    `校验模型：${input.summary?.metrics?.validationModel || "未记录"}`,
    `运行耗时：${input.summary?.durationMs ? Math.round(input.summary.durationMs / 1000) + "s" : "未记录"}`,
    "",
    "更多内容请查看完整 Markdown 报告。",
  ];
  slide.addText(appendixLines.join("\n"), { x: 0.5, y: 1.1, w: 9, h: 4, fontSize: 13, color: "555555", lineSpacingMultiple: 1.5, valign: "top" });

  // Generate buffer
  const arrayBuffer: any = await pptx.write({ outputType: "arraybuffer" });
  return Buffer.from(arrayBuffer);
}
