import fs from "fs";
import path from "path";
import Sidebar from "@/components/Sidebar";
import { CheckCircle, XCircle, Link, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import RunArtifactsClient from "@/components/RunArtifactsClient";
import { isCloudMode } from "@/lib/data/storage-mode";
import { getRunByCaseName } from "@/lib/data/runs-repository";
import { getMarkdownReportByRunId, getSummaryArtifactByRunId, getArtifactsForRun } from "@/lib/data/artifacts-repository";

const ROOT = path.resolve(process.cwd(), "../..");

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
      <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-headline-md font-headline-md ${accent || "text-on-surface"}`}>{value}</div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
      <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">{label}</div>
      <div className="text-body-md font-body-md text-on-surface truncate" title={value}>{value}</div>
    </div>
  );
}

function ErrorDetailsCard({ error, categoryLabels }: { error: any; categoryLabels: Record<string, string> }) {
  const category = error.category || "unknown";
  const retryable = error.retryable;

  const ERROR_EXPLANATIONS: Record<string, string> = {
    semantic_validation: "语义校验未通过，说明报告内容与原始反馈的证据一致性不足。",
    hard_validation: "硬性校验未通过，通常是输入格式或结构性规则不满足。",
    storage: "文件下载或存储访问失败。",
    ai_generation: "AI 分析生成失败。",
    network: "AI 服务或存储访问超时，系统将自动重试。",
    training_data: "训练数据处理失败。",
    artifact_write: "报告产物写入失败，系统将自动重试。",
    unknown: "系统处理时发生未知错误。",
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-red-200 overflow-hidden mb-xl">
      <div className="px-lg py-md border-b border-red-200 bg-red-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="text-title-lg font-title-lg text-red-800 font-semibold">错误详情</h3>
        </div>
        <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-red-100 text-red-700 border border-red-200">
          {categoryLabels[category] || category}
        </span>
      </div>
      <div className="px-lg py-md">
        <p className="text-body-md font-body-md text-on-surface mb-md">
          {ERROR_EXPLANATIONS[category] || ERROR_EXPLANATIONS.unknown}
        </p>
        <p className="text-label-md font-label-md text-on-surface-variant mb-md">
          {retryable ? "该错误可自动重试，系统将自动处理。" : "该错误通常需要修正输入或检查配置。"}
        </p>
        <div className="space-y-sm">
          <DetailRow label="错误消息" value={error.message || "-"} />
          <DetailRow label="失败步骤" value={error.workerStep || "-"} />
          <DetailRow label="失败时间" value={error.failedAt ? new Date(error.failedAt).toLocaleString("zh-CN") : "-"} />
          {error.exitCode != null && <DetailRow label="退出码" value={String(error.exitCode)} />}
        </div>
      </div>

      {/* Expandable technical details - collapsed by default */}
      <details className="border-t border-outline-variant group">
        <summary className="px-lg py-sm flex items-center justify-between text-label-md font-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer list-none">
          <span>展开技术详情</span>
          <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
        </summary>
        <div className="px-lg pb-md space-y-sm">
          {error.command && <DetailRow label="命令" value={error.command} mono />}
          {error.inputPath && <DetailRow label="输入路径" value={error.inputPath} mono />}
          {error.outputDir && <DetailRow label="输出目录" value={error.outputDir} mono />}
          {error.stdoutPreview && (
            <div>
              <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">stdout</div>
              <pre className="whitespace-pre-wrap font-mono text-label-md text-on-surface bg-surface-container-low rounded-lg p-md border border-outline-variant max-h-[300px] overflow-y-auto">
                {error.stdoutPreview}
              </pre>
            </div>
          )}
          {error.stderrPreview && (
            <div>
              <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">stderr</div>
              <pre className="whitespace-pre-wrap font-mono text-label-md text-on-surface bg-surface-container-low rounded-lg p-md border border-outline-variant max-h-[300px] overflow-y-auto">
                {error.stderrPreview}
              </pre>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      <div className="text-label-sm font-label-sm text-on-surface-variant w-24 shrink-0 pt-0.5">{label}</div>
      <div className={`text-body-md font-body-md text-on-surface flex-1 ${mono ? "font-mono text-label-md" : ""}`}>{value}</div>
    </div>
  );
}

function loadJson(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function loadMd(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

async function getCloudReport(caseName: string) {
  const run = await getRunByCaseName(caseName);
  if (!run) return null;

  const { markdown, artifact: mdArtifact } = await getMarkdownReportByRunId(run.id);
  const { summary } = await getSummaryArtifactByRunId(run.id);
  const artifacts = await getArtifactsForRun(run.id);

  const metadata = run.metadata || {};
  const isReal = metadata.workerResult === "artifacts-written-ok" || metadata.artifactWritten === true || metadata.worker === "railway-worker";

  return {
    run,
    reportContent: markdown,
    hasReport: !!markdown,
    metadata: mdArtifact?.metadata || {},
    summary,
    isRealAnalysis: isReal,
    artifacts,
  };
}

function getLocalReport(caseName: string) {
  const runDir = path.join(ROOT, "runs", caseName);

  const summary = loadJson(path.join(runDir, "run-summary.json"));
  const hardVal = loadJson(
    path.join(runDir, "validation-report", "hard-validation.json")
  );
  const semVal = loadJson(
    path.join(runDir, "validation-report", "semantic-validation.json")
  );

  let overallMd: string | null = null;
  const mdDir = path.join(runDir, "analysis-md");
  if (fs.existsSync(mdDir)) {
    const mdFiles = fs
      .readdirSync(mdDir)
      .filter((f) => f.endsWith(".overall.analysis.md"));
    if (mdFiles.length > 0) {
      overallMd = loadMd(path.join(mdDir, mdFiles[0]));
    }
  }

  const segmentsDir = path.join(
    runDir,
    "analysis",
    summary?.dataset || "",
    "segments"
  );
  let evidenceTrace: {
    clusterId: string;
    evidenceIds: string[];
    feedbackCount: number;
  }[] = [];
  if (fs.existsSync(segmentsDir)) {
    for (const f of fs
      .readdirSync(segmentsDir)
      .filter((f) => f.endsWith(".analysis.json"))) {
      const seg = loadJson(path.join(segmentsDir, f));
      if (seg?.issue_clusters) {
        for (const c of seg.issue_clusters) {
          evidenceTrace.push({
            clusterId: c.cluster_id,
            evidenceIds: c.evidence_feedback_ids || [],
            feedbackCount: c.feedback_count,
          });
        }
      }
    }
  }

  return {
    summary,
    hardVal,
    semVal,
    overallMd,
    evidenceTrace,
    hasReport: !!summary,
  };
}

export default async function RunDetailPage({
  params,
}: {
  params: { caseName: string };
}) {
  const caseName = decodeURIComponent(params.caseName);

  // Cloud mode: 从 Supabase 读取
  if (isCloudMode()) {
    const cloudData = await getCloudReport(caseName);

    if (!cloudData || !cloudData.run) {
      return (
        <div className="flex min-h-screen bg-surface">
          <Sidebar />
          <div className="ml-[280px] flex-1 p-margin-desktop flex items-center justify-center">
            <div className="max-w-md text-center">
              <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-lg">
                <Clock size={32} className="text-on-surface-variant" />
              </div>
              <h1 className="text-headline-md font-headline-md text-on-surface mb-sm">
                报告尚未生成
              </h1>
              <p className="text-body-lg font-body-lg text-on-surface-variant mb-lg">
                该分析任务「{caseName}」还没有可用报告。请返回运行历史查看任务状态。
              </p>
              <a
                href="/runs"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-container text-white rounded-lg font-label-md text-label-md hover:bg-primary transition-colors"
              >
                返回运行历史
              </a>
            </div>
          </div>
        </div>
      );
    }

    const { run, reportContent, isRealAnalysis, artifacts } = cloudData;
    const feedbackCount = run.feedbackCount || 0;
    const runStatus = run.status || "pending";
    const metadata = run.metadata || {};
    const errorInfo = metadata.error || run.lastError || null;

    const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
      completed: { label: "已完成", class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      running: { label: "处理中", class: "bg-blue-50 text-blue-700 border-blue-200" },
      failed: { label: "失败", class: "bg-red-50 text-red-700 border-red-200" },
      pending: { label: "排队中", class: "bg-gray-50 text-gray-600 border-gray-200" },
    };
    const statusCfg = STATUS_CONFIG[runStatus] || STATUS_CONFIG.pending;

    const CATEGORY_LABELS: Record<string, string> = {
      hard_validation: "硬性校验失败",
      semantic_validation: "语义校验失败",
      network: "网络错误",
      training_data: "训练数据错误",
      artifact_write: "产物写入错误",
      ai_generation: "AI 生成错误",
      storage: "存储错误",
      unknown: "未知错误",
    };

    const STATUS_DESC: Record<string, string> = {
      pending: "任务已创建，等待处理。",
      running: "正在分析，可能需要几分钟。",
      completed: "分析完成，可以查看报告。",
      failed: "分析失败，请查看错误原因。",
    };

    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <div className="ml-[280px] flex-1 p-margin-desktop">
          {/* Header */}
          <div className="mb-xl">
            <p className="text-label-md font-label-md text-on-surface-variant mb-1">分析任务详情</p>
            <div className="flex items-center space-x-sm mb-1">
              <h1 className="text-headline-lg font-headline-lg text-on-surface">
                {caseName}
              </h1>
              <span className={`px-2 py-1 rounded-md text-label-sm font-label-sm border flex items-center ${statusCfg.class}`}>
                {runStatus === "completed" ? <CheckCircle size={14} className="mr-1" /> :
                 runStatus === "failed" ? <XCircle size={14} className="mr-1" /> :
                 <Clock size={14} className="mr-1" />}
                {statusCfg.label}
              </span>
              {isRealAnalysis && (
                <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-[#E7ECDD] text-[#2F6B3F] border border-[#CAD5B8]">
                  real-pipeline
                </span>
              )}
            </div>
            <p className="text-body-lg font-body-lg text-on-surface-variant">
              {run.scenario || run.dataset} · {feedbackCount} 条反馈 · 更新于{" "}
              {run.updatedAt ? new Date(run.updatedAt).toLocaleString("zh-CN") : "-"}
            </p>
            <p className="text-body-md font-body-md text-on-surface-variant mt-1">
              {STATUS_DESC[runStatus] || ""}
            </p>
            {/* CTA buttons for completed */}
            {runStatus === "completed" && reportContent && (
              <div className="flex gap-sm mt-md">
                <a
                  href="#report-section"
                  className="px-4 py-2 rounded-lg bg-primary-container text-white text-label-md font-label-md hover:bg-primary transition-colors"
                >
                  查看完整报告
                </a>
              </div>
            )}
          </div>

          {/* Status Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-xl">
            <MetricCard label="硬性校验" value={run.hardScore != null ? String(run.hardScore) : "-"} accent={run.hardScore != null && run.hardScore >= 85 ? "text-emerald-600" : "text-on-surface"} />
            <MetricCard label="语义评分" value={run.semanticScore != null ? String(run.semanticScore) : "-"} accent={run.semanticScore != null && run.semanticScore >= 85 ? "text-emerald-600" : "text-on-surface"} />
            <MetricCard label="反馈数" value={String(feedbackCount)} />
            <MetricCard label="重试" value={`${run.retryCount ?? 0} / ${run.maxRetry ?? 2}`} />
          </div>

          {/* Worker Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-xl">
            <InfoField label="Worker" value={metadata.worker || "-"} />
            <InfoField label="Worker 步骤" value={metadata.workerStep || "-"} />
            <InfoField label="心跳" value={run.heartbeatAt ? new Date(run.heartbeatAt).toLocaleString("zh-CN") : "-"} />
            <InfoField label="锁定者" value={run.lockedBy || "-"} />
          </div>

          {/* Run Metrics */}
          {run.metrics && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden mb-xl">
              <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
                <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">运行指标</h3>
              </div>
              <div className="px-lg py-md">
                {/* Summary grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-md">
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">总耗时</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.durationSeconds != null ? `${run.metrics.durationSeconds}s` : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">反馈数量</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.feedbackCount ?? feedbackCount ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">平均每条耗时</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.durationSeconds != null && feedbackCount > 0
                        ? `${(run.metrics.durationSeconds / feedbackCount).toFixed(1)}s`
                        : "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">AI 模型</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.aiModel || "未统计"}
                    </div>
                  </div>
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">校验模型</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.validationModel || "未统计"}
                    </div>
                  </div>
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">Token 使用量</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.tokenUsage?.totalTokens != null
                        ? run.metrics.tokenUsage.totalTokens.toLocaleString()
                        : "未统计"}
                    </div>
                  </div>
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">估算成本</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.costEstimatedUsd != null
                        ? `$${run.metrics.costEstimatedUsd.toFixed(4)}`
                        : "未统计"}
                    </div>
                  </div>
                  <div>
                    <div className="text-label-sm font-label-sm text-on-surface-variant">慢步骤</div>
                    <div className="text-body-md font-body-md text-on-surface font-medium">
                      {run.metrics.slowSteps?.length > 0
                        ? run.metrics.slowSteps.join(", ")
                        : "无"}
                    </div>
                  </div>
                </div>

                {/* Step durations table */}
                {run.metrics.stepDurations?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-outline-variant/50">
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">步骤</th>
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-center">状态</th>
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">耗时</th>
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-center">慢步骤</th>
                        </tr>
                      </thead>
                      <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                        {run.metrics.stepDurations.map((step: any, i: number) => (
                          <tr key={i} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-lg py-sm font-mono text-label-md">{step.step}</td>
                            <td className="px-lg py-sm text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm ${
                                step.status === "pass" ? "bg-emerald-50 text-emerald-700" :
                                step.status === "fail" || step.status === "FAIL" ? "bg-red-50 text-red-700" :
                                "bg-surface-variant text-on-surface-variant"
                              }`}>
                                {step.status}
                              </span>
                            </td>
                            <td className="px-lg py-sm text-right font-mono text-label-md">
                              {step.durationMs != null
                                ? step.durationMs < 1000
                                  ? `${step.durationMs}ms`
                                  : `${(step.durationMs / 1000).toFixed(1)}s`
                                : "-"}
                            </td>
                            <td className="px-lg py-sm text-center">
                              {step.slowStep && (
                                <span className="text-yellow-600 text-label-sm">⚠</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Details (failed only) */}
          {runStatus === "failed" && errorInfo && (
            <ErrorDetailsCard error={errorInfo} categoryLabels={CATEGORY_LABELS} />
          )}

          {/* Artifacts List */}
          {artifacts && artifacts.length > 0 && run.id && (
            <RunArtifactsClient
              artifacts={artifacts.map((a: any) => ({
                id: a.id,
                artifactType: a.artifactType,
                fileName: a.fileName,
                contentType: a.contentType,
                sizeBytes: a.sizeBytes,
                metadata: a.metadata,
                createdAt: a.createdAt,
              }))}
              runId={run.id}
            />
          )}

          {/* Report Content */}
          {reportContent ? (
            <div id="report-section" className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg mb-xl">
              <h3 className="text-title-lg font-title-lg text-on-surface mb-md">
                完整报告
              </h3>
              <pre className="whitespace-pre-wrap font-body-md text-body-md text-on-surface bg-surface-container-low rounded-lg p-md border border-outline-variant max-h-[600px] overflow-y-auto">
                {reportContent}
              </pre>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg mb-xl text-center">
              <p className="text-body-lg font-body-lg text-on-surface-variant">
                {runStatus === "failed" ? "该分析失败，无报告产物。" : "报告内容暂未生成"}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Local mode: 从本地文件系统读取
  const localData = getLocalReport(caseName);
  const { summary, hardVal, semVal, overallMd, evidenceTrace } = localData;

  if (!summary) {
    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <div className="ml-[280px] flex-1 p-margin-desktop flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-lg">
              <Clock size={32} className="text-on-surface-variant" />
            </div>
            <h1 className="text-headline-md font-headline-md text-on-surface mb-sm">
              报告尚未生成
            </h1>
            <p className="text-body-lg font-body-lg text-on-surface-variant mb-lg">
              该分析任务「{caseName}」还没有可用报告。请返回运行历史查看任务状态。
            </p>
            <a
              href="/runs"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-container text-white rounded-lg font-label-md text-label-md hover:bg-primary transition-colors"
            >
              返回运行历史
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-[280px] flex-1 p-margin-desktop">
        <div className="mb-xl">
          <div className="flex items-center space-x-sm mb-1">
            <h1 className="text-headline-lg font-headline-lg text-on-surface">
              {caseName}
            </h1>
            <span
              className={`px-2 py-1 rounded-md text-label-sm font-label-sm border flex items-center ${
                summary.status === "pass"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}
            >
              {summary.status === "pass" ? (
                <CheckCircle size={14} className="mr-1" />
              ) : (
                <XCircle size={14} className="mr-1" />
              )}
              {summary.status === "pass" ? "通过" : "失败"}
            </span>
          </div>
          <p className="text-body-lg font-body-lg text-on-surface-variant">
            {summary.dataset} · 生成于{" "}
            {new Date(summary.timestamp).toLocaleString("zh-CN")} · 耗时{" "}
            {summary.duration_ms
              ? summary.duration_ms < 1000
                ? `${summary.duration_ms}ms`
                : `${(summary.duration_ms / 1000).toFixed(1)}s`
              : "-"}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-xl">
          <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
            <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
              硬性校验
            </div>
            <div className="text-headline-md font-headline-md text-on-surface">
              {summary.validation?.score ?? "-"}
            </div>
          </div>
          <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
            <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
              语义评分
            </div>
            <div className="text-headline-md font-headline-md text-emerald-600">
              {semVal?.semanticScore ?? "-"}
            </div>
          </div>
          <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
            <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
              关键问题
            </div>
            <div className="text-headline-md font-headline-md text-on-surface">
              {semVal?.criticalIssues ?? 0}
            </div>
          </div>
          <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
            <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
              反馈数
            </div>
            <div className="text-headline-md font-headline-md text-on-surface">
              {summary.count}
            </div>
          </div>
        </div>

        {overallMd && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg mb-xl">
            <h3 className="text-title-lg font-title-lg text-on-surface mb-md">
              分析报告
            </h3>
            <pre className="whitespace-pre-wrap font-body-md text-body-md text-on-surface bg-surface-container-low rounded-lg p-md border border-outline-variant max-h-[600px] overflow-y-auto">
              {overallMd}
            </pre>
          </div>
        )}

        {hardVal?.checks && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden mb-xl">
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">
                硬性校验 Hard Validation
              </h3>
              <span className="text-label-md font-label-md text-on-surface-variant">
                {hardVal.pass_count} pass · {hardVal.warning_count} warning ·{" "}
                {hardVal.fail_count} fail
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/50">
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">校验项</th>
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-center">状态</th>
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">得分</th>
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">信息</th>
                  </tr>
                </thead>
                <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                  {hardVal.checks.map((c: any, i: number) => (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-lg py-md font-medium">{c.name}</td>
                      <td className="px-lg py-md text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm ${
                            c.status === "pass"
                              ? "bg-emerald-50 text-emerald-700"
                              : c.status === "fail"
                                ? "bg-red-50 text-red-700"
                                : "bg-surface-variant text-on-surface-variant"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-lg py-md text-right">{c.score}/{c.maxScore}</td>
                      <td className="px-lg py-md text-on-surface-variant max-w-md truncate text-label-md">{c.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {semVal && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden mb-xl">
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">
                语义校验 Semantic Validation
              </h3>
              <span className="text-label-md font-label-md text-on-surface-variant">
                得分: {semVal.semanticScore}/100
              </span>
            </div>
            {semVal.checks && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/50">
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">校验项</th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-center">状态</th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">得分</th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">信息</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                    {semVal.checks.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-lg py-md font-medium">{c.name}</td>
                        <td className="px-lg py-md text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm ${
                              c.status === "pass"
                                ? "bg-emerald-50 text-emerald-700"
                                : c.status === "fail"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-surface-variant text-on-surface-variant"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="px-lg py-md text-right">{c.score}/{c.maxScore}</td>
                        <td className="px-lg py-md text-on-surface-variant max-w-md truncate text-label-md">{c.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {semVal.recommendations?.length > 0 && (
              <div className="px-lg py-md border-t border-outline-variant">
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase mb-sm tracking-wider">
                  建议
                </p>
                <ul className="space-y-sm">
                  {semVal.recommendations.map((r: string, i: number) => (
                    <li
                      key={i}
                      className="text-body-md font-body-md text-on-surface-variant flex items-start gap-sm"
                    >
                      <span className="text-primary mt-0.5">&bull;</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {evidenceTrace.length > 0 && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
              <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">
                证据链 Evidence Trace
              </h3>
              <span className="text-label-md font-label-md text-on-surface-variant">
                {evidenceTrace.length} 个问题簇
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant/50">
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">问题簇 ID</th>
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">反馈数</th>
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">证据 ID</th>
                    <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-center">匹配</th>
                  </tr>
                </thead>
                <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                  {evidenceTrace.map((e, i) => (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-lg py-md font-medium text-primary">
                        <span className="flex items-center gap-1">
                          <Link size={14} />
                          {e.clusterId}
                        </span>
                      </td>
                      <td className="px-lg py-md text-right">{e.feedbackCount}</td>
                      <td className="px-lg py-md text-right text-on-surface-variant">{e.evidenceIds.length}</td>
                      <td className="px-lg py-md text-center">
                        {e.feedbackCount === e.evidenceIds.length ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-emerald-50 text-emerald-700">
                            <CheckCircle size={14} className="mr-1" />
                            匹配
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-red-50 text-red-700">
                            <XCircle size={14} className="mr-1" />
                            不匹配
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
