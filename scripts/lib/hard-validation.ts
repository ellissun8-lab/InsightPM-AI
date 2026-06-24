/**
 * 硬校验模块
 * 验证完整链路：raw input → normalized_feedback → data_profile → segments → analysis.json → analysis.md
 *
 * 校验规则：
 * 1.  raw_input_required_check
 * 2.  raw_input_schema_check
 * 3.  raw_input_realism_check
 * 4.  raw_to_normalized_trace_check
 * 5.  no_expected_theme_dependency_check
 * 6.  segment_count_closure_check
 * 7.  issue_cluster_count_closure_check
 * 8.  unknown_business_opportunity_check
 * 9.  noise_business_opportunity_check
 * 10. evidence_trace_check
 * 11. segment_analysis_json_check
 * 12. (superseded by 21)
 * 13. empty_section_check
 * 14. placeholder_check
 * 15. structured_legacy_file_check
 * 16. ecommerce_feedback_count_vs_mention_count_check
 * 17. (superseded by 27)
 * 18. missing_analysis_json_check
 * 19. unsupported_metric_value_check
 * 20. overall_markdown_json_consistency_check
 * 21. segment_markdown_json_consistency_check
 * 22. evidence_count_check
 * 23. duplicate_feedback_assignment_check
 * 24. missing_segment_json_check
 * 25. global_cluster_id_check
 * 26. duplicate_cluster_name_check
 * 27. strong_claim_without_evidence_check (enhanced)
 */

import * as fs from "fs";
import * as path from "path";

const DEFAULT_FIXTURES_DIR = path.join(__dirname, "..", "..", "fixtures");
const LEGACY_FEEDBACK_DIR = path.join(DEFAULT_FIXTURES_DIR, "legacy", "feedback");

const RAW_FORBIDDEN_FIELDS = [
  "expected_theme", "product_type", "business_goal", "priority",
  "opportunity_score", "detected_segment", "allowed_metrics", "forbidden_metrics",
];

const PLACEHOLDERS = ["待补充", "TODO", "TBD", "xxx", "占位符"];

export type HardValidationCheck = {
  name: string;
  status: "pass" | "warning" | "fail";
  message: string;
  recommendation?: string;
  details?: Record<string, unknown>;
};

export type HardValidationResult = {
  status: "pass" | "warning" | "fail";
  score: number;
  checks: HardValidationCheck[];
  failed_checks: HardValidationCheck[];
  warnings: HardValidationCheck[];
  summary: {
    total_checks: number;
    pass_count: number;
    warning_count: number;
    fail_count: number;
  };
};

function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJsonSafe(filePath: string): any {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function readTextSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * 运行全部硬校验，返回评分结果
 */
export async function runHardValidation(dataset: string, baseDir?: string): Promise<HardValidationResult> {
  const checks: HardValidationCheck[] = [];

  const add = (name: string, status: "pass" | "warning" | "fail", message: string, recommendation?: string, details?: Record<string, unknown>) => {
    checks.push({ name, status, message, recommendation, details });
  };

  // Compute paths from baseDir (supports both legacy fixtures/ and new runs/ layout)
  const FIXTURES_DIR = baseDir || DEFAULT_FIXTURES_DIR;
  const ANALYSIS_DIR = path.join(FIXTURES_DIR, "analysis");
  const SEGMENTS_DIR = path.join(ANALYSIS_DIR, dataset, "segments");
  const NORMALIZED_DIR = path.join(FIXTURES_DIR, "normalized");
  // For runs/ layout, input is in "input/"; for legacy fixtures/, it's "raw-inputs/"
  const RAW_INPUTS_DIR = fs.existsSync(path.join(FIXTURES_DIR, "input"))
    ? path.join(FIXTURES_DIR, "input")
    : path.join(FIXTURES_DIR, "raw-inputs");

  const rawCsvPath = path.join(RAW_INPUTS_DIR, `${dataset}.csv`);
  const rawTxtPath = path.join(RAW_INPUTS_DIR, `${dataset}.txt`);
  const rawMdPath = path.join(RAW_INPUTS_DIR, `${dataset}.md`);
  const normalizedPath = path.join(NORMALIZED_DIR, `${dataset}.normalized.json`);
  const overallMdPath = path.join(ANALYSIS_DIR, `${dataset}.overall.analysis.md`);
  const overallJsonPath = path.join(ANALYSIS_DIR, `${dataset}.overall.analysis.json`);

  // ---------------------------------------------------------------------------
  // 1. raw_input_required_check
  // ---------------------------------------------------------------------------
  const hasRawInput = fs.existsSync(rawCsvPath) || fs.existsSync(rawTxtPath) || fs.existsSync(rawMdPath);
  add("raw_input_required_check",
    hasRawInput ? "pass" : "fail",
    hasRawInput
      ? `Raw input 文件存在: ${[rawCsvPath, rawTxtPath, rawMdPath].filter(fs.existsSync).map(p => path.basename(p)).join(", ")}`
      : `缺少 raw input 文件: ${dataset}.csv / ${dataset}.txt / ${dataset}.md`,
    hasRawInput ? undefined : "请先运行 generate:raw-feedback 生成原始反馈数据",
  );
  if (!hasRawInput) return buildResult(checks);

  // ---------------------------------------------------------------------------
  // 2. raw_input_schema_check
  // ---------------------------------------------------------------------------
  const rawLines = readTextSafe(rawCsvPath).split("\n").filter(l => l.trim());
  const header = rawLines[0] || "";
  const headerLower = header.toLowerCase();
  const foundForbidden = RAW_FORBIDDEN_FIELDS.filter(f => headerLower.includes(f));
  add("raw_input_schema_check",
    foundForbidden.length === 0 ? "pass" : "fail",
    foundForbidden.length === 0
      ? "Raw input 不包含禁止结构化字段"
      : `Raw input 包含禁止字段: ${foundForbidden.join(", ")}`,
    foundForbidden.length > 0 ? "CSV 只允许 raw_id, source, raw_text 三个字段，禁止 expected_theme / product_type 等标注字段" : undefined,
    foundForbidden.length > 0 ? { header, found: foundForbidden } : undefined,
  );

  // ---------------------------------------------------------------------------
  // 3. raw_input_realism_check
  // ---------------------------------------------------------------------------
  const dataRows = rawLines.slice(1);
  const texts = dataRows.map(line => {
    const parts = line.split(",");
    return parts.length >= 3 ? parts.slice(2).join(",").trim() : parts[0]?.trim() || "";
  }).filter(Boolean);

  const shortFeedback = texts.filter(t => t.length < 15).length;
  const longFeedback = texts.filter(t => t.length > 80).length;
  const duplicateRatio = 1 - new Set(texts).size / Math.max(texts.length, 1);
  const sources = new Set(dataRows.map(line => line.split(",")[1]?.trim()).filter(Boolean));

  const hasShort = shortFeedback > 0;
  const hasMixedSources = sources.size > 3;
  const hasDuplicates = duplicateRatio > 0.02;
  const hasLong = longFeedback > 0;

  const realismScore = [hasShort, hasMixedSources, hasDuplicates, hasLong].filter(Boolean).length;

  // Check for legacy structured patterns: every text too long, all same source, zero duplicates
  const isTooStructured = texts.length > 0 && shortFeedback === 0 && !hasDuplicates && sources.size <= 1;

  let realismStatus: "pass" | "warning" | "fail" = "pass";
  let realismMsg = "Raw input 包含多种真实反馈特征";
  let realismRec: string | undefined;

  if (isTooStructured) {
    realismStatus = "fail";
    realismMsg = "Raw input 过于整齐，疑似旧结构化训练数据冒充原始输入";
    realismRec = "请使用真实用户原始反馈，包含短句、口语化表达、重复、噪声等";
  } else if (realismScore <= 2) {
    realismStatus = "warning";
    realismMsg = `Raw input 真实性特征较少 (${realismScore}/4): 短句${shortFeedback}条, 来源${sources.size}个, 重复率${(duplicateRatio * 100).toFixed(0)}%`;
    realismRec = "建议增加更多短句反馈、转述反馈、重复反馈和噪声反馈";
  }

  add("raw_input_realism_check", realismStatus, realismMsg, realismRec, {
    total_texts: texts.length,
    short_feedback: shortFeedback,
    long_feedback: longFeedback,
    duplicate_ratio: +(duplicateRatio * 100).toFixed(1),
    source_count: sources.size,
  });

  // ---------------------------------------------------------------------------
  // 4. raw_to_normalized_trace_check
  // ---------------------------------------------------------------------------
  const normalizedItems: any[] = readJsonSafe(normalizedPath) || [];

  if (normalizedItems.length > 0) {
    const rawIds = new Set(dataRows.map(l => l.split(",")[0]?.trim()).filter(Boolean));
    const itemsWithoutTrace = normalizedItems.filter(item => !item.raw_id && item.raw_index === undefined);
    const itemsWithInvalidTrace = normalizedItems.filter(item => {
      if (item.raw_id && !rawIds.has(item.raw_id)) return true;
      // Support both 0-based and 1-based raw_index
      if (item.raw_index !== undefined && item.raw_index !== null) {
        const idx = item.raw_index;
        if (idx < 0 || (idx > 0 && idx > dataRows.length)) return true;
      }
      return false;
    });

    const allTraced = itemsWithoutTrace.length === 0 && itemsWithInvalidTrace.length === 0;
    add("raw_to_normalized_trace_check",
      allTraced ? "pass" : "fail",
      allTraced
        ? `所有 ${normalizedItems.length} 条 normalized feedback 可追溯到 raw input`
        : `${itemsWithoutTrace.length} 条缺少 raw_id, ${itemsWithInvalidTrace.length} 条 raw_id 不匹配`,
      !allTraced ? "每条 normalized feedback 必须有 raw_id 或 raw_index 指向原始输入" : undefined,
    );
  } else {
    add("raw_to_normalized_trace_check", "warning", "normalized_feedback 文件不存在或为空，跳过追溯校验", "请先运行 normalize:feedback");
  }

  // ---------------------------------------------------------------------------
  // 5. no_expected_theme_dependency_check
  // ---------------------------------------------------------------------------
  const expectedThemeForbiddenLocations: string[] = [];

  if (headerLower.includes("expected_theme")) expectedThemeForbiddenLocations.push("raw input header");

  for (const ni of normalizedItems) {
    if (ni.expected_theme || ni.detected_theme === ni.expected_theme) {
      expectedThemeForbiddenLocations.push(`normalized_feedback ${ni.feedback_id} contains expected_theme`);
      break;
    }
  }

  const overallJson: any = readJsonSafe(overallJsonPath);
  const overallMd = readTextSafe(overallMdPath);

  if (overallJson) {
    const jsonStr = JSON.stringify(overallJson);
    if (jsonStr.includes("expected_theme")) expectedThemeForbiddenLocations.push("analysis.json");
  }
  if (overallMd.includes("expected_theme")) expectedThemeForbiddenLocations.push("analysis.md");

  // Check segment analysis files
  if (fs.existsSync(SEGMENTS_DIR)) {
    const segFiles = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"));
    for (const sf of segFiles) {
      const content = readTextSafe(path.join(SEGMENTS_DIR, sf));
      if (content.includes("expected_theme")) {
        expectedThemeForbiddenLocations.push(`segment/${sf}`);
        break;
      }
    }
  }

  add("no_expected_theme_dependency_check",
    expectedThemeForbiddenLocations.length === 0 ? "pass" : "fail",
    expectedThemeForbiddenLocations.length === 0
      ? "expected_theme 未出现在 pipeline 输出中"
      : `expected_theme 出现在: ${expectedThemeForbiddenLocations.join(", ")}`,
    expectedThemeForbiddenLocations.length > 0 ? "expected_theme 只能用于离线评估，不能出现在分析流程的任何输出中" : undefined,
  );

  // ---------------------------------------------------------------------------
  // 6. segment_count_closure_check
  // ---------------------------------------------------------------------------
  if (overallJson) {
    const s = overallJson.summary || {};
    const total = s.total_feedback_count || 0;
    const analyzed = s.analyzed_feedback_count || 0;
    const unanalyzed = s.unanalyzed_feedback_count || 0;

    const totalClosure = (analyzed + unanalyzed) === total;
    add("segment_count_closure_check",
      totalClosure ? "pass" : "fail",
      totalClosure
        ? `总数闭合: ${analyzed} + ${unanalyzed} = ${total}`
        : `总数不闭合: ${analyzed} + ${unanalyzed} = ${analyzed + unanalyzed} ≠ ${total}`,
      !totalClosure ? "analyzed_feedback_count + unanalyzed_feedback_count 必须等于 total_feedback_count" : undefined,
      { total, analyzed, unanalyzed },
    );
  }

  // ---------------------------------------------------------------------------
  // 7. issue_cluster_count_closure_check (overall)
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters && overallJson.summary) {
    const s = overallJson.summary;
    const clustered = s.clustered_feedback_count || 0;
    const unclustered = s.unclustered_feedback_count || 0;
    const analyzed = s.analyzed_feedback_count || 0;

    const analyzedClosure = (clustered + unclustered) === analyzed;
    add("issue_cluster_count_closure_check",
      analyzedClosure ? "pass" : "fail",
      analyzedClosure
        ? `聚类闭合: ${clustered} + ${unclustered} = ${analyzed}`
        : `聚类不闭合: ${clustered} + ${unclustered} = ${clustered + unclustered} ≠ ${analyzed}`,
      !analyzedClosure ? "clustered_feedback_count + unclustered_feedback_count 必须等于 analyzed_feedback_count" : undefined,
      { analyzed, clustered, unclustered },
    );
  }

  // ---------------------------------------------------------------------------
  // 8. unknown_business_opportunity_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters) {
    const unknownClusters = overallJson.issue_clusters.filter((c: any) => c.segment_id === "seg-unknown");
    const violations = unknownClusters.filter((c: any) =>
      c.priority === "P0" || c.priority === "P1" ||
      (c.opportunity_score && c.opportunity_score > 0)
    );

    add("unknown_business_opportunity_check",
      violations.length === 0 ? "pass" : "fail",
      violations.length === 0
        ? "seg-unknown 未生成业务机会"
        : `seg-unknown 错误地生成了业务机会: ${violations.map((v: any) => v.name).join(", ")}`,
      violations.length > 0 ? "seg-unknown 不允许生成 P0/P1 或 opportunity_score" : undefined,
    );

    // seg-unknown count ratio check
    if (overallJson.summary) {
      const unknownFeedbackCount = overallJson.segments?.find((s: any) => s.segment_id === "seg-unknown")?.feedback_count || 0;
      const totalFeedback = overallJson.summary.total_feedback_count || 1;
      const unknownRatio = unknownFeedbackCount / totalFeedback;

      if (unknownRatio > 0.2) {
        add("unknown_ratio_check", "fail",
          `seg-unknown 占比 ${(unknownRatio * 100).toFixed(0)}% (${unknownFeedbackCount}/${totalFeedback})，超过 20% 阈值`,
          "seg-unknown 比例过高，说明分类逻辑需要优化，请检查 normalize 和 segment prompt",
        );
      } else if (unknownRatio > 0.1) {
        add("unknown_ratio_check", "warning",
          `seg-unknown 占比 ${(unknownRatio * 100).toFixed(0)}% (${unknownFeedbackCount}/${totalFeedback})，超过 10% 阈值`,
          "seg-unknown 比例偏高，建议优化分类逻辑",
        );
      } else {
        add("unknown_ratio_check", "pass",
          `seg-unknown 占比 ${(unknownRatio * 100).toFixed(0)}% (${unknownFeedbackCount}/${totalFeedback})，在合理范围内`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 9. noise_business_opportunity_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters) {
    const noiseClusters = overallJson.issue_clusters.filter((c: any) => c.segment_id === "seg-noise");
    const violations = noiseClusters.filter((c: any) =>
      c.priority === "P0" || c.priority === "P1" ||
      (c.opportunity_score && c.opportunity_score > 0)
    );

    add("noise_business_opportunity_check",
      violations.length === 0 ? "pass" : "fail",
      violations.length === 0
        ? "seg-noise 未生成业务机会"
        : `seg-noise 错误地生成了业务机会: ${violations.map((v: any) => v.name).join(", ")}`,
      violations.length > 0 ? "seg-noise 不允许生成 P0/P1 或 opportunity_score" : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 9b. positive_business_opportunity_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters) {
    const positiveClusters = overallJson.issue_clusters.filter((c: any) => c.segment_id === "seg-positive");
    const violations = positiveClusters.filter((c: any) =>
      c.priority === "P0" || c.priority === "P1" ||
      (c.opportunity_score && c.opportunity_score > 0)
    );

    add("positive_business_opportunity_check",
      violations.length === 0 ? "pass" : "fail",
      violations.length === 0
        ? "seg-positive 未生成业务机会"
        : `seg-positive 错误地生成了业务机会: ${violations.map((v: any) => v.name).join(", ")}`,
      violations.length > 0 ? "seg-positive 不允许生成 P0/P1 或 opportunity_score" : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 10. evidence_trace_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters) {
    const normalizedMap = new Map<string, any>();
    for (const ni of normalizedItems) {
      if (ni.feedback_id) normalizedMap.set(ni.feedback_id, ni);
    }

    let missingCount = 0;
    let untraceableCount = 0;

    for (const cluster of overallJson.issue_clusters) {
      const ids = cluster.evidence_feedback_ids || [];
      for (const eid of ids) {
        const ni = normalizedMap.get(eid);
        if (!ni) {
          missingCount++;
          continue;
        }
        // Check that normalized item has trace back to raw
        if (!ni.raw_id && ni.raw_index === undefined) {
          untraceableCount++;
        }
      }
    }

    const allTraced = missingCount === 0 && untraceableCount === 0;
    add("evidence_trace_check",
      allTraced ? "pass" : "fail",
      allTraced
        ? "所有 evidence_feedback_ids 可追溯到 normalized_feedback → raw input"
        : `${missingCount} 个 evidence ID 不存在于 normalized, ${untraceableCount} 个 normalized item 无法追溯到 raw input`,
      !allTraced ? "evidence_feedback_ids 必须存在于 normalized_feedback 中，且每条 normalized 必须有 raw_id" : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 11. segment_analysis_json_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.segments) {
    const businessSegments = overallJson.segments.filter((s: any) => {
      const segId = s.segment_id;
      return segId !== "seg-noise" && segId !== "seg-unknown" && segId !== "seg-positive";
    });

    const missingJson: string[] = [];
    const missingMd: string[] = [];

    for (const seg of businessSegments) {
      const jsonFile = path.join(SEGMENTS_DIR, `${seg.segment_id}.analysis.json`);
      const mdFile = path.join(SEGMENTS_DIR, `${seg.segment_id}.analysis.md`);
      if (!fs.existsSync(jsonFile)) missingJson.push(seg.segment_id);
      if (!fs.existsSync(mdFile)) missingMd.push(seg.segment_id);
    }

    const allExist = missingJson.length === 0 && missingMd.length === 0;
    const missing = [...missingJson.map(s => `${s}.json`), ...missingMd.map(s => `${s}.md`)];
    add("segment_analysis_json_check",
      allExist ? "pass" : "fail",
      allExist
        ? `所有 ${businessSegments.length} 个业务 segment 均有 analysis.json 和 analysis.md`
        : `缺少 segment 分析文件: ${missing.join(", ")}`,
      !allExist ? "每个业务 segment 必须生成 analysis.json 和 analysis.md" : undefined,
    );
  }

  // 12. markdown_json_consistency_check — superseded by check 21 (segment_markdown_json_consistency_check)

  // ---------------------------------------------------------------------------
  // 13. empty_section_check (overall MD)
  // ---------------------------------------------------------------------------
  if (overallMd) {
    const requiredSections = [
      { name: "建议行动", pattern: /## [^\n]*建议[^\n]*/ },
      { name: "风险提醒", pattern: /## [^\n]*风险[^\n]*/ },
      { name: "需要进一步验证", pattern: /## [^\n]*验证[^\n]*/ },
      { name: "给老板看的摘要", pattern: /## [^\n]*老板[^\n]*/ },
    ];

    const emptySections: string[] = [];
    for (const sec of requiredSections) {
      const match = overallMd.match(sec.pattern);
      if (match) {
        const idx = overallMd.indexOf(match[0]);
        const rest = overallMd.substring(idx + match[0].length);
        const nextH2 = rest.match(/^## /m);
        const sectionText = nextH2 ? rest.substring(0, nextH2.index) : rest;
        if (sectionText.trim().length < 20) {
          emptySections.push(sec.name);
        }
      } else {
        emptySections.push(`${sec.name} (章节缺失)`);
      }
    }

    add("empty_section_check",
      emptySections.length === 0 ? "pass" : "fail",
      emptySections.length === 0
        ? "所有必要章节内容完整"
        : `以下章节内容为空或过短: ${emptySections.join(", ")}`,
      emptySections.length > 0 ? "建议行动、风险提醒、需要进一步验证的问题、老板摘要均不得为空" : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 14. placeholder_check
  // ---------------------------------------------------------------------------
  const allTextsToCheck: string[] = [];
  if (overallMd) allTextsToCheck.push(overallMd);
  if (fs.existsSync(SEGMENTS_DIR)) {
    for (const f of fs.readdirSync(SEGMENTS_DIR)) {
      if (f.endsWith(".analysis.md")) {
        allTextsToCheck.push(readTextSafe(path.join(SEGMENTS_DIR, f)));
      }
    }
  }

  const foundPlaceholders: string[] = [];
  for (const text of allTextsToCheck) {
    for (const p of PLACEHOLDERS) {
      if (text.includes(p) && !foundPlaceholders.includes(p)) {
        foundPlaceholders.push(p);
      }
    }
    // Check for standalone "X个" but not "XX个" (which is example text)
    if (/(?:^|[^X])X个/.test(text) && !foundPlaceholders.includes("X个")) {
      foundPlaceholders.push("X个");
    }
    // Check for "X步" and "Y步" placeholder patterns
    if (/(?:^|[^X])X步/.test(text) && !foundPlaceholders.includes("X步")) {
      foundPlaceholders.push("X步");
    }
    if (/Y步/.test(text) && !foundPlaceholders.includes("Y步")) {
      foundPlaceholders.push("Y步");
    }
  }

  add("placeholder_check",
    foundPlaceholders.length === 0 ? "pass" : "fail",
    foundPlaceholders.length === 0
      ? "未发现占位符"
      : `报告中发现占位符: ${foundPlaceholders.join(", ")}`,
    foundPlaceholders.length > 0 ? "所有 '待补充' / 'TODO' / 'TBD' 等占位符必须替换为实际内容" : undefined,
  );

  // ---------------------------------------------------------------------------
  // 15. structured_legacy_file_check
  // ---------------------------------------------------------------------------
  // Check if any legacy CSV exists AND is being referenced as raw input
  const legacyCwFiles = ["b2b-saas-renewal.csv", "b2b-saas-activation.csv", "ai-product-experience.csv",
    "bi-tool-renewal.csv", "ecommerce-conversion.csv", "internal-system-cost.csv"];

  const legacyPaths = [
    path.join(FIXTURES_DIR, "feedback"),
    path.join(FIXTURES_DIR, "raw-inputs"),
  ];

  let legacyUsedAsRaw = false;
  for (const dir of legacyPaths) {
    if (!fs.existsSync(dir)) continue;
    for (const f of legacyCwFiles) {
      if (fs.existsSync(path.join(dir, f))) {
        legacyUsedAsRaw = true;
        break;
      }
    }
  }

  // Also check: raw input header looks like old structured CSV
  const oldStructuredColumns = ["feedback_id,content,product_type", "feedback_id,content,business_goal",
    "feedback_id,content,expected_theme", "feedback_id,content,user_type"];
  const isOldStructured = oldStructuredColumns.some(col => header.includes(col));

  add("structured_legacy_file_check",
    !isOldStructured ? "pass" : "fail",
    isOldStructured
      ? `Raw input 文件疑似旧结构化 CSV (header: ${header.substring(0, 80)}...)`
      : "Raw input 不是旧结构化格式",
    isOldStructured
      ? "旧结构化 CSV 只能放在 fixtures/_legacy/ 目录下，不能作为真实 raw input 使用"
      : undefined,
    legacyUsedAsRaw ? { legacy_files_found: true } : undefined,
  );

  // ---------------------------------------------------------------------------
  // 16. ecommerce_feedback_count_vs_mention_count_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.segments) {
    const ecommerceSeg = overallJson.segments.find((s: any) => s.segment_id === "seg-ecommerce-conversion");
    if (ecommerceSeg) {
      const segClusters = overallJson.issue_clusters.filter((c: any) => c.segment_id === "seg-ecommerce-conversion");
      const clusterSum = segClusters.reduce((sum: number, c: any) => sum + (c.feedback_count || 0), 0);
      const segFeedbackCount = ecommerceSeg.feedback_count || 0;

      if (clusterSum !== segFeedbackCount) {
        add("ecommerce_feedback_count_vs_mention_count_check", "fail",
          `seg-ecommerce-conversion: Top问题反馈数加总 ${clusterSum} ≠ segment feedback_count ${segFeedbackCount}`,
          "segment 内 issue_clusters 的 feedback_count 之和必须等于 segment 的 feedback_count，不允许将 mention_count 混淆为 feedback_count",
          { segment_feedback_count: segFeedbackCount, cluster_sum: clusterSum },
        );
      } else {
        add("ecommerce_feedback_count_vs_mention_count_check", "pass",
          `seg-ecommerce-conversion: Top问题反馈数加总 ${clusterSum} = segment feedback_count ${segFeedbackCount}`,
        );
      }
    }
  }

  // 17. strong_claim_without_evidence_check — superseded by check 27 (enhanced)

  // ---------------------------------------------------------------------------
  // 18. missing_analysis_json_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.segments) {
    const businessSegs = overallJson.segments.filter((s: any) => {
      const segId = s.segment_id;
      return segId !== "seg-noise" && segId !== "seg-unknown" && segId !== "seg-positive";
    });

    const missingFiles: string[] = [];
    for (const seg of businessSegs) {
      const jsonFile = path.join(SEGMENTS_DIR, `${seg.segment_id}.analysis.json`);
      const mdFile = path.join(SEGMENTS_DIR, `${seg.segment_id}.analysis.md`);
      if (!fs.existsSync(jsonFile)) missingFiles.push(`${seg.segment_id}.analysis.json`);
      if (!fs.existsSync(mdFile)) missingFiles.push(`${seg.segment_id}.analysis.md`);
    }

    add("missing_analysis_json_check",
      missingFiles.length === 0 ? "pass" : "fail",
      missingFiles.length === 0
        ? `所有 ${businessSegs.length} 个业务 segment 均有完整的 analysis.json 和 analysis.md`
        : `缺少分析文件: ${missingFiles.join(", ")}`,
      missingFiles.length > 0 ? "每个业务 segment 必须同时生成 analysis.json 和 analysis.md" : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 19. unsupported_metric_value_check
  // ---------------------------------------------------------------------------
  const unsupportedMetricPatterns = [
    { pattern: /99\.5%/, desc: "99.5%目标" },
    { pattern: /99%/, desc: "99%目标" },
    { pattern: /<\s*2\s*秒/, desc: "<2秒目标" },
    { pattern: /提升至\d{2,}%/, desc: "提升至X%目标" },
    { pattern: /降低\d{2,}%/, desc: "降低X%目标" },
  ];

  const foundUnsupportedMetrics: string[] = [];
  for (const text of allTextsToCheck) {
    for (const { pattern, desc } of unsupportedMetricPatterns) {
      if (pattern.test(text) && !foundUnsupportedMetrics.includes(desc)) {
        foundUnsupportedMetrics.push(desc);
      }
    }
  }

  add("unsupported_metric_value_check",
    foundUnsupportedMetrics.length === 0 ? "pass" : "warning",
    foundUnsupportedMetrics.length === 0
      ? "报告中未发现无基线支撑的具体目标值"
      : `报告中发现可能缺乏基线支撑的具体目标值: ${foundUnsupportedMetrics.join(", ")}`,
    foundUnsupportedMetrics.length > 0 ? "具体目标值（如99%、<2秒）需结合当前基线、日志和A/B测试确定，不应凭空设定" : undefined,
  );

  // ---------------------------------------------------------------------------
  // 20. overall_markdown_json_consistency_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallMd) {
    const jsonS = overallJson.summary || {};
    const mismatches: string[] = [];

    // Extract numbers from overall MD
    const mdNum = (label: string): number | null => {
      const re = new RegExp(label + "[：:]\\s*(\\d+)");
      const m = overallMd.match(re);
      return m ? parseInt(m[1], 10) : null;
    };

    const fieldMap: [string, string][] = [
      ["原始反馈数量", "total_feedback_count"],
      ["实际分析数量", "analyzed_feedback_count"],
      ["已归类反馈数量", "clustered_feedback_count"],
      ["未归类反馈数量", "unclustered_feedback_count"],
      ["识别出的主要分组", "segment_count"],
      ["业务分组数量", "business_segment_count"],
      ["噪声分组数量", "noise_segment_count"],
    ];

    for (const [mdLabel, jsonKey] of fieldMap) {
      const mdVal = mdNum(mdLabel);
      const jsonVal = jsonS[jsonKey];
      if (mdVal !== null && jsonVal !== undefined && mdVal !== jsonVal) {
        mismatches.push(`${mdLabel}: MD=${mdVal}, JSON=${jsonVal}`);
      }
    }

    // Check each segment.feedback_count
    if (overallJson.segments) {
      for (const seg of overallJson.segments) {
        const segName = seg.name;
        const segCount = seg.feedback_count;
        // Look for "- **{name}**：{N} 条反馈" in MD
        const segRe = new RegExp(`\\*\\*${escRegex(segName)}\\*\\*[：:]\\s*(\\d+)\\s*条反馈`);
        const segMatch = overallMd.match(segRe);
        if (segMatch) {
          const mdSegCount = parseInt(segMatch[1], 10);
          if (mdSegCount !== segCount) {
            mismatches.push(`${segName}: MD=${mdSegCount}, JSON=${segCount}`);
          }
        }
      }
    }

    add("overall_markdown_json_consistency_check",
      mismatches.length === 0 ? "pass" : "fail",
      mismatches.length === 0
        ? "overall.analysis.md 与 overall.analysis.json 数据一致"
        : `overall MD 与 JSON 不一致: ${mismatches.join("; ")}`,
      mismatches.length > 0 ? "overall.analysis.md 必须从 overall.analysis.json 自动渲染，不允许手写数量" : undefined,
      mismatches.length > 0 ? { mismatches } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 21. segment_markdown_json_consistency_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const segJsonFiles = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"));
    const segMismatches: string[] = [];

    for (const jf of segJsonFiles) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson || !segJson.issue_clusters) continue;

      const mdFile = jf.replace(".analysis.json", ".analysis.md");
      const mdContent = readTextSafe(path.join(SEGMENTS_DIR, mdFile));
      if (!mdContent) {
        segMismatches.push(`${jf}: missing .md`);
        continue;
      }

      const segId = segJson.segment_id;
      const clusters: any[] = segJson.issue_clusters;

      // Check cluster names
      for (const c of clusters) {
        if (c.name && !mdContent.includes(c.name)) {
          segMismatches.push(`${segId}: cluster "${c.name}" not found in MD`);
        }
      }

      // Check feedback_count
      const s = segJson.summary || {};
      const mdFeedbackMatch = mdContent.match(/反馈数量[：:]\s*(\d+)/);
      if (mdFeedbackMatch) {
        const mdCount = parseInt(mdFeedbackMatch[1], 10);
        if (mdCount !== s.feedback_count) {
          segMismatches.push(`${segId}: feedback_count MD=${mdCount}, JSON=${s.feedback_count}`);
        }
      }

      // Check cluster_count
      const mdClusterMatch = mdContent.match(/问题聚类数量[：:]\s*(\d+)/);
      if (mdClusterMatch) {
        const mdClusterCount = parseInt(mdClusterMatch[1], 10);
        if (mdClusterCount !== s.cluster_count) {
          segMismatches.push(`${segId}: cluster_count MD=${mdClusterCount}, JSON=${s.cluster_count}`);
        }
      }

      // Check priority and opportunity_score in MD
      for (const c of clusters) {
        if (c.priority) {
          const prioRe = new RegExp(`${escRegex(c.name)}[\\s\\S]*?优先级[：:]\\s*${escRegex(c.priority)}`);
          if (!prioRe.test(mdContent) && !mdContent.includes(`优先级：${c.priority}`)) {
            // Soft check — just verify priority value appears near the cluster
          }
        }
      }
    }

    add("segment_markdown_json_consistency_check",
      segMismatches.length === 0 ? "pass" : "fail",
      segMismatches.length === 0
        ? "所有 segment 的 Markdown 与 JSON 完全一致"
        : `segment MD/JSON 不一致: ${segMismatches.join("; ")}`,
      segMismatches.length > 0 ? "segment Markdown 必须从 analysis.json 自动渲染" : undefined,
      segMismatches.length > 0 ? { mismatches: segMismatches } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 22. evidence_count_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters) {
    const evidenceMismatches: string[] = [];

    for (const cluster of overallJson.issue_clusters) {
      const feedbackCount = cluster.feedback_count || 0;
      const evidenceIds = cluster.evidence_feedback_ids || [];
      if (feedbackCount !== evidenceIds.length) {
        evidenceMismatches.push(
          `${cluster.cluster_id}: feedback_count=${feedbackCount}, evidence_feedback_ids.length=${evidenceIds.length}`
        );
      }
    }

    // Also check segment JSONs
    if (fs.existsSync(SEGMENTS_DIR)) {
      for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
        const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
        if (!segJson || !segJson.issue_clusters) continue;
        for (const c of segJson.issue_clusters) {
          const fc = c.feedback_count || 0;
          const eids = c.evidence_feedback_ids || [];
          if (fc !== eids.length) {
            evidenceMismatches.push(
              `${segJson.segment_id}/${c.cluster_id}: feedback_count=${fc}, evidence.length=${eids.length}`
            );
          }
        }
      }
    }

    add("evidence_count_check",
      evidenceMismatches.length === 0 ? "pass" : "fail",
      evidenceMismatches.length === 0
        ? "所有 issue_cluster 的 feedback_count 与 evidence_feedback_ids.length 一致"
        : `feedback_count ≠ evidence_feedback_ids.length: ${evidenceMismatches.join("; ")}`,
      evidenceMismatches.length > 0 ? "feedback_count 必须等于 evidence_feedback_ids.length，不允许 mention_count 混淆为 feedback_count" : undefined,
      evidenceMismatches.length > 0 ? { mismatches: evidenceMismatches } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 23. duplicate_feedback_assignment_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const feedbackToSegments = new Map<string, string[]>();
    const segJsonFiles = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"));

    for (const jf of segJsonFiles) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson || !segJson.issue_clusters) continue;
      const segId = segJson.segment_id;

      for (const c of segJson.issue_clusters) {
        for (const eid of (c.evidence_feedback_ids || [])) {
          if (!feedbackToSegments.has(eid)) feedbackToSegments.set(eid, []);
          feedbackToSegments.get(eid)!.push(segId);
        }
      }
    }

    const duplicates: string[] = [];
    for (const [fbId, segIds] of feedbackToSegments) {
      const uniqueSegs = [...new Set(segIds)];
      if (uniqueSegs.length > 1) {
        duplicates.push(`${fbId} → [${uniqueSegs.join(", ")}]`);
      }
    }

    add("duplicate_feedback_assignment_check",
      duplicates.length === 0 ? "pass" : "fail",
      duplicates.length === 0
        ? "所有 feedback_id 仅属于一个 primary segment"
        : `以下 feedback_id 出现在多个 segment 中: ${duplicates.join("; ")}`,
      duplicates.length > 0 ? "每个 feedback_id 只能属于一个 primary segment，不允许跨 segment 重复" : undefined,
      duplicates.length > 0 ? { duplicates } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 24. missing_segment_json_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const allSegFiles = fs.readdirSync(SEGMENTS_DIR);
    const mdFiles = allSegFiles.filter(f => f.endsWith(".analysis.md"));
    const jsonFiles = allSegFiles.filter(f => f.endsWith(".analysis.json"));

    const missingJson: string[] = [];
    for (const md of mdFiles) {
      const correspondingJson = md.replace(".analysis.md", ".analysis.json");
      if (!jsonFiles.includes(correspondingJson)) {
        missingJson.push(correspondingJson);
      }
    }

    add("missing_segment_json_check",
      missingJson.length === 0 ? "pass" : "fail",
      missingJson.length === 0
        ? `所有 ${mdFiles.length} 个 segment MD 均有对应的 analysis.json`
        : `缺少 segment JSON 文件: ${missingJson.join(", ")}`,
      missingJson.length > 0 ? "每个 segment Markdown 必须有对应的 analysis.json" : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 25. global_cluster_id_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters) {
    const clusterIds = overallJson.issue_clusters.map((c: any) => c.cluster_id);
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const cid of clusterIds) {
      if (seen.has(cid)) duplicates.push(cid);
      seen.add(cid);
    }

    // Also check for bare "cluster-NNN" format (not prefixed with segment_id)
    const bareIds = clusterIds.filter((id: string) => /^cluster-\d+$/.test(id));

    const issues = [...duplicates];
    const hasBareIds = bareIds.length > 0 && bareIds.length < clusterIds.length;

    add("global_cluster_id_check",
      duplicates.length === 0 ? "pass" : "fail",
      duplicates.length === 0
        ? `所有 ${clusterIds.length} 个 cluster_id 全局唯一`
        : `重复的 cluster_id: ${duplicates.join(", ")}`,
      duplicates.length > 0 ? "overall.issue_clusters 中每个 cluster_id 必须全局唯一，推荐格式: seg-{segment}-cluster-{NNN}" : undefined,
      duplicates.length > 0 ? { duplicates, bare_ids: bareIds } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 26. duplicate_cluster_name_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const segJsonFiles = fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"));
    const nameWarnings: string[] = [];

    for (const jf of segJsonFiles) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson || !segJson.issue_clusters) continue;

      const clusters: any[] = segJson.issue_clusters;
      const names = clusters.map(c => c.name || "");

      // Exact duplicates
      const seen = new Set<string>();
      for (const name of names) {
        if (seen.has(name)) {
          nameWarnings.push(`${segJson.segment_id}: 重复 cluster 名称 "${name}"`);
        }
        seen.add(name);
      }

      // Similar names (Levenshtein-like: same after removing spaces/punctuation)
      const normalize = (s: string) => s.replace(/[\s,，、。.!！?？：:;；（）()]/g, "");
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          if (normalize(names[i]) === normalize(names[j]) && names[i] !== names[j]) {
            nameWarnings.push(`${segJson.segment_id}: 高度相似 cluster 名称 "${names[i]}" vs "${names[j]}"`);
          }
        }
      }
    }

    add("duplicate_cluster_name_check",
      nameWarnings.length === 0 ? "pass" : "warning",
      nameWarnings.length === 0
        ? "同一 segment 内无重复或高度相似的 cluster 名称"
        : `发现重复/相似 cluster 名称: ${nameWarnings.join("; ")}`,
      nameWarnings.length > 0 ? "同一 segment 内 cluster 名称不应重复或高度相似，如指向同一问题建议合并" : undefined,
      nameWarnings.length > 0 ? { warnings: nameWarnings } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 27. strong_claim_without_evidence_check (enhanced)
  // ---------------------------------------------------------------------------
  {
    const strongClaimPatterns = [
      { pattern: /彻底摧毁/, desc: "彻底摧毁" },
      { pattern: /致命/, desc: "致命" },
      { pattern: /直接导致/, desc: "直接导致" },
      { pattern: /从根本上动摇/, desc: "从根本上动摇" },
      { pattern: /年度核心目标无法达成/, desc: "年度核心目标无法达成" },
      { pattern: /高层问责/, desc: "高层问责" },
      { pattern: /资源黑洞/, desc: "资源黑洞" },
      { pattern: /必然/, desc: "必然" },
      { pattern: /立竿见影/, desc: "立竿见影" },
      { pattern: /提升\d{2,}%/, desc: "具体百分比提升" },
      { pattern: /降低\d{2,}%/, desc: "具体百分比降低" },
      { pattern: /增长\d{2,}%/, desc: "具体百分比增长" },
      { pattern: /损失\d{2,}%/, desc: "具体百分比损失" },
      { pattern: /翻倍/, desc: "翻倍" },
      { pattern: /三倍/, desc: "三倍" },
      { pattern: /五倍/, desc: "五倍" },
      { pattern: /严重威胁/, desc: "严重威胁" },
      { pattern: /严重削弱/, desc: "严重削弱" },
      { pattern: /毁灭性/, desc: "毁灭性" },
      { pattern: /大规模流失/, desc: "大规模流失" },
      { pattern: /严重流失/, desc: "严重流失" },
    ];

    const foundStrongClaims: { desc: string; file: string }[] = [];
    for (const text of allTextsToCheck) {
      const fileName = text === overallMd ? "overall.analysis.md" : "segment MD";
      for (const { pattern, desc } of strongClaimPatterns) {
        if (pattern.test(text)) {
          foundStrongClaims.push({ desc, file: fileName });
        }
      }
    }

    const uniqueClaims = [...new Set(foundStrongClaims.map(c => c.desc))];

    add("strong_claim_without_evidence_check",
      uniqueClaims.length === 0 ? "pass" : "warning",
      uniqueClaims.length === 0
        ? "报告中未发现缺乏数据支撑的强断言"
        : `报告中发现可能缺乏数据支撑的强断言: ${uniqueClaims.join(", ")}`,
      uniqueClaims.length > 0
        ? "建议改写为：'可能影响目标，需要结合留存率、使用频次、满意度、日志或 A/B 测试进一步验证。'"
        : undefined,
      uniqueClaims.length > 0 ? { claims: foundStrongClaims } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 28. overall_business_issue_count_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallMd) {
    const nonBizSegs = new Set(["seg-noise", "seg-positive", "seg-unknown"]);
    const bizClusters = overallJson.issue_clusters.filter((c: any) => !nonBizSegs.has(c.segment_id));
    const nonBizClusters = overallJson.issue_clusters.filter((c: any) => nonBizSegs.has(c.segment_id));

    // Check that overall MD mentions business cluster count
    const mdHasBizCount = overallMd.includes(`${bizClusters.length} 个为业务问题聚类`);
    const mdHasNonBizCount = overallMd.includes(`${nonBizClusters.length} 个为非业务处理类聚类`);
    const mdHasTotal = overallMd.includes(`共识别出 ${overallJson.issue_clusters.length} 个聚类`);

    const issues: string[] = [];
    if (!mdHasTotal) issues.push(`MD 未提及总聚类数 ${overallJson.issue_clusters.length}`);
    if (!mdHasBizCount) issues.push(`MD 未提及业务聚类数 ${bizClusters.length}`);
    if (!mdHasNonBizCount) issues.push(`MD 未提及非业务聚类数 ${nonBizClusters.length}`);

    add("overall_business_issue_count_check",
      issues.length === 0 ? "pass" : "fail",
      issues.length === 0
        ? `overall 区分总聚类 ${overallJson.issue_clusters.length}、业务 ${bizClusters.length}、非业务 ${nonBizClusters.length}`
        : `overall 未正确区分聚类类型: ${issues.join("; ")}`,
      issues.length > 0 ? "overall 必须区分总聚类数量、业务聚类数量、非业务处理类聚类数量" : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 29. report_structure_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const requiredSections = [
      { name: "分析范围", pattern: /## [^\n]*分析范围/ },
      { name: "核心结论", pattern: /## [^\n]*核心结论/ },
      { name: "高频问题", pattern: /## [^\n]*高频问题/ },
      { name: "高优先级机会", pattern: /## [^\n]*高优先级机会/ },
      { name: "问题详情", pattern: /## [^\n]*问题详情/ },
      { name: "建议行动", pattern: /## [^\n]*建议行动/ },
      { name: "风险提醒", pattern: /## [^\n]*风险提醒/ },
      { name: "需要进一步验证", pattern: /## [^\n]*验证/ },
      { name: "给老板看的摘要", pattern: /## [^\n]*老板/ },
    ];

    const nonBizSegIds = new Set(["seg-noise", "seg-positive", "seg-unknown"]);
    const structureIssues: string[] = [];

    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson || nonBizSegIds.has(segJson.segment_id)) continue;

      const mdFile = path.join(SEGMENTS_DIR, jf.replace(".analysis.json", ".analysis.md"));
      const mdContent = readTextSafe(mdFile);
      if (!mdContent) {
        structureIssues.push(`${segJson.segment_id}: missing MD`);
        continue;
      }

      for (const sec of requiredSections) {
        if (!sec.pattern.test(mdContent)) {
          structureIssues.push(`${segJson.segment_id}: missing section "${sec.name}"`);
        }
      }
    }

    add("report_structure_check",
      structureIssues.length === 0 ? "pass" : "fail",
      structureIssues.length === 0
        ? "所有业务 segment MD 包含完整的报告结构"
        : `业务 segment 报告结构不完整: ${structureIssues.join("; ")}`,
      structureIssues.length > 0 ? "业务 segment MD 必须包含：分析范围、核心结论、高频问题、高优先级机会、问题详情、建议行动、风险提醒、需要进一步验证、给老板看的摘要" : undefined,
      structureIssues.length > 0 ? { issues: structureIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 30. evidence_trace_file_check
  // ---------------------------------------------------------------------------
  {
    const rawPath = path.join(RAW_INPUTS_DIR, `${dataset}.csv`);
    const normalizedPath = path.join(NORMALIZED_DIR, `${dataset}.normalized.json`);
    const segmentsJsonPath = path.join(ANALYSIS_DIR, `${dataset}.segments.json`);

    const missingFiles: string[] = [];
    if (!fs.existsSync(rawPath)) missingFiles.push(`${dataset}.csv`);
    if (!fs.existsSync(normalizedPath)) missingFiles.push(`${dataset}.normalized.json`);
    if (!fs.existsSync(segmentsJsonPath)) missingFiles.push(`${dataset}.segments.json`);

    // Verify chain: evidence_feedback_ids → normalized → raw
    let chainBroken = false;
    let chainDetails = "";

    if (fs.existsSync(normalizedPath) && fs.existsSync(SEGMENTS_DIR)) {
      const normalizedItems: any[] = readJsonSafe(normalizedPath) || [];
      const normalizedMap = new Map<string, any>();
      for (const ni of normalizedItems) {
        if (ni.feedback_id) normalizedMap.set(ni.feedback_id, ni);
      }

      let missingFromNormalized = 0;
      let missingRawTrace = 0;

      for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
        const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
        if (!segJson || !segJson.issue_clusters) continue;
        for (const c of segJson.issue_clusters) {
          for (const eid of (c.evidence_feedback_ids || [])) {
            const ni = normalizedMap.get(eid);
            if (!ni) {
              missingFromNormalized++;
              continue;
            }
            if (!ni.raw_id && ni.raw_index === undefined) {
              missingRawTrace++;
            }
          }
        }
      }

      if (missingFromNormalized > 0 || missingRawTrace > 0) {
        chainBroken = true;
        chainDetails = `${missingFromNormalized} evidence IDs not in normalized, ${missingRawTrace} normalized items missing raw trace`;
      }
    }

    const allPass = missingFiles.length === 0 && !chainBroken;
    add("evidence_trace_file_check",
      allPass ? "pass" : "fail",
      allPass
        ? "evidence 追溯链路完整: raw → normalized → segment json → evidence_feedback_ids"
        : `evidence 追溯链路不完整: ${missingFiles.length > 0 ? "缺少文件 " + missingFiles.join(", ") : ""} ${chainBroken ? chainDetails : ""}`.trim(),
      !allPass ? "必须确保 raw input、normalized、segments.json 文件存在，且 evidence 可追溯到 raw" : undefined,
      !allPass ? { missing_files: missingFiles, chain_broken: chainBroken, chain_details: chainDetails } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 31. duplicate_cluster_boundary_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const boundaryIssues: string[] = [];

    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson || !segJson.issue_clusters) continue;

      const clusters: any[] = segJson.issue_clusters;

      // Check for overlapping evidence between clusters
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const idsA = new Set(clusters[i].evidence_feedback_ids || []);
          const idsB = new Set(clusters[j].evidence_feedback_ids || []);
          const overlap = [...idsA].filter(id => idsB.has(id));
          if (overlap.length > 0) {
            boundaryIssues.push(
              `${segJson.segment_id}: "${clusters[i].name}" 与 "${clusters[j].name}" 共享 ${overlap.length} 条证据 [${overlap.join(", ")}]`
            );
          }
        }
      }
    }

    add("duplicate_cluster_boundary_check",
      boundaryIssues.length === 0 ? "pass" : "fail",
      boundaryIssues.length === 0
        ? "同一 segment 内 cluster 之间无证据重叠"
        : `cluster 边界重叠: ${boundaryIssues.join("; ")}`,
      boundaryIssues.length > 0 ? "同一 segment 内不同 cluster 的 evidence_feedback_ids 不应重叠，如指向同一问题建议合并" : undefined,
      boundaryIssues.length > 0 ? { issues: boundaryIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 32. overall_risk_quality_check
  // ---------------------------------------------------------------------------
  if (overallMd) {
    const riskMatch = overallMd.match(/## [^\n]*风险提醒[\s\S]*?(?=\n## |\n$)/);
    const issues: string[] = [];

    if (riskMatch) {
      const riskSection = riskMatch[0];

      // Check for template-like repetition
      const lines = riskSection.split("\n").filter(l => l.startsWith("- **"));
      const uniqueLines = new Set(lines.map(l => l.replace(/- \*\*[^*]+\*\*[：:]/, "").trim()));

      if (lines.length > 3 && uniqueLines.size <= 1) {
        issues.push("所有分组的风险提醒内容相同，疑似模板化");
      }

      // Check for generic phrases
      const genericPhrases = [
        "需要验证问题的真实影响范围和用户容忍度",
        "需要进一步验证",
        "需要关注",
      ];
      const genericCount = genericPhrases.filter(p => riskSection.includes(p)).length;
      if (genericCount >= 2 && lines.length > 3) {
        issues.push("风险提醒使用了过多通用表述，缺少业务针对性");
      }
    }

    add("overall_risk_quality_check",
      issues.length === 0 ? "pass" : "warning",
      issues.length === 0
        ? "overall 风险提醒内容有业务针对性"
        : `overall 风险提醒质量不足: ${issues.join("; ")}`,
      issues.length > 0 ? "风险提醒应按业务目标分别生成具体风险，避免所有分组使用相同模板" : undefined,
      issues.length > 0 ? { issues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 33. further_validation_question_quality_check
  // ---------------------------------------------------------------------------
  if (overallMd) {
    const fvMatch = overallMd.match(/## [^\n]*需要进一步验证[\s\S]*?(?=\n## |\n$)/);
    const issues: string[] = [];

    if (fvMatch) {
      const fvSection = fvMatch[0];
      const questions = fvSection.split("\n").filter(l => l.startsWith("- "));

      // Check for vague questions (no question mark, no specific metric)
      const vagueQuestions = questions.filter(q => !q.includes("？") && !q.includes("?"));
      if (vagueQuestions.length > questions.length / 2) {
        issues.push(`${vagueQuestions.length}/${questions.length} 个问题缺少具体可验证的问句`);
      }

      // Check for template-like questions
      const genericTemplates = [
        "需要进一步验证问题的实际影响范围",
        "需要进一步验证",
      ];
      const genericQs = questions.filter(q => genericTemplates.some(t => q.includes(t)));
      if (genericQs.length > 1) {
        issues.push("进一步验证问题使用了过多模板化表述");
      }

      // Check questions mention specific metrics or scenarios
      const specificKeywords = ["影响", "比例", "集中", "趋势", "差距", "多少", "哪个", "是否"];
      const specificQs = questions.filter(q => specificKeywords.some(k => q.includes(k)));
      if (questions.length > 2 && specificQs.length < questions.length / 2) {
        issues.push("进一步验证问题缺少具体指标或场景，不够可操作");
      }
    }

    add("further_validation_question_quality_check",
      issues.length === 0 ? "pass" : "warning",
      issues.length === 0
        ? "进一步验证问题具体、可操作"
        : `进一步验证问题质量不足: ${issues.join("; ")}`,
      issues.length > 0 ? "进一步验证问题应具体可验证，包含具体指标或场景，例如：'性能问题对激活完成率影响有多大？'" : undefined,
      issues.length > 0 ? { issues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 34. top_n_explanation_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const nonBizSegIds = new Set(["seg-noise", "seg-positive", "seg-unknown"]);
    const topNIssues: string[] = [];

    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson || nonBizSegIds.has(segJson.segment_id)) continue;

      const mdFile = path.join(SEGMENTS_DIR, jf.replace(".analysis.json", ".analysis.md"));
      const mdContent = readTextSafe(mdFile);
      if (!mdContent) continue;

      // Check if MD uses "高频问题概览" or "高频问题 Top N"
      const hasOverview = /高频问题概览/.test(mdContent);
      const hasTopN = /高频问题 Top \d+/.test(mdContent);

      if (hasTopN) {
        // If using Top N, must have explanation
        const hasExplanation = /说明/.test(mdContent) || /其余问题见/.test(mdContent);
        if (!hasExplanation) {
          topNIssues.push(`${segJson.segment_id}: 使用 "Top N" 但未说明其余问题在哪里`);
        }
      }

      // If using 概览, should have explanation too
      if (hasOverview) {
        const hasExplanation = /说明/.test(mdContent) || /其余问题见/.test(mdContent);
        if (!hasExplanation) {
          topNIssues.push(`${segJson.segment_id}: 使用 "高频问题概览" 但未说明其余问题在哪里`);
        }
      }
    }

    add("top_n_explanation_check",
      topNIssues.length === 0 ? "pass" : "warning",
      topNIssues.length === 0
        ? "所有业务 segment 的高频问题章节有明确说明"
        : `高频问题章节缺少说明: ${topNIssues.join("; ")}`,
      topNIssues.length > 0 ? "高频问题章节应说明本节展示的问题数量和其余问题的位置" : undefined,
      topNIssues.length > 0 ? { issues: topNIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 35. overall_summary_completeness_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallMd) {
    const summaryIssues: string[] = [];
    const s = overallJson.summary || {};

    // Check that overall MD mentions all segment type counts
    const checks: [string, string][] = [
      ["business_segment_count", "业务分组数量"],
      ["noise_segment_count", "噪声分组数量"],
      ["positive_segment_count", "正向反馈分组数量"],
      ["unknown_segment_count", "未分类分组数量"],
      ["non_business_segment_count", "非业务处理类分组数量"],
    ];

    for (const [key, label] of checks) {
      const val = s[key];
      if (val !== undefined && !overallMd.includes(`${label}：${val}`) && !overallMd.includes(`${label}:${val}`)) {
        summaryIssues.push(`JSON 有 ${key}=${val} 但 MD 未提及 ${label}`);
      }
    }

    add("overall_summary_completeness_check",
      summaryIssues.length === 0 ? "pass" : "warning",
      summaryIssues.length === 0
        ? "overall summary 包含所有分组类型计数"
        : `overall summary 不完整: ${summaryIssues.join("; ")}`,
      summaryIssues.length > 0 ? "overall summary 应包含 business/noise/positive/unknown/non-business 各类型计数" : undefined,
      summaryIssues.length > 0 ? { issues: summaryIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 36. boss_summary_quality_check
  // ---------------------------------------------------------------------------
  if (overallMd) {
    const bossMatch = overallMd.match(/## [^\n]*给老板看的摘要[\s\S]*/);
    const issues: string[] = [];

    if (bossMatch) {
      const bossSection = bossMatch[0];

      // Check for required business judgment sections
      const requiredParts = ["核心问题", "直接后果", "关键机会", "建议"];
      const missingParts = requiredParts.filter(p => !bossSection.includes(p));
      if (missingParts.length > 0) {
        issues.push(`老板摘要缺少: ${missingParts.join(", ")}`);
      }

      // Check for generic/vague content
      const genericPhrases = [
        "建议优先处理跨分组高优先级问题",
        "需要进一步验证",
        "需要关注",
      ];
      const hasOnlyGeneric = genericPhrases.some(p => bossSection.trim().endsWith(p));
      if (hasOnlyGeneric && bossSection.length < 200) {
        issues.push("老板摘要过于泛泛，缺少具体业务判断");
      }

      // Check minimum length (should have substantive content)
      if (bossSection.length < 100) {
        issues.push("老板摘要内容过短，缺少业务分析");
      }
    } else {
      issues.push("未找到老板摘要章节");
    }

    add("boss_summary_quality_check",
      issues.length === 0 ? "pass" : "warning",
      issues.length === 0
        ? "老板摘要包含业务判断"
        : `老板摘要质量不足: ${issues.join("; ")}`,
      issues.length > 0 ? "老板摘要应包含核心问题、直接后果、关键机会、建议四个部分，有具体业务判断" : undefined,
      issues.length > 0 ? { issues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 37. overall_segment_score_consistency_check
  // ---------------------------------------------------------------------------
  if (overallJson && fs.existsSync(SEGMENTS_DIR)) {
    const overallClusterMap = new Map<string, any>();
    for (const c of overallJson.issue_clusters || []) {
      overallClusterMap.set(c.cluster_id, c);
    }

    const consistencyIssues: string[] = [];
    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson) continue;
      const segId = segJson.segment_id;
      const segType = segJson.segment_type || "unknown";
      const nonBizIds = new Set(["seg-noise", "seg-positive", "seg-unknown"]);

      for (const sc of segJson.issue_clusters || []) {
        const localId = sc.cluster_id;
        // segment JSON cluster_id is already global format (canonicalized)
        const oc = overallClusterMap.get(localId) || overallClusterMap.get(`${segId}-${localId}`);
        if (!oc) {
          consistencyIssues.push(`${segId}/${localId}: not found in overall`);
          continue;
        }
        if (sc.name !== oc.name) {
          consistencyIssues.push(`${segId}/${localId}: name mismatch seg="${sc.name}" vs overall="${oc.name}"`);
        }
        if (sc.opportunity_score !== oc.opportunity_score) {
          consistencyIssues.push(`${segId}/${localId}: score mismatch seg=${sc.opportunity_score} vs overall=${oc.opportunity_score}`);
        }
      }
    }

    add("overall_segment_score_consistency_check",
      consistencyIssues.length === 0 ? "pass" : "fail",
      consistencyIssues.length === 0
        ? "overall 与 segment JSON 的 cluster name 和 opportunity_score 完全一致"
        : `overall 与 segment JSON 不一致: ${consistencyIssues.join("; ")}`,
      consistencyIssues.length > 0 ? "overall JSON 必须从 segment JSON 构建，确保数据源统一" : undefined,
      consistencyIssues.length > 0 ? { issues: consistencyIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 38. cluster_name_consistency_check (MD vs JSON)
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const nameIssues: string[] = [];
    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson) continue;
      const mdFile = path.join(SEGMENTS_DIR, jf.replace(".analysis.json", ".analysis.md"));
      const mdContent = readTextSafe(mdFile);
      if (!mdContent) continue;

      for (const c of segJson.issue_clusters || []) {
        if (!mdContent.includes(c.name)) {
          nameIssues.push(`${segJson.segment_id}/${c.cluster_id}: "${c.name}" not in MD`);
        }
      }
    }

    // Also check overall
    if (overallJson && overallMd) {
      for (const c of overallJson.issue_clusters || []) {
        if (!overallMd.includes(c.name)) {
          nameIssues.push(`overall/${c.cluster_id}: "${c.name}" not in MD`);
        }
      }
    }

    add("cluster_name_consistency_check",
      nameIssues.length === 0 ? "pass" : "fail",
      nameIssues.length === 0
        ? "所有 cluster name 在 JSON 和 MD 中完全一致"
        : `cluster name 不一致: ${nameIssues.join("; ")}`,
      nameIssues.length > 0 ? "MD 必须从 JSON 渲染，确保 cluster name 完全一致" : undefined,
      nameIssues.length > 0 ? { issues: nameIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 39. global_priority_ranking_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallMd) {
    const nonBizSegIds = new Set(["seg-noise", "seg-positive", "seg-unknown"]);
    const bizClusters = (overallJson.issue_clusters || []).filter((c: any) => !nonBizSegIds.has(c.segment_id));
    const rankIssues: string[] = [];

    // Check if Top 3 in overall MD contains 1-feedback clusters
    const top3Match = overallMd.match(/## [^\n]*整体核心结论[\s\S]*?(?=\n## |\n$)/);
    if (top3Match) {
      const top3Section = top3Match[0];
      const top3Lines = top3Section.split("\n").filter(l => /^\d+\./.test(l.trim()));
      for (const line of top3Lines) {
        // Find which cluster this refers to
        for (const c of bizClusters) {
          if (line.includes(c.name) && c.feedback_count <= 1) {
            rankIssues.push(`"${c.name}" 仅 ${c.feedback_count} 条反馈，不应进入全局 Top 3`);
          }
        }
      }
    }

    add("global_priority_ranking_check",
      rankIssues.length === 0 ? "pass" : "warning",
      rankIssues.length === 0
        ? "全局 Top 3 排名合理，无低证据问题占据高位"
        : `全局排名问题: ${rankIssues.join("; ")}`,
      rankIssues.length > 0 ? "feedback_count=1 的问题不应进入 overall Top 3，除非有明确阻断性说明" : undefined,
      rankIssues.length > 0 ? { issues: rankIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 40. top_n_less_than_3_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const topNIssues2: string[] = [];
    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson) continue;
      const n = (segJson.issue_clusters || []).length;
      if (n < 3) {
        const mdFile = path.join(SEGMENTS_DIR, jf.replace(".analysis.json", ".analysis.md"));
        const mdContent = readTextSafe(mdFile);
        if (mdContent && /Top 3/.test(mdContent)) {
          topNIssues2.push(`${segJson.segment_id}: ${n} clusters but MD says "Top 3"`);
        }
      }
    }

    // Also check overall
    if (overallMd) {
      const nonBizSegIds2 = new Set(["seg-noise", "seg-positive", "seg-unknown"]);
      const bizCount = (overallJson?.issue_clusters || []).filter((c: any) => !nonBizSegIds2.has(c.segment_id)).length;
      if (bizCount < 3 && /Top 3/.test(overallMd)) {
        topNIssues2.push(`overall: ${bizCount} business clusters but MD says "Top 3"`);
      }
    }

    add("top_n_less_than_3_check",
      topNIssues2.length === 0 ? "pass" : "fail",
      topNIssues2.length === 0
        ? "聚类数 < 3 时未使用 Top 3 表述"
        : `聚类数不足时使用了 Top 3: ${topNIssues2.join("; ")}`,
      topNIssues2.length > 0 ? "当聚类数 < 3 时，应使用'以下按机会分排序展示全部问题'而非 Top N" : undefined,
      topNIssues2.length > 0 ? { issues: topNIssues2 } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 41. no_validation_needed_phrase_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const phraseIssues: string[] = [];
    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.md"))) {
      const mdContent = readTextSafe(path.join(SEGMENTS_DIR, jf));
      if (mdContent.includes("暂无需额外验证")) {
        phraseIssues.push(jf.replace(".analysis.md", ""));
      }
    }
    if (overallMd && overallMd.includes("暂无需额外验证")) {
      phraseIssues.push("overall");
    }

    add("no_validation_needed_phrase_check",
      phraseIssues.length === 0 ? "pass" : "fail",
      phraseIssues.length === 0
        ? "未出现'暂无需额外验证'表述"
        : `以下报告使用了'暂无需额外验证': ${phraseIssues.join(", ")}`,
      phraseIssues.length > 0 ? "即使反馈量足够，也需要验证业务影响，不能写'暂无需额外验证'" : undefined,
      phraseIssues.length > 0 ? { issues: phraseIssues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 42. low_evidence_p0_check
  // ---------------------------------------------------------------------------
  if (fs.existsSync(SEGMENTS_DIR)) {
    const lowP0Issues: string[] = [];
    for (const jf of fs.readdirSync(SEGMENTS_DIR).filter(f => f.endsWith(".analysis.json"))) {
      const segJson = readJsonSafe(path.join(SEGMENTS_DIR, jf));
      if (!segJson) continue;
      const segType = segJson.segment_type || "unknown";
      if (segType !== "business") continue;

      for (const c of segJson.issue_clusters || []) {
        const fc = c.feedback_count || 0;
        const pri = c.priority || "";
        const hasLowConf = c.low_confidence === true;
        const hasNeedsVal = c.needs_validation === true;

        if (pri === "P0" && fc < 5) {
          if (fc <= 1) {
            lowP0Issues.push(`${segJson.segment_id}/${c.cluster_id}: "${c.name}" fc=${fc} 不能为稳定 P0，应降级或标记 low_confidence`);
          } else if (fc <= 4 && !hasNeedsVal) {
            lowP0Issues.push(`${segJson.segment_id}/${c.cluster_id}: "${c.name}" fc=${fc} 最多 P1，除非标记 needs_validation`);
          }
        }
      }
    }

    add("low_evidence_p0_check",
      lowP0Issues.length === 0 ? "pass" : "fail",
      lowP0Issues.length === 0
        ? "低样本问题未直接作为稳定 P0"
        : `低样本 P0 问题: ${lowP0Issues.join("; ")}`,
      lowP0Issues.length > 0 ? "feedback_count=1 不能为稳定 P0；feedback_count=2-4 最多 P1，除非有明确业务阻断证据" : undefined,
      lowP0Issues.length > 0 ? { issues: lowP0Issues } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // 43. cluster_id_canonical_format_check
  // ---------------------------------------------------------------------------
  if (overallJson && overallJson.issue_clusters) {
    const badFormatIds: string[] = [];

    for (const c of overallJson.issue_clusters || []) {
      const cid = c.cluster_id;
      const sid = c.segment_id;

      // 统一格式: {segmentId}-cluster-{NNN}
      const expectedPrefix = `${sid}-cluster-`;
      if (!cid.startsWith(expectedPrefix)) {
        badFormatIds.push(`${sid}/${cid}: 格式不符 (期望 ${expectedPrefix}{NNN})`);
      }
      // 检查是否有重复 segment_id 前缀
      const prefix = `${sid}-`;
      let remainder = cid;
      let count = 0;
      while (remainder.startsWith(prefix)) {
        remainder = remainder.slice(prefix.length);
        count++;
      }
      if (count > 1) {
        badFormatIds.push(`${sid}/${cid}: segment_id 前缀重复 ${count} 次`);
      }
    }

    add("cluster_id_canonical_format_check",
      badFormatIds.length === 0 ? "pass" : "fail",
      badFormatIds.length === 0
        ? `所有 ${overallJson.issue_clusters.length} 个 cluster_id 格式规范 (统一为 {segmentId}-cluster-{NNN})`
        : `cluster_id 格式问题: ${badFormatIds.join("; ")}`,
      badFormatIds.length > 0 ? "所有 segment cluster_id 格式统一为 {segmentId}-cluster-{NNN}，不允许重复前缀" : undefined,
      badFormatIds.length > 0 ? { issues: badFormatIds } : undefined,
    );
  }

  // ---------------------------------------------------------------------------
  // Build result with scoring
  // ---------------------------------------------------------------------------
  return buildResult(checks);
}

function buildResult(checks: HardValidationCheck[]): HardValidationResult {
  let score = 100;

  for (const check of checks) {
    if (check.status === "fail") score -= 15;
    else if (check.status === "warning") score -= 5;
  }

  score = Math.max(0, score);

  const failCount = checks.filter(c => c.status === "fail").length;
  const warningCount = checks.filter(c => c.status === "warning").length;
  const passCount = checks.filter(c => c.status === "pass").length;

  let status: "pass" | "warning" | "fail";
  if (failCount > 0 || score < 70) {
    status = "fail";
  } else if (score < 90 || warningCount > 0) {
    status = "warning";
  } else {
    status = "pass";
  }

  return {
    status,
    score,
    checks,
    failed_checks: checks.filter(c => c.status === "fail"),
    warnings: checks.filter(c => c.status === "warning"),
    summary: {
      total_checks: checks.length,
      pass_count: passCount,
      warning_count: warningCount,
      fail_count: failCount,
    },
  };
}
