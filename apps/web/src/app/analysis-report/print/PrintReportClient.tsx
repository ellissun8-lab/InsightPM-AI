"use client";

import { parseReportMarkdown } from "@/lib/markdown-report-parser";
import { getScenarioDisplayName } from "@/lib/report-display";

interface Props {
  caseName: string;
  dataset: string;
  summary: any;
  hardVal: any;
  semVal: any;
  overallMd: string | null;
  clusters: any[];
  segments: any[];
  selectedSegmentId: string | null;
  segmentCount: number;
  clusterCount: number;
  brokenEvidenceCount: number;
  evidenceTrace: any[];
  feedbackCount: number;
}

function PriorityBadge({ priority }: { priority: string }) {
  const s: Record<string, { bg: string; text: string; border: string }> = {
    P0: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
    P1: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
    P2: { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB" },
  };
  const style = s[priority] || s.P2;
  return (
    <span style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}`, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
      {priority}
    </span>
  );
}

function StatusBadge({ pass }: { pass: boolean }) {
  return pass ? (
    <span style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
      ✓ 通过
    </span>
  ) : (
    <span style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
      ⚠ 需验证
    </span>
  );
}

function formatVal(v: any): string {
  if (v == null) return "未生成";
  if (typeof v === "number") return `${v}%`;
  if (typeof v === "string" && v !== "") return v;
  return "未生成";
}

export default function PrintReportClient(props: Props) {
  const {
    caseName, dataset, summary, hardVal, semVal, overallMd,
    clusters, segments, segmentCount, clusterCount,
    brokenEvidenceCount, evidenceTrace, feedbackCount,
  } = props;

  const scenarioName = getScenarioDisplayName(dataset || caseName);
  const reportTitle = `${scenarioName}分析报告`;
  const caseVersion = caseName.replace(/.*-v(\d+)$/, "· v$1").replace(caseName, "");
  const displayName = `${scenarioName}${caseVersion ? " " + caseVersion : ""}`;

  // Parse markdown for structured data
  const parsed = parseReportMarkdown(overallMd);

  // Validation scores — try multiple sources
  const healthScore = semVal?.semanticScore ?? semVal?.score ?? null;
  const hardPassRate = hardVal?.passRate ?? hardVal?.pass_rate ?? hardVal?.hardValidationScore ?? hardVal?.score ??
    (hardVal?.passed != null && hardVal?.total ? Math.round((hardVal.passed / hardVal.total) * 100) : null);

  const topProblems = clusters.filter((c: any) => c.priority === "P0" || c.priority === "P1").slice(0, 5);
  const actionItems = clusters.filter((c: any) => c.action || c.recommendation).slice(0, 5);
  const riskItems = clusters.filter((c: any) => c.priority === "P0");
  const generatedAt = summary?.startedAt || summary?.timestamp || new Date().toISOString();

  // Executive summary with scenario-aware fallback
  let executiveSummary = parsed.executiveSummary;
  if (!executiveSummary || executiveSummary.includes("已自动解析")) {
    const tf = parsed.scopeMetrics.totalFeedback ?? feedbackCount;
    const cc = parsed.scopeMetrics.clusterCount ?? clusterCount;
    const sc = parsed.scopeMetrics.segmentCount ?? segmentCount;
    if (tf && cc) {
      executiveSummary = `本报告围绕「${scenarioName}」场景分析 ${tf} 条反馈，识别出 ${cc} 个问题聚类，覆盖 ${sc || "多个"} 个分组。当前重点关注数据准确性、查询体验、价值感知和导出流程等影响核心业务目标的问题，建议优先处理高反馈量、高影响的 P0/P1 问题。`;
    } else {
      executiveSummary = "本报告由 AI 自动生成。完整数据请参阅控制台。";
    }
  }

  return (
    <div
      className="print-page"
      style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: "#171511",
        background: "#FFFCF5",
        width: "210mm",
        minHeight: "297mm",
        margin: "0 auto",
        padding: "18mm",
        lineHeight: 1.6,
        boxSizing: "border-box",
      }}
    >
      {/* Print Button — hidden when printing */}
      <div className="no-print" style={{ position: "fixed", top: 20, right: 20, zIndex: 100 }}>
        <button
          onClick={() => window.print()}
          style={{
            background: "#14120F", color: "#fff", border: "none", borderRadius: 8,
            padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          导出为 PDF
        </button>
      </div>

      {/* ─── 1. Cover Header ─── */}
      <div className="print-section" style={{ borderBottom: "2px solid #E5DED0", paddingBottom: 24, marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#14120F" }}>analytics</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#14120F", fontFamily: "'Playfair Display', serif" }}>ProofLoop</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 8, lineHeight: 1.2 }}>
          {reportTitle}
        </h1>
        <p style={{ fontSize: 14, color: "#6F6A5F" }}>
          {displayName} · 生成时间 {new Date(generatedAt).toLocaleDateString("zh-CN")}
        </p>
      </div>

      {/* ─── 2. Metrics Overview ─── */}
      <div className="print-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
          指标概览
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "反馈数", value: String(feedbackCount) },
            { label: "分组数", value: String(segmentCount) },
            { label: "问题数", value: String(clusterCount) },
            { label: "硬性校验", value: formatVal(hardPassRate) },
            { label: "语义评分", value: formatVal(healthScore) },
            { label: "证据断裂", value: String(brokenEvidenceCount) },
            { label: "生成时间", value: new Date(generatedAt).toLocaleDateString("zh-CN") },
            { label: "案例名称", value: caseName },
          ].map((item) => (
            <div key={item.label} style={{ background: "#F7F3EA", borderRadius: 8, padding: "10px 14px", border: "1px solid #E5DED0" }}>
              <div style={{ fontSize: 10, color: "#6F6A5F", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#171511", marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 3. Executive Summary ─── */}
      <div className="print-section" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
          老板摘要
        </h2>
        <div style={{ background: "#FFFCF5", border: "1px solid #E5DED0", borderRadius: 8, padding: 16, fontSize: 14, color: "#171511", lineHeight: 1.8 }}>
          {executiveSummary}
        </div>
      </div>

      {/* ─── 4. Scope Metrics from Markdown ─── */}
      {parsed.scopeMetrics.totalFeedback != null && (
        <div className="print-section" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
            分析范围
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "总反馈数", value: parsed.scopeMetrics.totalFeedback },
              { label: "已分析数量", value: parsed.scopeMetrics.analyzedFeedback },
              { label: "已聚类数量", value: parsed.scopeMetrics.clusteredFeedback },
              { label: "问题聚类数", value: parsed.scopeMetrics.clusterCount },
              { label: "分组数", value: parsed.scopeMetrics.segmentCount },
              { label: "业务分组数", value: parsed.scopeMetrics.businessSegmentCount },
            ].filter((m) => m.value != null).map((m) => (
              <div key={m.label} style={{ background: "#F7F3EA", borderRadius: 8, padding: "10px 14px", border: "1px solid #E5DED0", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#171511" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#6F6A5F", marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 5. Segment Overview Table ─── */}
      {parsed.segmentOverview.length > 0 && (
        <div className="print-section" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
            数据分组概览
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5DED0", background: "#F7F3EA" }}>
                {["分组", "类型", "业务目标", "反馈数", "聚类数"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "#6F6A5F", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.segmentOverview.map((seg) => (
                <tr key={seg.segmentId} style={{ borderBottom: "1px solid #E5DED0" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>{seg.segmentId}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{
                      background: seg.type === "business" ? "#E7ECDD" : seg.type === "positive" ? "#ECFDF5" : "#F3F4F6",
                      color: seg.type === "business" ? "#58624a" : seg.type === "positive" ? "#065F46" : "#6B7280",
                      padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                    }}>
                      {seg.type}
                    </span>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#6F6A5F" }}>{seg.businessGoal}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{seg.feedbackCount}</td>
                  <td style={{ padding: "8px 10px", textAlign: "right" }}>{seg.clusterCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 6. Top Problems ─── */}
      {topProblems.length > 0 && (
        <div className="print-section" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
            主要产品问题
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topProblems.map((c: any, i: number) => (
              <div key={c.cluster_id || i} className="print-card" style={{ background: "#FFFCF5", borderRadius: 8, padding: 14, border: "1px solid #E5DED0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <PriorityBadge priority={c.priority} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#171511" }}>{c.name}</span>
                  {c.segment_name && <span style={{ fontSize: 11, color: "#6F6A5F" }}>· {c.segment_name}</span>}
                </div>
                <p style={{ fontSize: 12, color: "#4b463f", marginBottom: 6, lineHeight: 1.6 }}>{c.summary}</p>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6F6A5F" }}>
                  <span>反馈数: {c.feedback_count}</span>
                  <span>机会分: {c.opportunity_score || c.score || "未评"}</span>
                </div>
                {c.impact && <p style={{ fontSize: 11, color: "#4b463f", marginTop: 4 }}><strong>影响:</strong> {c.impact}</p>}
                {c.recommendation && <p style={{ fontSize: 11, color: "#4b463f", marginTop: 2 }}><strong>建议:</strong> {c.recommendation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 7. Issue Overview Table ─── */}
      {clusters.length > 0 && (
        <div className="print-section" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
            高频问题概览
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5DED0", background: "#F7F3EA" }}>
                {["问题", "优先级", "反馈数", "机会分", "分组"].map((h) => (
                  <th key={h} style={{ textAlign: h === "反馈数" || h === "机会分" ? "right" : "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "#6F6A5F", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clusters.slice(0, 10).map((c: any, i: number) => (
                <tr key={c.cluster_id || i} style={{ borderBottom: "1px solid #E5DED0" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: "6px 10px" }}><PriorityBadge priority={c.priority} /></td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{c.feedback_count}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{c.opportunity_score || c.score || "-"}</td>
                  <td style={{ padding: "6px 10px", color: "#6F6A5F" }}>{c.segment_name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 8. Action Plan ─── */}
      {actionItems.length > 0 && (
        <div className="print-section" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
            建议行动计划
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {actionItems.map((c: any, i: number) => (
              <div key={c.cluster_id || i} className="print-card" style={{ display: "flex", gap: 12, padding: "10px 14px", background: "#F7F3EA", borderRadius: 8, border: "1px solid #E5DED0" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#14120F", minWidth: 20 }}>{i + 1}.</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <PriorityBadge priority={c.priority} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#171511" }}>{c.name}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#4b463f", marginTop: 2 }}>{c.action || c.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 9. Risk Warnings ─── */}
      {riskItems.length > 0 && (
        <div className="print-section" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
            风险提醒
          </h2>
          <div style={{ background: "#F3DCDC", borderRadius: 8, padding: 16, border: "1px solid #D8BCC7" }}>
            {riskItems.map((c: any, i: number) => (
              <div key={c.cluster_id || i} style={{ marginBottom: i < riskItems.length - 1 ? 10 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#8A2F2F" }}>P0 · {c.name}</span>
                <p style={{ fontSize: 12, color: "#4b463f", marginTop: 2 }}>{c.impact || c.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 10. Evidence Trace Summary ─── */}
      {evidenceTrace.length > 0 && (
        <div className="print-section" style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#171511", marginBottom: 12, borderBottom: "1px solid #E5DED0", paddingBottom: 8 }}>
            证据链摘要
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #E5DED0", background: "#F7F3EA" }}>
                {["分组", "问题", "证据数", "状态"].map((h) => (
                  <th key={h} style={{ textAlign: h === "证据数" ? "right" : "left", padding: "6px 10px", fontSize: 10, fontWeight: 600, color: "#6F6A5F", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidenceTrace.slice(0, 15).map((e: any, i: number) => (
                <tr key={i} style={{ borderBottom: "1px solid #E5DED0" }}>
                  <td style={{ padding: "6px 10px", color: "#6F6A5F" }}>{e.segment}</td>
                  <td style={{ padding: "6px 10px", fontWeight: 600 }}>{e.cluster}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{e.count}</td>
                  <td style={{ padding: "6px 10px" }}><StatusBadge pass={e.status === "Pass"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Footer ─── */}
      <div style={{ borderTop: "1px solid #E5DED0", paddingTop: 16, marginTop: 32, fontSize: 11, color: "#9A9387", textAlign: "center" }}>
        <p>ProofLoop · AI 反馈分析引擎 · 报告生成于 {new Date(generatedAt).toLocaleString("zh-CN")}</p>
        <p style={{ marginTop: 4 }}>本报告由 AI 自动生成，结论仅供参考。建议结合原始反馈数据进行人工复核。</p>
      </div>
    </div>
  );
}
