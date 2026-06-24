"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { FolderOpen, Filter, Play } from "lucide-react";
import { getScenarioDisplayName } from "@/lib/report-display";
import {
  getRunDisplayStatus,
  getRunStatusLabel,
  getRunStatusBadgeClass,
  type RunLike,
} from "@/lib/run-status";
import type { RunListItem } from "@/lib/types/run";

export default function RunsPage() {
  const [runs, setRuns] = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const getCaseName = (r: RunListItem) => r.caseName || r.case_name || "未命名分析";
  const getScenario = (r: RunListItem) => r.scenario || r.dataset || "mixed-feedback";
  const getFeedbackCount = (r: RunListItem) => r.feedbackCount ?? r.count ?? 0;
  const getHardScore = (r: RunListItem) => r.hardScore ?? r.hardValidation?.score ?? null;
  const getSemanticScore = (r: RunListItem) => r.semanticScore ?? r.semanticValidation?.score ?? null;
  const getDuration = (r: RunListItem) => r.durationMs ?? r.duration_ms ?? null;

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
              />
            </div>
            <select className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md font-body-md rounded-lg px-4 py-2 appearance-none">
              <option value="all">状态：全部</option>
              <option value="pending">等待中</option>
              <option value="running">运行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
            </select>
            <select className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md font-body-md rounded-lg px-4 py-2 appearance-none">
              <option value="all">场景：全部</option>
              <option value="enterprise">企业 SaaS</option>
              <option value="consumer">消费应用</option>
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
                {!loading && runs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 px-6 text-center text-on-surface-variant">
                      暂无运行记录
                    </td>
                  </tr>
                )}
                {runs.map((r) => {
                  const caseName = getCaseName(r);
                  const hardScore = getHardScore(r);
                  const semanticScore = getSemanticScore(r);
                  const duration = getDuration(r);
                  const status = getRunDisplayStatus(r as RunLike);

                  return (
                    <tr
                      key={r.id || caseName}
                      className="hover:bg-surface-container-low transition-colors group"
                    >
                      <td className="py-4 px-lg text-body-md font-body-md text-on-surface font-medium flex items-center gap-2">
                        <FolderOpen size={16} className="text-on-surface-variant/60" />
                        {caseName}
                      </td>
                      <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">
                        {getScenarioDisplayName(getScenario(r))}
                      </td>
                      <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">
                        {getFeedbackCount(r)}
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-primary">
                          {hardScore !== null && hardScore !== undefined ? hardScore : "未生成"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-label-sm font-label-sm bg-surface-container-high text-primary">
                          {semanticScore !== null && semanticScore !== undefined ? semanticScore : "未生成"}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm font-bold border ${getRunStatusBadgeClass(status)}`}>
                          {getRunStatusLabel(status)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-body-md font-body-md text-on-surface-variant">
                        {duration
                          ? duration < 1000
                            ? `${duration}ms`
                            : `${(duration / 1000).toFixed(1)}s`
                          : "-"}
                      </td>
                      <td className="py-4 px-lg text-right">
                        {r.status === "completed" ? (
                          <a
                            href={`/runs/${caseName}`}
                            className="text-primary hover:text-primary font-label-md transition-colors opacity-0 group-hover:opacity-100"
                          >
                            查看报告
                          </a>
                        ) : (
                          <span className="text-on-surface-variant font-label-md">
                            等待报告
                          </span>
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
