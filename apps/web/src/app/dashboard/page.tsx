"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardToolbar from "@/components/DashboardToolbar";
import TodayOverview from "@/components/TodayOverview";
import { getScenarioDisplayName } from "@/lib/report-display";
import {
  type TimeRange,
  type RunRecord,
  filterRunsByTimeRange,
  hasReliableTimeData,
} from "@/lib/dashboard-filter";
import {
  getRunDisplayStatus,
  getRunStatusLabel,
  getRunStatusBadgeClass,
  getRunHardScoreLabel,
  type RunLike,
} from "@/lib/run-status";

export default function DashboardPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [datasets, setDatasets] = useState({ totalDatasets: 0, acceptedCount: 0, totalFeedbacks: 0 });
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [hasTimeData, setHasTimeData] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/runs");
      const data = await res.json();
      setRuns(data.runs || []);
      setDatasets(data.datasets || { totalDatasets: 0, acceptedCount: 0, totalFeedbacks: 0 });
      setHasTimeData(hasReliableTimeData(data.runs || []));
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRuns = filterRunsByTimeRange(runs, timeRange);

  return (
    <div className="bg-surface text-on-surface font-body-md antialiased min-h-screen flex selection:bg-secondary-container selection:text-on-secondary-container">
      <Sidebar />
      <div className="flex-1 ml-[280px] flex flex-col min-h-screen">
        {/* TopNavBar */}
        <header className="fixed top-0 right-0 left-[280px] h-16 px-8 flex justify-between items-center bg-surface border-b border-outline-variant z-10">
          <div className="relative w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input className="w-full pl-10 pr-4 py-2 bg-surface-bright border border-outline-variant rounded-full font-label-sm text-label-sm text-on-surface focus:outline-none focus:border-primary transition-colors" placeholder="搜索洞察..." type="text" />
          </div>
          <div className="flex items-center gap-6">
            <button className="text-on-surface-variant hover:text-primary transition-opacity opacity-80 relative">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-0 right-0 w-2 h-2 bg-secondary rounded-full" />
            </button>
            <button className="text-on-surface-variant hover:text-primary transition-opacity opacity-80">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
          </div>
        </header>

        {/* Dashboard Canvas */}
        <main className="flex-1 pt-24 pb-16 px-8 lg:px-12 xl:px-16 max-w-[1440px] mx-auto w-full">
          {/* Page Header */}
          <div className="mb-lg flex justify-between items-end">
            <div>
              <h2 className="font-headline-md text-headline-md text-primary mb-2">控制台</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {hasTimeData
                  ? "以下是您反馈流的最新分析结果。"
                  : "以下是全部本地分析结果。当前数据缺少可靠时间字段，时间筛选暂不可用。"}
              </p>
            </div>
            <DashboardToolbar
              timeRange={timeRange}
              hasTimeData={hasTimeData}
              onTimeRangeChange={setTimeRange}
              onRefresh={fetchData}
            />
          </div>

          {/* Today Overview */}
          <TodayOverview />

          {/* Bento Grid: Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md mb-xl">
            <div className="bg-surface-bright border border-outline-variant rounded-xl p-8 shadow-diffused">
              <div className="flex justify-between items-start mb-6">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">已采纳数据集</span>
                <span className="material-symbols-outlined text-secondary bg-secondary-container rounded-full p-2 text-[20px]">forum</span>
              </div>
              <div className="font-display-lg text-display-lg text-primary mb-2">{datasets.acceptedCount}</div>
              <div className="font-label-sm text-label-sm flex items-center gap-1 text-secondary">
                <span className="material-symbols-outlined text-[14px]">trending_up</span>
                训练反馈 {datasets.totalFeedbacks.toLocaleString()} 条
              </div>
            </div>
            <div className="bg-surface-bright border border-outline-variant rounded-xl p-8 shadow-diffused">
              <div className="flex justify-between items-start mb-6">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">硬性校验通过率</span>
                <span className="material-symbols-outlined text-primary bg-surface-variant rounded-full p-2 text-[20px]">verified</span>
              </div>
              <div className="font-display-lg text-display-lg text-primary mb-2">100<span className="text-headline-sm text-on-surface-variant">%</span></div>
              <div className="font-label-sm text-label-sm flex items-center gap-1 text-on-surface-variant">
                高置信阈值已达标
              </div>
            </div>
            <div className="bg-surface-bright border border-outline-variant rounded-xl p-8 shadow-diffused">
              <div className="flex justify-between items-start mb-6">
                <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">待处理报告</span>
                <span className="material-symbols-outlined text-on-surface bg-surface-container rounded-full p-2 text-[20px]">pending_actions</span>
              </div>
              <div className="font-display-lg text-display-lg text-primary mb-2">{filteredRuns.length}</div>
              <div className="font-label-sm text-label-sm flex items-center gap-1 text-on-surface-variant">
                需要人工复核
              </div>
            </div>
          </div>

          {/* Bento Grid: Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
            {/* Table Section */}
            <div className="lg:col-span-8 bg-surface-bright border border-outline-variant rounded-xl shadow-diffused overflow-hidden">
              <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-bright">
                <h3 className="font-title-lg text-title-lg text-primary">最近运行</h3>
                <a href="/runs" className="font-label-md text-label-md text-primary hover:text-on-surface-variant transition-colors">查看全部</a>
              </div>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface border-b border-outline-variant">
                      <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant font-medium uppercase tracking-wider">案例名称</th>
                      <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant font-medium uppercase tracking-wider">场景</th>
                      <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant font-medium uppercase tracking-wider text-right">反馈数</th>
                      <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant font-medium uppercase tracking-wider text-right">硬性校验</th>
                      <th className="py-4 px-6 font-label-sm text-label-sm text-on-surface-variant font-medium uppercase tracking-wider">状态</th>
                    </tr>
                  </thead>
                  <tbody className="font-body-md text-body-md text-primary divide-y divide-outline-variant">
                    {filteredRuns.slice(0, 5).map((r) => (
                      <tr key={r.case_name} className="hover:bg-surface transition-colors group cursor-pointer">
                        <td className="py-4 px-6 font-medium">
                          <a href={`/runs/${r.case_name}`} className="text-primary hover:underline">{r.case_name}</a>
                        </td>
                        <td className="py-4 px-6 text-on-surface-variant">{getScenarioDisplayName(r.dataset)}</td>
                        <td className="py-4 px-6 text-right text-on-surface-variant">{r.count}</td>
                        <td className="py-4 px-6 text-right text-on-surface-variant">{getRunHardScoreLabel(r as RunLike)}</td>
                        <td className="py-4 px-6">
                          {(() => {
                            const status = getRunDisplayStatus(r as RunLike);
                            const cls = getRunStatusBadgeClass(status);
                            return (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-label-sm border ${cls}`}>
                                {getRunStatusLabel(status)}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                    {filteredRuns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 px-6 text-center text-on-surface-variant">
                          {loading ? "加载中..." : "暂无运行记录"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Insight + Sentiment */}
            <div className="lg:col-span-4 flex flex-col gap-md">
              <div className="bg-[#EFE4CC] border-l-4 border-primary p-6 rounded-r-xl shadow-[0_4px_16px_rgba(23,21,17,0.03)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <span className="material-symbols-outlined text-[80px]">auto_awesome</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-[18px]">lightbulb</span>
                  <h4 className="font-label-md text-label-md text-primary font-bold">AI 洞察</h4>
                </div>
                <p className="font-body-md text-body-md text-primary leading-relaxed">
                  基于当前本地分析数据统计。「新用户激活」场景的情感评分本周下降 15%。主要投诉集中在新的认证流程上。
                </p>
              </div>
              <div className="bg-surface-bright border border-outline-variant rounded-xl p-6 shadow-diffused flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-title-lg text-title-lg text-primary">情感分布</h3>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-4">
                  <div>
                    <div className="flex justify-between font-label-sm text-label-sm mb-1">
                      <span className="text-secondary font-medium">正面</span>
                      <span className="text-on-surface-variant">65%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-1.5">
                      <div className="bg-secondary h-1.5 rounded-full" style={{ width: "65%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-label-sm text-label-sm mb-1">
                      <span className="text-on-surface-variant font-medium">中性</span>
                      <span className="text-on-surface-variant">25%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-1.5">
                      <div className="bg-outline-variant h-1.5 rounded-full" style={{ width: "25%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-label-sm text-label-sm mb-1">
                      <span className="text-[#93000a] font-medium">负面</span>
                      <span className="text-on-surface-variant">10%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-1.5">
                      <div className="bg-[#ba1a1a] h-1.5 rounded-full" style={{ width: "10%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
