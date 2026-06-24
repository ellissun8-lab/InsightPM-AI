export interface ReportParseResult {
  title: string;
  scopeMetrics: {
    totalFeedback?: number;
    analyzedFeedback?: number;
    clusteredFeedback?: number;
    clusterCount?: number;
    businessClusterCount?: number;
    segmentCount?: number;
    businessSegmentCount?: number;
    positiveSegmentCount?: number;
    noiseSegmentCount?: number;
    unknownSegmentCount?: number;
  };
  segmentOverview: Array<{
    segmentId: string;
    type: string;
    businessGoal: string;
    feedbackCount: number;
    clusterCount: number;
  }>;
  executiveSummary: string;
}

const FALLBACK_SUMMARY =
  "本报告已自动解析分析范围与分组数据。完整结论请参阅「完整 Markdown」标签页。";

function extractTitle(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)/);
    if (m) return m[1].trim();
  }
  return "分析报告";
}

function extractScopeMetrics(lines: string[]): ReportParseResult["scopeMetrics"] {
  const metrics: ReportParseResult["scopeMetrics"] = {};
  const patterns: [RegExp, keyof ReportParseResult["scopeMetrics"]][] = [
    [/总反馈数量[：:]\s*(\d+)/, "totalFeedback"],
    [/已分析数量[：:]\s*(\d+)/, "analyzedFeedback"],
    [/已聚类数量[：:]\s*(\d+)/, "clusteredFeedback"],
    [/共识别出\s*(\d+)\s*个聚类/, "clusterCount"],
    [/(\d+)\s*个为业务问题聚类/, "businessClusterCount"],
    [/分组数[：:]\s*(\d+)/, "segmentCount"],
    [/业务分组数量[：:]\s*(\d+)/, "businessSegmentCount"],
    [/正向反馈分组数量[：:]\s*(\d+)/, "positiveSegmentCount"],
    [/噪声分组数量[：:]\s*(\d+)/, "noiseSegmentCount"],
    [/未分类分组数量[：:]\s*(\d+)/, "unknownSegmentCount"],
  ];

  let inScope = false;
  for (const line of lines) {
    if (/^##\s+分析范围/.test(line)) {
      inScope = true;
      continue;
    }
    if (inScope && /^##\s/.test(line)) break;
    if (inScope) {
      for (const [re, key] of patterns) {
        const m = line.match(re);
        if (m) metrics[key] = Number(m[1]);
      }
    }
  }

  return metrics;
}

function extractSegmentTable(lines: string[]): ReportParseResult["segmentOverview"] {
  const segments: ReportParseResult["segmentOverview"] = [];
  let inTable = false;
  let headerParsed = false;

  for (const line of lines) {
    if (/^##\s+数据分组概览/.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable && /^##\s/.test(line)) break;
    if (!inTable) continue;

    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      if (!headerParsed) {
        headerParsed = true;
        continue;
      }
      if (/^\|[\s-|]+\|$/.test(trimmed)) continue;

      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (cells.length >= 5) {
        segments.push({
          segmentId: cells[0],
          type: cells[1],
          businessGoal: cells[2],
          feedbackCount: Number(cells[3]) || 0,
          clusterCount: Number(cells[4]) || 0,
        });
      }
    } else {
      headerParsed = false;
    }
  }

  return segments;
}

function extractExecutiveSummary(lines: string[]): string {
  let inSection = false;
  const buf: string[] = [];

  for (const line of lines) {
    if (/^##\s+整体核心结论/.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(line)) break;
    if (inSection && line.trim()) {
      buf.push(line.trim());
    }
  }

  if (buf.length === 0) return "";
  return buf
    .join("\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\d+\.\s*/gm, "")
    .trim();
}

export function parseReportMarkdown(markdown: string | null): ReportParseResult {
  if (!markdown) {
    return {
      title: "分析报告",
      scopeMetrics: {},
      segmentOverview: [],
      executiveSummary: FALLBACK_SUMMARY,
    };
  }

  try {
    const lines = markdown.split("\n");
    const title = extractTitle(lines);
    const scopeMetrics = extractScopeMetrics(lines);
    const segmentOverview = extractSegmentTable(lines);
    let executiveSummary = extractExecutiveSummary(lines);

    if (!executiveSummary) {
      const { totalFeedback, clusterCount, segmentCount } = scopeMetrics;
      if (totalFeedback && clusterCount) {
        executiveSummary = `本报告共分析 ${totalFeedback} 条用户反馈，识别出 ${clusterCount} 个问题聚类，覆盖 ${segmentCount || "多个"} 个分组。建议优先关注反馈量高、证据完整且影响核心业务目标的问题，并将低证据问题放入进一步验证池。`;
      } else {
        executiveSummary = FALLBACK_SUMMARY;
      }
    }

    return { title, scopeMetrics, segmentOverview, executiveSummary };
  } catch {
    return {
      title: "分析报告",
      scopeMetrics: {},
      segmentOverview: [],
      executiveSummary: FALLBACK_SUMMARY,
    };
  }
}
