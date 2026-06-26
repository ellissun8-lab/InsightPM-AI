"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, FolderOpen, Play } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { getScenarioDisplayName } from "@/lib/report-display";
import {
  getRunDisplayStatus,
  getRunHardValidationLabel,
  getRunSemanticScore,
  getRunStatusBadgeClass,
  getRunStatusLabel,
  hasRunReportArtifact,
  type RunDisplayStatus,
  type RunLike,
} from "@/lib/run-status";
import type { RunListItem } from "@/lib/types/run";

const STATUS_OPTIONS: Array<{ value: RunDisplayStatus | "all"; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "completed", label: "已完成" },
  { value: "review", label: "需复核" },
  { value: "failed", label: "失败" },
  { value: "partial", label: "部分完成" },
  { value: "running", label: "处理中" },
  { value: "pending", label: "等待中" },
];

function formatDuration(duration: number | null | undefined) {
  if (!duration) return "-";
  return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunDisplayStatus | "all">("all");
  const [scenarioFilter, setScenarioFilter] = useState("all");

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/runs", { cache: "no-store" });
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const getCaseName = (run: RunListItem) => run.caseName || run.case_name || "未命名分析";
  const getScenario = (run: RunListItem) => run.scenario || run.dataset || "mixed-feedback";
  const getFeedbackCount = (run: RunListItem) => run.feedbackCount ?? run.count ?? 0;
  const getDuration = (run: RunListItem) => run.durationMs ?? run.duration_ms ?? null;

  const scenarioOptions = useMemo(() => {
    const unique = Array.from(new Set(runs.map((run) => getScenario(run)).filter(Boolean)));
    return unique.sort();
  }, [runs]);

  const filteredRuns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return runs.filter((run) => {
      const caseName = getCaseName(run);
      const scenario = getScenario(run);
      const status = getRunDisplayStatus(run as RunLike);

      if (normalizedQuery && !caseName.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }
      if (scenarioFilter !== "all" && scenario !== scenarioFilter) {
        return false;
      }
      return true;
    });
  }, [query, runs, scenarioFilter, statusFilter]);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-[280px] mt-16 flex-1 p-margin-desktop bg-surface">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-headline-lg font-headline-lg text-on-surface tracking-tight">
              运行历史
            </h2>
            <p className="text-body-md font-body-md text-on-surface-variant mt-1">
              查看并管理历史 AI 分析执行记录。
            </p>
          </div>
          <a
            href="/new-analysis"
            className="bg-primary-container text-white px-4 py-2 rounded-lg text-label-md font-label-md hover:bg-primary transition-colors flex items-center gap-2 shadow-diffused"
          >
            <Play size={18} />
            新建分析
          </a>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl card-shadow overflow-hidden flex flex-col">
          <div className="p-lg border-b border-outline-variant bg-surface-container-low flex items-center gap-4">
            <div className="flex-1 flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 max-w-sm focus-within:border-primary transition-colors">
              <Filter size={18} className="text-on-surface-variant mr-2" />
              <input
                className="bg-transparent border-none p-0 focus:ring-0 text-body-md text-on-surface w-full placeholder:text-on-surface-variant/70 outline-none"
                placeholder="按案例名称筛选..."
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <select
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md font-body-md rounded-lg px-4 py-2 appearance-none"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as RunDisplayStatus | "all")}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  状态：{option.label}
                </option>
              ))}
            </select>
            <select
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md font-body-md rounded-lg px-4 py-2 appearance-none"
              value={scenarioFilter}
              onChange={(event) => setScenarioFilter(event.target.value)}
            >
              <option value="all">场景：全部</option>
              {scenarioOptions.map((scenario) => (
                <option key={scenario} value={scenario}>
                  {getScenarioDisplayName(scenario)}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant">
                  <th className="py-3 px-lg text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    案例名称
                  </th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    场景
                  </th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    反馈数
                  </th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    硬性校验
                  </th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    语义评分
                  </th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    状态
                  </th>
                  <th className="py-3 px-4 text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                    耗时
                  </th>
                  <th className="py-3 px-lg text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-8 px-6 text-center text-on-surface-variant">
                      加载中...
                    </td>
                  </tr>
                )}
                {!loading && filteredRuns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 px-6 text-center text-on-surface-variant">
                      暂无运行记录
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredRuns.map((run) => {
                    const caseName = getCaseName(run);
                    const semanticScore = getRunSemanticScore(run as RunLike);
                    const status = getRunDisplayStatus(run as RunLike);
                    const hasReport = hasRunReportArtifact(run as RunLike);

                    return (
                      <tr
                        key={run.id || caseName}
                        className="hover:bg-surface-container-low transition-colors group"
                      >
                        <td className="py-4 px-lg text-body-md font-body-md text-on-surface font-medium">
                          <div className="flex items-center gap-2">
                            <FolderOpen size={16} className="text-on-surface-variant/60" />
                            <span>{caseName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">
                          {getScenarioDisplayName(getScenario(run))}
                        </td>
                        <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">
                          {getFeedbackCount(run)}
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-primary">
                            {getRunHardValidationLabel(run as RunLike)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-primary">
                            {semanticScore !== null ? semanticScore : "未生成"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm font-bold border ${getRunStatusBadgeClass(status)}`}>
                            {getRunStatusLabel(status)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">
                          {formatDuration(getDuration(run))}
                        </td>
                        <td className="py-4 px-lg text-right">
                          {hasReport ? (
                            <a
                              href={`/runs/${encodeURIComponent(caseName)}`}
                              className="text-on-surface font-label-md font-medium hover:underline transition-colors"
                            >
                              查看报告
                            </a>
                          ) : status === "running" ? (
                            <span className="text-on-surface-variant font-label-md">处理中...</span>
                          ) : status === "failed" ? (
                            <span className="text-[#8A2F2F] font-label-md">查看错误</span>
                          ) : (
                            <span className="text-on-surface-variant font-label-md">报告未生成</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
