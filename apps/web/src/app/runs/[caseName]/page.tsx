import fs from "fs";
import path from "path";
import Sidebar from "@/components/Sidebar";
import { CheckCircle, XCircle, Link, Clock } from "lucide-react";
import { isCloudMode } from "@/lib/data/storage-mode";
import { getRunByCaseName } from "@/lib/data/runs-repository";
import { getReportArtifactsByRunId } from "@/lib/data/artifacts-repository";

const ROOT = path.resolve(process.cwd(), "../..");

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

  const artifacts = await getReportArtifactsByRunId(run.id, "overall-md");
  const reportArtifact = artifacts[0];
  const metadata = reportArtifact?.metadata || {};

  let reportContent: string | null = null;
  if (metadata.markdown) {
    reportContent = metadata.markdown;
  } else if (metadata.content) {
    reportContent = metadata.content;
  }

  return {
    run,
    reportContent,
    hasReport: !!reportContent,
    metadata,
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

    const { run, reportContent, metadata } = cloudData;
    const feedbackCount = metadata?.feedbackCount || run.feedbackCount || 0;

    return (
      <div className="flex min-h-screen bg-surface">
        <Sidebar />
        <div className="ml-[280px] flex-1 p-margin-desktop">
          <div className="mb-xl">
            <div className="flex items-center space-x-sm mb-1">
              <h1 className="text-headline-lg font-headline-lg text-on-surface">
                {caseName}
              </h1>
              <span className="px-2 py-1 rounded-md text-label-sm font-label-sm border flex items-center bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle size={14} className="mr-1" />
                已完成
              </span>
            </div>
            <p className="text-body-lg font-body-lg text-on-surface-variant">
              {run.scenario || run.dataset} · {feedbackCount} 条反馈 · 生成于{" "}
              {run.finishedAt
                ? new Date(run.finishedAt).toLocaleString("zh-CN")
                : run.updatedAt
                  ? new Date(run.updatedAt).toLocaleString("zh-CN")
                  : "-"}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-xl">
            <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
              <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                硬性校验
              </div>
              <div className="text-headline-md font-headline-md text-on-surface">
                {run.hardScore ?? "-"}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
              <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                语义评分
              </div>
              <div className="text-headline-md font-headline-md text-emerald-600">
                {run.semanticScore ?? "-"}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
              <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                证据断裂
              </div>
              <div className="text-headline-md font-headline-md text-on-surface">
                {run.evidenceBroken ?? 0}
              </div>
            </div>
            <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
              <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
                反馈数
              </div>
              <div className="text-headline-md font-headline-md text-on-surface">
                {feedbackCount}
              </div>
            </div>
          </div>

          {reportContent ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg mb-xl">
              <h3 className="text-title-lg font-title-lg text-on-surface mb-md">
                分析报告
              </h3>
              <pre className="whitespace-pre-wrap font-body-md text-body-md text-on-surface bg-surface-container-low rounded-lg p-md border border-outline-variant max-h-[600px] overflow-y-auto">
                {reportContent}
              </pre>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg mb-xl text-center">
              <p className="text-body-lg font-body-lg text-on-surface-variant">
                报告内容暂未生成
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
