"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { getCategoryLabel, getCategoryDescription, getStepLabel } from "@/lib/quality-labels";

interface QualityData {
  range: string;
  totalRuns: number;
  statusCounts: { pending: number; running: number; completed: number; failed: number };
  successRate: number | null;
  averageHardScore: number | null;
  averageSemanticScore: number | null;
  averageDurationSeconds: number | null;
  averageFeedbackCount: number | null;
  failureCategories: { category: string; count: number; percentage: number }[];
  slowSteps: { step: string; count: number; averageDurationMs: number }[];
  recentCompleted: { caseName: string; hardScore: number | null; semanticScore: number | null; durationSeconds: number | null; completedAt: string | null }[];
  recentFailed: { caseName: string; category: string; retryable: boolean; message: string; failedAt: string | null }[];
  scoreTrend: { date: string; averageHardScore: number | null; averageSemanticScore: number | null; completedCount: number; failedCount: number }[];
}

const RANGE_OPTIONS = [
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
  { value: "all", label: "全部" },
];

export default function QualityPage() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quality/summary?range=${range}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatDuration = (seconds: number | null) => {
    if (seconds == null) return "-";
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-[280px] mt-16 flex-1 p-margin-desktop bg-surface">
        {/* Header */}
        <div className="mb-xl flex items-center justify-between">
          <div>
            <h2 className="text-headline-lg font-headline-lg text-on-surface tracking-tight">质量与运行概览</h2>
            <p className="text-body-md font-body-md text-on-surface-variant mt-1">
              查看近期分析任务的成功率、评分趋势、失败原因和慢步骤。
            </p>
          </div>
          <select
            className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md font-body-md rounded-lg px-4 py-2 appearance-none"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading && (
          <div className="text-center py-16 text-on-surface-variant">加载中...</div>
        )}

        {!loading && !data && (
          <div className="text-center py-16">
            <p className="text-body-lg font-body-lg text-on-surface mb-sm">暂无质量统计数据。</p>
            <p className="text-body-md font-body-md text-on-surface-variant">请先完成一些分析任务。</p>
          </div>
        )}

        {!loading && data && data.totalRuns === 0 && (
          <div className="text-center py-16">
            <p className="text-body-lg font-body-lg text-on-surface mb-sm">暂无质量统计数据。</p>
            <p className="text-body-md font-body-md text-on-surface-variant">当前时间范围内没有分析任务记录。</p>
          </div>
        )}

        {!loading && data && data.totalRuns > 0 && (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md mb-xl">
              <MetricCard label="总任务数" value={String(data.totalRuns)} />
              <MetricCard label="成功率" value={data.successRate != null ? `${Math.round(data.successRate * 100)}%` : "-"} accent={data.successRate != null && data.successRate >= 0.9 ? "text-emerald-600" : undefined} />
              <MetricCard label="平均硬性校验" value={data.averageHardScore != null ? String(data.averageHardScore) : "-"} />
              <MetricCard label="平均语义评分" value={data.averageSemanticScore != null ? String(data.averageSemanticScore) : "-"} />
              <MetricCard label="平均耗时" value={formatDuration(data.averageDurationSeconds)} />
              <MetricCard label="失败任务" value={String(data.statusCounts.failed)} accent={data.statusCounts.failed > 0 ? "text-red-600" : undefined} />
            </div>

            {/* Status distribution */}
            <div className="grid grid-cols-4 gap-md mb-xl">
              <StatusCard label="排队中" count={data.statusCounts.pending} color="bg-gray-50 text-gray-600 border-gray-200" />
              <StatusCard label="分析中" count={data.statusCounts.running} color="bg-blue-50 text-blue-700 border-blue-200" />
              <StatusCard label="已完成" count={data.statusCounts.completed} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
              <StatusCard label="失败" count={data.statusCounts.failed} color="bg-red-50 text-red-700 border-red-200" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-md mb-xl">
              {/* Failure categories */}
              {data.failureCategories.length > 0 && (
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
                  <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
                    <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">失败原因统计</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-outline-variant/50">
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">分类</th>
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">数量</th>
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">占比</th>
                        </tr>
                      </thead>
                      <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                        {data.failureCategories.map((fc) => (
                          <tr key={fc.category} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-lg py-sm">
                              <div className="font-medium">{getCategoryLabel(fc.category)}</div>
                              <div className="text-label-md font-label-md text-on-surface-variant">{getCategoryDescription(fc.category)}</div>
                            </td>
                            <td className="px-lg py-sm text-right font-mono">{fc.count}</td>
                            <td className="px-lg py-sm text-right font-mono">{fc.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Slow steps */}
              {data.slowSteps.length > 0 && (
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
                  <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
                    <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">慢步骤统计</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-outline-variant/50">
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">步骤</th>
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">出现次数</th>
                          <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">平均耗时</th>
                        </tr>
                      </thead>
                      <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                        {data.slowSteps.map((ss) => (
                          <tr key={ss.step} className="hover:bg-surface-container-low transition-colors">
                            <td className="px-lg py-sm font-mono text-label-md">{getStepLabel(ss.step)}</td>
                            <td className="px-lg py-sm text-right font-mono">{ss.count}</td>
                            <td className="px-lg py-sm text-right font-mono">{formatMs(ss.averageDurationMs)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Recent completed */}
            {data.recentCompleted.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden mb-xl">
                <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
                  <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">最近成功任务</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant/50">
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">任务名</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">硬性校验</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">语义评分</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">耗时</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                      {data.recentCompleted.map((r) => (
                        <tr key={r.caseName} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-lg py-sm font-medium">{r.caseName}</td>
                          <td className="px-lg py-sm text-right font-mono">{r.hardScore ?? "-"}</td>
                          <td className="px-lg py-sm text-right font-mono">{r.semanticScore ?? "-"}</td>
                          <td className="px-lg py-sm text-right font-mono">{formatDuration(r.durationSeconds)}</td>
                          <td className="px-lg py-sm text-right">
                            <a href={`/runs/${encodeURIComponent(r.caseName)}`} className="text-primary font-label-md hover:underline">查看详情</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent failed */}
            {data.recentFailed.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden mb-xl">
                <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
                  <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">最近失败任务</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant/50">
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">任务名</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">分类</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-center">可重试</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">错误消息</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                      {data.recentFailed.map((r) => (
                        <tr key={r.caseName} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-lg py-sm font-medium">{r.caseName}</td>
                          <td className="px-lg py-sm">{getCategoryLabel(r.category)}</td>
                          <td className="px-lg py-sm text-center">{r.retryable ? "是" : "否"}</td>
                          <td className="px-lg py-sm text-on-surface-variant max-w-xs truncate text-label-md">{r.message || "-"}</td>
                          <td className="px-lg py-sm text-right">
                            <a href={`/runs/${encodeURIComponent(r.caseName)}`} className="text-primary font-label-md hover:underline">查看错误</a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Score trend */}
            {data.scoreTrend.length > 0 && (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden mb-xl">
                <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
                  <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">评分趋势</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-outline-variant/50">
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">日期</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">平均硬性校验</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">平均语义评分</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">成功</th>
                        <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">失败</th>
                      </tr>
                    </thead>
                    <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
                      {data.scoreTrend.map((t) => (
                        <tr key={t.date} className="hover:bg-surface-container-low transition-colors">
                          <td className="px-lg py-sm font-mono text-label-md">{t.date}</td>
                          <td className="px-lg py-sm text-right font-mono">{t.averageHardScore ?? "-"}</td>
                          <td className="px-lg py-sm text-right font-mono">{t.averageSemanticScore ?? "-"}</td>
                          <td className="px-lg py-sm text-right font-mono text-emerald-600">{t.completedCount}</td>
                          <td className="px-lg py-sm text-right font-mono text-red-600">{t.failedCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant card-shadow">
      <div className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-headline-md font-headline-md ${accent || "text-on-surface"}`}>{value}</div>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`p-md rounded-lg border ${color} text-center`}>
      <div className="text-headline-md font-headline-md">{count}</div>
      <div className="text-label-md font-label-md mt-1">{label}</div>
    </div>
  );
}
