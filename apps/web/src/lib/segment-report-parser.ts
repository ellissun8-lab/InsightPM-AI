/**
 * 从 overall-md 和 segment-json 解析每个分组的完整报告数据
 */

export interface ParsedCluster {
  id: string;
  title: string;
  priority: string;
  opportunityScore: number | null;
  feedbackCount: number | null;
  summary: string;
  evidenceIds: string[];
  suggestedMetrics: string;
  recommendation: string;
}

export interface ParsedSegmentReport {
  id: string;
  title: string;
  type: string;
  businessGoal: string;
  feedbackCount: number;
  clusterCount: number;
  clusters: ParsedCluster[];
  actions: { priority: string; title: string; recommendation: string }[];
  risks: string[];
  validationQuestions: string[];
  bossSummary: { core: string[]; consequences: string[]; opportunities: string[]; recommendations: string[] };
}

/**
 * 从 overall-md 解析分组摘要中的 cluster 列表
 */
function parseSegmentClustersFromSummary(md: string, segmentId: string): ParsedCluster[] {
  const clusters: ParsedCluster[] = [];

  // Find the segment section in "各分组摘要"
  const segHeader = new RegExp(`###\\s+${segmentId}\\b`, "i");
  const lines = md.split("\n");
  let inSegment = false;
  let nextSegIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (segHeader.test(lines[i])) {
      inSegment = true;
      continue;
    }
    if (inSegment && lines[i].startsWith("### ")) {
      nextSegIndex = i;
      break;
    }
  }

  if (!inSegment) return clusters;

  const endIdx = nextSegIndex > 0 ? nextSegIndex : lines.length;
  const segLines = lines.slice(lines.findIndex(l => segHeader.test(l)) + 1, endIdx);

  for (const line of segLines) {
    // Match: - 问题名（P0，机会分 90，8 条，证据充分）
    const match = line.match(/^-\s+(.+?)（(P\d+)[，,]\s*机会分\s*(\d+)[，,]\s*(\d+)\s*条/);
    if (match) {
      clusters.push({
        id: `cluster-${clusters.length + 1}`,
        title: match[1].trim(),
        priority: match[2],
        opportunityScore: parseInt(match[3]),
        feedbackCount: parseInt(match[4]),
        summary: "",
        evidenceIds: [],
        suggestedMetrics: "",
        recommendation: "",
      });
    }
  }

  return clusters;
}

/**
 * 从 "跨分组高优先级问题" 表格中补充 cluster 信息
 */
function enrichClustersFromCrossTable(md: string, segmentId: string, clusters: ParsedCluster[]): void {
  const lines = md.split("\n");
  let inTable = false;

  for (const line of lines) {
    if (line.includes("跨分组高优先级问题")) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith("## ")) break;
    if (inTable && line.startsWith("|") && !line.startsWith("| ---") && !line.startsWith("| 排名")) {
      const cols = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cols.length >= 5) {
        const name = cols[1];
        const seg = cols[2];
        const score = parseInt(cols[3]);
        const count = parseInt(cols[4]);

        if (seg === segmentId) {
          const existing = clusters.find(c => c.title === name);
          if (existing) {
            if (!existing.opportunityScore) existing.opportunityScore = score;
            if (!existing.feedbackCount) existing.feedbackCount = count;
          } else {
            clusters.push({
              id: `cluster-${clusters.length + 1}`,
              title: name,
              priority: "P1",
              opportunityScore: score,
              feedbackCount: count,
              summary: "",
              evidenceIds: [],
              suggestedMetrics: "",
              recommendation: "",
            });
          }
        }
      }
    }
  }
}

/**
 * 从 "建议行动" 中提取该分组的行动建议
 */
function parseSegmentActions(md: string, segmentId: string): { priority: string; title: string; recommendation: string }[] {
  const actions: { priority: string; title: string; recommendation: string }[] = [];
  const lines = md.split("\n");
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("## 建议行动")) {
      inSection = true;
      continue;
    }
    if (inSection && lines[i].startsWith("## ")) break;

    if (inSection) {
      // Match: 1. [P0] **问题名**（seg-XXX）— 建议
      const match = lines[i].match(/^\d+\.\s+\[(P\d+)\]\s+\*\*(.+?)\*\*（(\S+)）/);
      if (match && match[3] === segmentId) {
        // Next line may have the recommendation
        const rec = lines[i + 1]?.trim().replace(/^-\s+/, "") || "";
        actions.push({
          priority: match[1],
          title: match[2],
          recommendation: rec,
        });
      }
    }
  }

  return actions;
}

/**
 * 从 "风险提醒" 中提取该分组的风险
 */
function parseSegmentRisks(md: string, segmentId: string): string[] {
  const risks: string[] = [];
  const lines = md.split("\n");
  let inSection = false;

  for (const line of lines) {
    if (line.includes("## 风险提醒")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) break;
    if (inSection && line.includes(segmentId)) {
      risks.push(line.replace(/^-\s+/, "").trim());
    }
  }

  return risks;
}

/**
 * 从 "需要进一步验证" 中提取该分组的验证问题
 */
function parseSegmentValidation(md: string, segmentId: string): string[] {
  const questions: string[] = [];
  const lines = md.split("\n");
  let inSection = false;

  for (const line of lines) {
    if (line.includes("## 需要进一步验证")) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) break;
    if (inSection && line.includes(segmentId) && line.startsWith("-")) {
      questions.push(line.replace(/^-\s+/, "").trim());
    }
  }

  return questions;
}

/**
 * 从 "给老板看的摘要" 中提取该分组相关内容
 */
function parseBossSummaryForSegment(md: string, segmentId: string, segmentTitle: string): ParsedSegmentReport["bossSummary"] {
  const lines = md.split("\n");
  const result = { core: [] as string[], consequences: [] as string[], opportunities: [] as string[], recommendations: [] as string[] };
  let currentSection = "";

  for (const line of lines) {
    if (line.includes("### 核心问题")) { currentSection = "core"; continue; }
    if (line.includes("### 直接后果")) { currentSection = "consequences"; continue; }
    if (line.includes("### 关键机会")) { currentSection = "opportunities"; continue; }
    if (line.includes("### 建议")) { currentSection = "recommendations"; continue; }
    if (line.startsWith("## ") && !line.startsWith("### ")) { currentSection = ""; continue; }

    if (currentSection && line.startsWith("- ") || line.match(/^\d+\./)) {
      const text = line.replace(/^-\s+/, "").replace(/^\d+\.\s+/, "").trim();
      // Check if this item is related to our segment
      if (text.includes(segmentId) || text.includes(segmentTitle)) {
        if (currentSection === "core") result.core.push(text);
        if (currentSection === "consequences") result.consequences.push(text);
        if (currentSection === "opportunities") result.opportunities.push(text);
        if (currentSection === "recommendations") result.recommendations.push(text);
      }
    }
  }

  return result;
}

/**
 * 主函数：解析完整分组报告
 */
export function parseSegmentReport(
  segment: { segment_id: string; name: string; business_goal?: string; feedback_count?: number; issue_cluster_ids?: string[] },
  overallMd: string | null
): ParsedSegmentReport {
  const segmentId = segment.segment_id;
  const clusterIds = segment.issue_cluster_ids || [];

  // Parse clusters from markdown
  let clusters: ParsedCluster[] = [];
  if (overallMd) {
    clusters = parseSegmentClustersFromSummary(overallMd, segmentId);
    enrichClustersFromCrossTable(overallMd, segmentId, clusters);
  }

  // If no clusters from markdown, create placeholders from IDs
  if (clusters.length === 0 && clusterIds.length > 0) {
    clusters = clusterIds.map((id, i) => ({
      id,
      title: `问题 ${i + 1}`,
      priority: "P1",
      opportunityScore: null,
      feedbackCount: null,
      summary: "暂无详细信息，请查看完整报告。",
      evidenceIds: [],
      suggestedMetrics: "",
      recommendation: "",
    }));
  }

  // Sort clusters by opportunity score descending
  clusters.sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));

  // Parse actions, risks, validation, boss summary from markdown
  const actions = overallMd ? parseSegmentActions(overallMd, segmentId) : [];
  const risks = overallMd ? parseSegmentRisks(overallMd, segmentId) : [];
  const validationQuestions = overallMd ? parseSegmentValidation(overallMd, segmentId) : [];
  const bossSummary = overallMd ? parseBossSummaryForSegment(overallMd, segmentId, segment.name) : { core: [], consequences: [], opportunities: [], recommendations: [] };

  return {
    id: segmentId,
    title: segment.name,
    type: "business",
    businessGoal: segment.business_goal || "",
    feedbackCount: segment.feedback_count || 0,
    clusterCount: clusters.length,
    clusters,
    actions,
    risks,
    validationQuestions,
    bossSummary,
  };
}
