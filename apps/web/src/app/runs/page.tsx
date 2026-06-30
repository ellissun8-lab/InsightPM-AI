"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, Play, Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { getScenarioDisplayName } from "@/lib/report-display";
import {
  getRunDisplayStatus,
  getRunHardValidationLabel,
  getRunSemanticScore,
  getRunStatusBadgeClass,
  getRunStatusLabel,
  isStaleRunning,
  getWorkerStep,
  type RunLike,
} from "@/lib/run-status";
import type { RunListItem } from "@/lib/types/run";

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "completed", label: "已完成" },
  { value: "running", label: "处理中" },
  { value: "failed", label: "失败" },
  { value: "pending", label: "排队中" },
];

const ARTIFACT_OPTIONS = [
  { value: "all", label: "全部产物" },
  { value: "has-report", label: "有完整报告" },
  { value: "missing-report", label: "缺少完整报告" },
  { value: "has-artifacts", label: "有任意产物" },
  { value: "no-artifacts", label: "无产物" },
];

const RANGE_OPTIONS = [
  { value: "all", label: "全部时间" },
  { value: "today", label: "今天" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "最新创建" },
  { value: "oldest", label: "最早创建" },
  { value: "updated", label: "最近更新" },
  { value: "score", label: "语义评分" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

export default function RunsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-surface"><Sidebar /><div className="ml-[280px] mt-16 flex-1 p-margin-desktop text-on-surface-variant">加载中...</div></div>}>
      <RunsPageInner />
    </Suspense>
  );
}

function RunsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read all filter state from URL
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "all";
  const artifact = searchParams.get("artifact") || "all";
  const range = searchParams.get("range") || "all";
  const sort = searchParams.get("sort") || "newest";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [artifactSummary, setArtifactSummary] = useState<Record<string, { count: number; hasOverallMd: boolean; types: string[] }>>({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(q);

  // Sync searchInput with URL q on navigation
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "" || value === "all" || (key === "page" && value === "1") || (key === "pageSize" && value === "20") || (key === "sort" && value === "newest")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    router.push(`/runs${params.toString() ? "?" + params.toString() : ""}`);
  }, [router, searchParams]);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "all") params.set("status", status);
      if (artifact !== "all") params.set("artifact", artifact);
      if (range !== "all") params.set("range", range);
      if (sort !== "newest") params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(`/api/runs?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

      if (data.runs) {
        setRuns(data.runs);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
        setArtifactSummary(data.artifactSummary || {});
      } else {
        setRuns([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch {
      setRuns([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [q, status, artifact, range, sort, page, pageSize]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: searchInput || undefined, page: undefined });
  };

  const clearFilters = () => {
    setSearchInput("");
    router.push("/runs");
  };

  const hasActiveFilters = q || status !== "all" || artifact !== "all" || range !== "all" || sort !== "newest";

  const getCaseName = (run: RunListItem) => run.caseName || run.case_name || "未命名分析";
  const getScenario = (run: RunListItem) => run.scenario || run.dataset || "mixed-feedback";
  const getFeedbackCount = (run: RunListItem) => run.feedbackCount ?? run.count ?? 0;

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-[280px] mt-16 flex-1 p-margin-desktop bg-surface">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-headline-lg font-headline-lg text-on-surface tracking-tight">运行历史</h2>
            <p className="text-body-md font-body-md text-on-surface-variant mt-1">
              查看并管理历史 AI 分析执行记录。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/quality"
              className="bg-surface-container-lowest border border-outline-variant text-on-surface px-4 py-2 rounded-lg text-label-md font-label-md hover:bg-surface-container-low transition-colors flex items-center gap-2"
            >
              质量概览
            </a>
            <a
              href="/new-analysis"
              className="bg-primary-container text-white px-4 py-2 rounded-lg text-label-md font-label-md hover:bg-primary transition-colors flex items-center gap-2 shadow-diffused"
            >
              <Play size={18} />
              新建分析
            </a>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl card-shadow overflow-hidden mb-md">
          <div className="p-base border-b border-outline-variant bg-surface-container-low flex items-center gap-3 flex-wrap">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-1.5 max-w-xs focus-within:border-primary transition-colors">
              <Search size={16} className="text-on-surface-variant mr-2 shrink-0" />
              <input
                className="bg-transparent border-none p-0 focus:ring-0 text-body-md text-on-surface w-full placeholder:text-on-surface-variant/70 outline-none min-w-[120px]"
                placeholder="搜索任务名、文件名或场景…"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(""); updateParams({ q: undefined, page: undefined }); }} className="text-on-surface-variant hover:text-on-surface ml-1 cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Status */}
            <select
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md font-label-md rounded-lg px-3 py-1.5 appearance-none"
              value={status}
              onChange={(e) => updateParams({ status: e.target.value, page: undefined })}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Artifact */}
            <select
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md font-label-md rounded-lg px-3 py-1.5 appearance-none"
              value={artifact}
              onChange={(e) => updateParams({ artifact: e.target.value, page: undefined })}
            >
              {ARTIFACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Range */}
            <select
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md font-label-md rounded-lg px-3 py-1.5 appearance-none"
              value={range}
              onChange={(e) => updateParams({ range: e.target.value, page: undefined })}
            >
              {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Sort */}
            <select
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md font-label-md rounded-lg px-3 py-1.5 appearance-none"
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value, page: undefined })}
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Clear */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-label-md font-label-md text-on-surface-variant hover:text-on-surface px-2 py-1.5 cursor-pointer"
              >
                清空筛选
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="py-3 px-lg text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">案例名称</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">场景</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">反馈数</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">状态</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">硬性校验</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">语义评分</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">产物</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">重试</th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Worker 步骤</th>
                  <th className="py-3 px-lg text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {loading && (
                  <tr><td colSpan={10} className="py-8 px-6 text-center text-on-surface-variant">加载中...</td></tr>
                )}
                {!loading && runs.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 px-6 text-center">
                      {hasActiveFilters ? (
                        <>
                          <p className="text-body-lg font-body-lg text-on-surface mb-sm">没有找到匹配的运行记录。</p>
                          <p className="text-body-md font-body-md text-on-surface-variant mb-md">请调整搜索词、状态筛选或时间范围。</p>
                          <button onClick={clearFilters} className="text-primary font-label-md hover:underline cursor-pointer">清空筛选条件</button>
                        </>
                      ) : (
                        <>
                          <p className="text-body-lg font-body-lg text-on-surface mb-sm">还没有分析任务。</p>
                          <p className="text-body-md font-body-md text-on-surface-variant mb-md">上传一份 CSV，系统会自动生成反馈分析报告。</p>
                          <a href="/new-analysis" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-container text-white rounded-lg font-label-md hover:bg-primary transition-colors">新建分析任务</a>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {!loading && runs.map((run) => {
                  const caseName = getCaseName(run);
                  const semanticScore = getRunSemanticScore(run as RunLike);
                  const statusVal = getRunDisplayStatus(run as RunLike);
                  const stale = isStaleRunning(run as RunLike);
                  const workerStep = getWorkerStep(run as RunLike);
                  const retryCount = (run as any).retryCount ?? 0;
                  const maxRetry = (run as any).maxRetry ?? 2;
                  const artSummary = artifactSummary[run.id || ""];
                  const hasOverallMd = artSummary?.hasOverallMd ?? (run as any).artifacts?.markdown ?? false;
                  const artCount = artSummary?.count ?? 0;

                  const badgeClass = stale ? "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]" : getRunStatusBadgeClass(statusVal);
                  const label = stale ? "可能卡住" : getRunStatusLabel(statusVal);

                  return (
                    <tr key={run.id || caseName} className="hover:bg-surface-container-low transition-colors group">
                      <td className="py-4 px-lg text-body-md font-body-md text-on-surface font-medium">
                        <div className="flex items-center gap-2">
                          <FolderOpen size={16} className="text-on-surface-variant/60" />
                          <a href={`/runs/${encodeURIComponent(caseName)}`} className="hover:underline">{caseName}</a>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">{getScenarioDisplayName(getScenario(run))}</td>
                      <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">{getFeedbackCount(run)}</td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-bold border ${badgeClass}`}>{label}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-primary">{getRunHardValidationLabel(run as RunLike)}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-primary">{semanticScore !== null ? semanticScore : "未生成"}</span>
                      </td>
                      <td className="py-4 px-4">
                        {artCount > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm font-label-sm ${hasOverallMd ? "bg-emerald-50 text-emerald-700" : "bg-yellow-50 text-yellow-700"}`}>
                            {hasOverallMd ? `${artCount} 产物` : `${artCount} 缺报告`}
                          </span>
                        ) : (
                          <span className="text-label-sm font-label-sm text-on-surface-variant">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">{retryCount} / {maxRetry}</td>
                      <td className="py-4 px-4 text-label-md font-label-md text-on-surface-variant max-w-[140px] truncate" title={workerStep || undefined}>{workerStep || "-"}</td>
                      <td className="py-4 px-lg text-right">
                        {hasOverallMd ? (
                          <a href={`/runs/${encodeURIComponent(caseName)}`} className="text-primary font-label-md font-medium hover:underline">查看报告</a>
                        ) : statusVal === "running" ? (
                          <span className="text-blue-600 font-label-md flex items-center justify-end gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />处理中</span>
                        ) : statusVal === "failed" ? (
                          <a href={`/runs/${encodeURIComponent(caseName)}`} className="text-[#8A2F2F] font-label-md font-medium hover:underline">查看错误</a>
                        ) : statusVal === "pending" ? (
                          <span className="text-on-surface-variant font-label-md">排队中</span>
                        ) : (
                          <span className="text-on-surface-variant font-label-md">报告待生成</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="px-lg py-md border-t border-outline-variant bg-surface-container-low flex items-center justify-between">
              <div className="text-label-md font-label-md text-on-surface-variant">
                共 {total} 条，第 {page} / {totalPages} 页
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md font-label-md rounded px-2 py-1 appearance-none"
                  value={pageSize}
                  onChange={(e) => updateParams({ pageSize: e.target.value, page: undefined })}
                >
                  {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s} 条/页</option>)}
                </select>
                <button
                  disabled={page <= 1}
                  onClick={() => updateParams({ page: String(page - 1) })}
                  className="px-3 py-1.5 rounded border border-outline-variant text-label-md font-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-lowest transition-colors cursor-pointer disabled:cursor-default"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: String(page + 1) })}
                  className="px-3 py-1.5 rounded border border-outline-variant text-label-md font-label-md text-on-surface disabled:opacity-40 hover:bg-surface-container-lowest transition-colors cursor-pointer disabled:cursor-default"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
