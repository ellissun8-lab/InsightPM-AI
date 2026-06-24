import fs from "fs";
import path from "path";
import Sidebar from "@/components/Sidebar";
import { Search, Bell, HelpCircle, Plus, TrendingUp } from "lucide-react";
import { getScenarioDisplayName } from "@/lib/report-display";

const ROOT = path.resolve(process.cwd(), "../..");

async function getEvalData() {
  let summary: any = null;
  let results: any[] = [];

  try {
    summary = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "evaluation-data/evaluation-summary.json"),
        "utf-8"
      )
    );
  } catch {}

  try {
    const resultsDir = path.join(ROOT, "evaluation-data/results");
    if (fs.existsSync(resultsDir)) {
      for (const f of fs
        .readdirSync(resultsDir)
        .filter((f) => f.endsWith(".evaluation.json"))) {
        try {
          results.push(
            JSON.parse(
              fs.readFileSync(path.join(resultsDir, f), "utf-8")
            )
          );
        } catch {}
      }
    }
  } catch {}

  return { summary, results };
}

export default async function EvaluationPage() {
  const { summary, results } = await getEvalData();

  const avgSemantic =
    results.length > 0
      ? (
          results.reduce(
            (s, r) => s + (r.metrics?.semantic_score || 0),
            0
          ) / results.length
        ).toFixed(1)
      : "-";

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-[280px] flex-1 flex flex-col min-h-screen">
        <header className="h-16 w-full bg-[#F7F3EA] border-b border-[#E5DED0] flex justify-between items-center px-lg sticky top-0 z-40">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-full text-body-md font-body-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="搜索..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-md">
            <button className="w-10 h-10 rounded-full hover:bg-surface-variant transition-all flex items-center justify-center text-on-surface-variant">
              <Bell size={20} />
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-surface-variant transition-all flex items-center justify-center text-on-surface-variant">
              <HelpCircle size={20} />
            </button>
          </div>
        </header>

        <main className="ml-[280px] pt-16 p-margin-desktop min-h-screen">
          <div className="mb-xl">
            <h1 className="text-headline-lg font-display-lg text-on-surface mb-xs">
              评估校验 (Evaluation)
            </h1>
            <p className="text-body-lg font-body-md text-on-surface-variant">
              对比不同模型的语义评分与 Hard 校验通过率。
            </p>
          </div>

          <div className="grid grid-cols-12 gap-gutter mb-xl">
            <div className="col-span-12 md:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg relative overflow-hidden flex flex-col justify-between card-shadow">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-surface-container-high to-transparent rounded-bl-full pointer-events-none"></div>
              <div>
                <h2 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-sm">
                  全局基准评分
                </h2>
                <div className="flex items-end gap-md">
                  <span className="text-display-lg font-display-lg text-primary">
                    {avgSemantic}%
                  </span>
                  <span className="text-body-md font-body-md text-emerald-600 flex items-center mb-2">
                    <TrendingUp size={14} className="mr-1" /> 本周 +1.2%
                  </span>
                </div>
              </div>
              <div className="mt-xl h-24 relative w-full border-b border-l border-outline-variant/30">
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#4b463f" stopOpacity="0.3" />
                      <stop offset="50%" stopColor="#4b463f" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#4b463f" stopOpacity="1" />
                    </linearGradient>
                    <linearGradient id="areaGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#4b463f" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#4b463f" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,80 Q10,70 20,75 T40,60 T60,50 T80,30 T100,20 L100,100 L0,100 Z" fill="url(#areaGradient)" />
                  <path d="M0,80 Q10,70 20,75 T40,60 T60,50 T80,30 T100,20" fill="none" stroke="url(#lineGradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                </svg>
              </div>
            </div>

            <div className="col-span-12 md:col-span-4 flex flex-col gap-gutter">
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md flex-1 card-shadow">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-sm font-headline-sm">
                  总评估数
                </h3>
                <div className="text-headline-lg font-headline-lg text-on-surface">
                  {results.length}
                </div>
                <div className="w-full bg-surface-variant h-1 rounded-full mt-md overflow-hidden">
                  <div className="bg-purple-500 h-full w-[85%] rounded-full"></div>
                </div>
              </div>
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md flex-1 card-shadow">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-sm font-headline-sm">
                  活跃模型
                </h3>
                <div className="text-headline-lg font-headline-lg text-on-surface">
                  1
                </div>
                <div className="flex gap-2 mt-sm">
                  <span className="px-2 py-1 bg-surface-container-high text-primary rounded text-label-md font-label-md">
                    DeepSeek V4
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-gutter">
            <div className="col-span-12 xl:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden card-shadow">
              <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <h3 className="text-title-lg font-headline-sm text-on-surface font-semibold">
                  评估集
                </h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-primary-container text-white rounded-lg text-label-md font-label-md hover:bg-primary transition-opacity">
                  <Plus size={16} /> 新建评估
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/50">
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                        基准名称
                      </th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                        模型
                      </th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">
                        语义评分
                      </th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">
                        硬性校验通过率
                      </th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">
                        证据
                      </th>
                      <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">
                        日期
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md font-body-md text-on-surface">
                    {results.map((r: any) => (
                      <tr key={r.caseName} className="border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors">
                        <td className="px-lg py-md font-medium">{r.caseName}</td>
                        <td className="px-lg py-md text-on-surface-variant">DeepSeek V4 Pro</td>
                        <td className="px-lg py-md text-right">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-label-md font-label-md">
                            {r.metrics?.semantic_score || "-"}
                          </span>
                        </td>
                        <td className="px-lg py-md text-right">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-label-md font-label-md">
                            {r.metrics?.evidence_trace_accuracy || "-"}%
                          </span>
                        </td>
                        <td className="px-lg py-md text-right">
                          {r.metrics?.segment_count_accuracy || "-"}
                        </td>
                        <td className="px-lg py-md text-on-surface-variant text-label-md font-label-md">
                          {r.timestamp ? new Date(r.timestamp).toISOString().split("T")[0] : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-span-12 xl:col-span-4 bg-surface-container-lowest rounded-xl border border-outline-variant p-lg flex flex-col card-shadow">
              <h3 className="text-title-lg font-headline-sm text-on-surface font-semibold mb-xs">
                错误分布
              </h3>
              <p className="text-label-md font-label-md text-on-surface-variant mb-xl">
                所有模型 (近 7 天)
              </p>
              <div className="flex-1 flex flex-col justify-center gap-md">
                <div className="flex items-center gap-md">
                  <div className="w-24 text-body-md font-body-md text-on-surface truncate">逻辑错误</div>
                  <div className="flex-1 h-3 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full w-[45%]"></div>
                  </div>
                  <div className="w-12 text-right text-label-md font-label-md text-on-surface-variant">45%</div>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 text-body-md font-body-md text-on-surface truncate">幻觉</div>
                  <div className="flex-1 h-3 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full w-[35%]"></div>
                  </div>
                  <div className="w-12 text-right text-label-md font-label-md text-on-surface-variant">35%</div>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 text-body-md font-body-md text-on-surface truncate">格式错误</div>
                  <div className="flex-1 h-3 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full w-[20%]"></div>
                  </div>
                  <div className="w-12 text-right text-label-md font-label-md text-on-surface-variant">20%</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
