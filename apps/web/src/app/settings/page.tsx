"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

type TabKey = "workspace" | "engine" | "validationExport" | "customScenarios" | "apiKeys";

const navItems: { id: TabKey; icon: string; label: string }[] = [
  { id: "workspace", icon: "workspaces", label: "工作区" },
  { id: "engine", icon: "psychology", label: "分析引擎" },
  { id: "validationExport", icon: "verified", label: "验证与导出" },
  { id: "customScenarios", icon: "category", label: "自定义场景" },
  { id: "apiKeys", icon: "key", label: "API 密钥" },
];

const STORAGE_KEY = "proofloop_api_keys";

type ApiKeys = { openai: string; anthropic: string; deepseek: string };

function maskKey(k: string) {
  if (!k) return "";
  if (k.length <= 8) return "****";
  return k.slice(0, 4) + "****" + k.slice(-4);
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input checked={checked} onChange={onChange} className="sr-only peer" type="checkbox" />
      <div className="w-11 h-6 bg-[#E5DED0] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#E5DED0] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#58624a]" />
    </label>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("workspace");
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Workspace
  const [wsName, setWsName] = useState("Acme Corp 研究室");
  const [shareApproval, setShareApproval] = useState(true);

  // Engine
  const [model, setModel] = useState("deepseek-v4-pro");
  const [threshold, setThreshold] = useState(85);
  const [defaultScenario, setDefaultScenario] = useState("auto");
  const [maxUpload, setMaxUpload] = useState(10);

  // Validation & Export
  const [hardVal, setHardVal] = useState(true);
  const [semVal, setSemVal] = useState(true);
  const [minEvidence, setMinEvidence] = useState("3条");
  const [expMd, setExpMd] = useState(true);
  const [expJson, setExpJson] = useState(true);
  const [expCsv, setExpCsv] = useState(true);
  const [expZip, setExpZip] = useState(false);
  const [expPdf, setExpPdf] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  // Custom scenarios
  const [showModal, setShowModal] = useState(false);
  const [scenarios, setScenarios] = useState([
    { name: "教育 SaaS 课程留存", goal: "提升课程完成率", metrics: 4, keywords: 18 },
    { name: "医疗 App 预约体验", goal: "提升预约成功率", metrics: 5, keywords: 22 },
  ]);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ openai: "", anthropic: "", deepseek: "" });
  const [apiInputs, setApiInputs] = useState<ApiKeys>({ openai: "", anthropic: "", deepseek: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setApiKeys(JSON.parse(raw));
    } catch {}
  }, []);

  const saveApiKeys = (next: ApiKeys) => {
    setApiKeys(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex antialiased">
      <Sidebar />
      {toast && (
        <div className="fixed top-20 right-8 z-50 bg-primary text-on-primary px-4 py-3 rounded-lg shadow-diffused font-label-md text-label-md animate-fade-in">
          {toast}
        </div>
      )}
      <div className="flex-1 md:ml-[280px] flex flex-col min-h-screen">
        <header className="bg-surface border-b border-outline-variant flex justify-between items-center h-16 px-8 sticky top-0 z-30">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
            <input className="bg-surface-container-low border border-outline-variant text-on-surface font-body-md text-body-md rounded-full py-1.5 pl-10 pr-4 w-64 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant/60" placeholder="搜索设置..." type="text" />
          </div>
          <div className="flex items-center gap-4">
            <button className="text-on-surface-variant hover:text-primary p-2 rounded-full hover:bg-surface-variant">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </button>
            <button className="text-on-surface-variant hover:text-primary p-2 rounded-full hover:bg-surface-variant hidden sm:block">
              <span className="material-symbols-outlined text-[22px]">help_outline</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-lg bg-surface max-w-[1200px] mx-auto w-full">
          <div className="mb-8">
            <h1 className="font-headline-md text-headline-md text-primary mb-2">系统设置</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">管理工作区偏好、分析引擎与平台集成。</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-lg items-start">
            {/* Left Nav — 5 tabs */}
            <nav className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 sticky top-24">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`font-label-md text-label-md text-left px-4 py-3 rounded-lg transition-colors whitespace-nowrap lg:whitespace-normal flex items-center gap-3 ${
                    activeTab === item.id
                      ? "bg-[#EFE4CC] text-primary font-bold border-l-2 lg:border-l-4 border-primary"
                      : "text-on-surface-variant hover:bg-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Right Content */}
            <div className="flex-1 w-full flex flex-col gap-md">
              {/* ══════════ Tab 1: 工作区 ══════════ */}
              {activeTab === "workspace" && (
                <>
                  <SectionHeader title="工作区偏好" desc="管理工作区名称、共享方式和基础展示信息。" />
                  <Card title="常规">
                    <Field label="工作区名称" htmlFor="ws-name">
                      <input id="ws-name" value={wsName} onChange={(e) => setWsName(e.target.value)} className="w-full md:w-2/3 bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
                    </Field>
                    <ToggleRow label="公开分享需审批" desc="分析师在生成公开链接前需请求权限。" checked={shareApproval} onChange={() => setShareApproval(!shareApproval)} />
                  </Card>
                  <Card title="成员与权限">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-on-surface-variant w-24">当前模式</span>
                        <span className="px-2.5 py-0.5 rounded bg-[#E7ECDD] text-[#58624a] text-xs font-medium border border-[#CAD5B8]">本地 Demo 模式</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-on-surface-variant w-24">管理员</span>
                        <span className="text-sm text-on-surface font-medium">系统管理员</span>
                      </div>
                      <p className="text-xs text-on-surface-variant pt-2 border-t border-[#E5DED0]/50">正式团队权限将在 SaaS 版本启用。</p>
                    </div>
                  </Card>
                  <SaveActions onSave={() => showToast("设置已保存")} onCancel={() => showToast("已放弃修改")} />
                </>
              )}

              {/* ══════════ Tab 2: 分析引擎 ══════════ */}
              {activeTab === "engine" && (
                <>
                  <SectionHeader title="分析引擎" desc="配置 AI 分析、语义评分和问题聚类行为。" />
                  <Card title="默认模型">
                    <Field label="默认 AI 模型" htmlFor="model">
                      <div className="relative md:w-2/3">
                        <select id="model" value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer">
                          <option value="balanced">ProofLoop Balanced（推荐）</option>
                          <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="claude-sonnet">Claude Sonnet</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                      </div>
                    </Field>
                  </Card>
                  <Card title="语义评分阈值">
                    <div className="flex justify-between items-end mb-4">
                      <p className="text-sm text-on-surface-variant">低于阈值的报告会进入复核队列。</p>
                      <span className="font-label-md text-label-md bg-[#E7ECDD] text-[#58624a] px-2 py-1 rounded">{threshold}%</span>
                    </div>
                    <input className="w-full h-2 bg-[#E5DED0] rounded-lg appearance-none cursor-pointer accent-[#58624a]" max="100" min="50" type="range" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
                    <div className="flex justify-between mt-2 font-label-sm text-label-sm text-on-surface-variant"><span>宽松 (50%)</span><span>严格 (100%)</span></div>
                  </Card>
                  <Card title="分析场景默认值">
                    <Field label="默认场景" htmlFor="scenario">
                      <div className="relative md:w-2/3">
                        <select id="scenario" value={defaultScenario} onChange={(e) => setDefaultScenario(e.target.value)} className="w-full bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer">
                          <option value="auto">自动识别</option>
                          <option value="enterprise-saas-renewal">企业 SaaS 续费</option>
                          <option value="new-user-activation">新用户激活</option>
                          <option value="ai-product-experience">AI 产品体验</option>
                          <option value="bi-dashboard-renewal">BI 报表续费</option>
                          <option value="ecommerce-conversion">电商转化</option>
                          <option value="internal-tool-efficiency">内部工具效率</option>
                          <option value="mixed-feedback">混合反馈</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                      </div>
                    </Field>
                  </Card>
                  <Card title="上传限制">
                    <Field label="最大上传大小" htmlFor="upload-limit">
                      <div className="flex items-center gap-2 md:w-2/3">
                        <input id="upload-limit" type="number" min={1} max={100} value={maxUpload} onChange={(e) => setMaxUpload(Number(e.target.value))} className="w-24 bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
                        <span className="text-sm text-on-surface-variant">MB</span>
                      </div>
                    </Field>
                  </Card>
                  <SaveActions onSave={() => showToast("设置已保存")} onCancel={() => showToast("已放弃修改")} />
                </>
              )}

              {/* ══════════ Tab 3: 验证与导出 ══════════ */}
              {activeTab === "validationExport" && (
                <>
                  <SectionHeader title="验证与导出" desc="控制报告校验、证据链追踪和产物导出规则。" />
                  <Card title="验证规则">
                    <ToggleRow label="默认开启硬性校验 Hard Validation" desc="对反馈数据执行字段完整性与格式规则校验。" checked={hardVal} onChange={() => setHardVal(!hardVal)} />
                    <ToggleRow label="默认开启语义校验 Semantic Validation" desc="通过 AI 评估分析结论的逻辑一致性与语义准确性。" checked={semVal} onChange={() => setSemVal(!semVal)} />
                    <div className="pt-4 border-t border-[#E5DED0]/50">
                      <Field label="每个高优先级问题至少需要" htmlFor="min-ev">
                        <div className="relative md:w-1/3">
                          <select id="min-ev" value={minEvidence} onChange={(e) => setMinEvidence(e.target.value)} className="w-full bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 font-body-md text-body-md text-on-surface appearance-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer">
                            <option value="1条">1 条</option>
                            <option value="2条">2 条</option>
                            <option value="3条">3 条</option>
                            <option value="5条">5 条</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">expand_more</span>
                        </div>
                      </Field>
                    </div>
                  </Card>
                  <Card title="导出格式">
                    <div className="flex flex-wrap gap-5">
                      {[
                        { label: "Markdown 报告", checked: expMd, onChange: setExpMd },
                        { label: "JSON 结构化数据", checked: expJson, onChange: setExpJson },
                        { label: "证据链 CSV", checked: expCsv, onChange: setExpCsv },
                        { label: "全部产物 ZIP", checked: expZip, onChange: setExpZip },
                        { label: "PDF 报告", checked: expPdf, onChange: setExpPdf },
                      ].map((o) => (
                        <label key={o.label} className="flex items-center gap-2 cursor-pointer">
                          <input checked={o.checked} onChange={() => o.onChange(!o.checked)} className="w-4 h-4 rounded border-[#E5DED0] text-[#58624a] focus:ring-[#58624a]" type="checkbox" />
                          <span className="text-sm text-on-surface">{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </Card>
                  <Card title="自动保存分析产物">
                    <ToggleRow label="自动保存" desc="分析完成后自动保存 Markdown、JSON、校验摘要和证据链文件。" checked={autoSave} onChange={() => setAutoSave(!autoSave)} />
                  </Card>
                  <SaveActions onSave={() => showToast("设置已保存")} onCancel={() => showToast("已放弃修改")} />
                </>
              )}

              {/* ══════════ Tab 4: 自定义场景 ══════════ */}
              {activeTab === "customScenarios" && (
                <>
                  <SectionHeader title="自定义分析场景" desc="管理用户自定义的分析类型、业务目标和问题关键词映射。" />
                  <div className="bg-[#FFFCF5] border border-[#E5DED0] rounded-[24px] shadow-diffused overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#E5DED0] bg-[#F7F3EA]">
                            <th className="px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">场景名称</th>
                            <th className="px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">业务目标</th>
                            <th className="px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-center">指标数量</th>
                            <th className="px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-center">问题关键词数量</th>
                            <th className="px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {scenarios.map((s, i) => (
                            <tr key={i} className="border-b border-[#E5DED0]/50 hover:bg-[#F7F3EA] transition-colors">
                              <td className="px-5 py-3 font-medium text-on-surface">{s.name}</td>
                              <td className="px-5 py-3 text-on-surface-variant">{s.goal}</td>
                              <td className="px-5 py-3 text-center text-on-surface-variant">{s.metrics}</td>
                              <td className="px-5 py-3 text-center text-on-surface-variant">{s.keywords}</td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <button className="text-xs text-primary font-medium hover:underline">编辑</button>
                                  <button onClick={() => { setScenarios(scenarios.filter((_, j) => j !== i)); showToast("场景已删除"); }} className="text-xs text-[#ba1a1a] font-medium hover:underline">删除</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-5 py-4 border-t border-[#E5DED0]">
                      <button onClick={() => setShowModal(true)} className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-5 rounded-lg hover:opacity-90 transition-opacity shadow-diffused flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        新建自定义场景
                      </button>
                    </div>
                  </div>

                  {/* New Scenario Modal */}
                  {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
                      <div className="bg-[#FFFCF5] border border-[#E5DED0] rounded-[24px] shadow-2xl max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-[#E5DED0]">
                          <h3 className="text-lg font-bold text-primary">新建自定义场景</h3>
                        </div>
                        <div className="p-6 space-y-4">
                          {["场景名称", "业务目标", "场景描述", "关注指标", "默认分组", "问题关键词映射"].map((label) => (
                            <div key={label}>
                              <label className="block text-sm font-medium text-on-surface mb-1">{label}</label>
                              {label === "场景描述" || label === "关注指标" || label === "问题关键词映射" ? (
                                <textarea rows={2} className="w-full bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none" />
                              ) : (
                                <input className="w-full bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="px-6 py-4 border-t border-[#E5DED0] flex gap-3 justify-end">
                          <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-[#E5DED0] text-sm font-medium text-on-surface hover:bg-[#F7F3EA] transition-colors">取消</button>
                          <button onClick={() => { setShowModal(false); showToast("场景已保存"); }} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:opacity-90 transition-opacity">保存</button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ══════════ Tab 5: API 密钥 ══════════ */}
              {activeTab === "apiKeys" && (
                <>
                  <SectionHeader title="API 密钥" desc="配置用于 AI 分析、语义校验和模型调用的第三方服务密钥。密钥仅保存在本地环境或后端安全配置中，前端不应明文暴露已保存密钥。" />

                  {/* Key inputs */}
                  <Card title="模型服务 Key">
                    <div className="space-y-5">
                      {([
                        { key: "openai" as const, label: "OpenAI API Key", placeholder: "sk-********************************" },
                        { key: "anthropic" as const, label: "Anthropic API Key", placeholder: "sk-ant-****************************" },
                        { key: "deepseek" as const, label: "DeepSeek API Key", placeholder: "sk-********************************" },
                      ]).map((field) => (
                        <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <label className="text-sm font-medium text-on-surface w-40 shrink-0">{field.label}</label>
                          <input
                            type="password"
                            placeholder={field.placeholder}
                            value={apiInputs[field.key]}
                            onChange={(e) => setApiInputs({ ...apiInputs, [field.key]: e.target.value })}
                            className="flex-1 bg-[#FFFCF5] border border-[#E5DED0] rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-mono"
                          />
                          <button
                            onClick={() => {
                              saveApiKeys({ ...apiKeys, [field.key]: apiInputs[field.key] });
                              setApiInputs({ ...apiInputs, [field.key]: "" });
                              showToast("API 密钥已保存到本地 Demo 配置");
                            }}
                            className="bg-primary text-on-primary text-xs font-medium py-2 px-4 rounded-lg hover:opacity-90 transition-opacity shrink-0"
                          >
                            保存
                          </button>
                          {apiKeys[field.key] && (
                            <button
                              onClick={() => { saveApiKeys({ ...apiKeys, [field.key]: "" }); showToast("API 密钥已清除"); }}
                              className="text-xs text-[#ba1a1a] font-medium hover:underline shrink-0"
                            >
                              清除
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Connection status */}
                  <Card title="当前连接状态">
                    <div className="space-y-3">
                      {([
                        { key: "openai" as const, label: "OpenAI" },
                        { key: "anthropic" as const, label: "Anthropic" },
                        { key: "deepseek" as const, label: "DeepSeek" },
                      ]).map((s) => (
                        <div key={s.key} className="flex items-center justify-between py-2 border-b border-[#E5DED0]/50 last:border-0">
                          <span className="text-sm font-medium text-on-surface">{s.label}</span>
                          {apiKeys[s.key] ? (
                            <span className="px-2.5 py-0.5 rounded bg-[#E7ECDD] text-[#58624a] text-xs font-medium border border-[#CAD5B8]">
                              已配置 · {maskKey(apiKeys[s.key])}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded bg-[#E5DED0] text-on-surface-variant text-xs font-medium">未配置</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Security note */}
                  <div className="bg-[#F7F3EA] border border-[#E5DED0] rounded-xl p-4 flex items-start gap-3">
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">info</span>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      API 密钥用于本地 Demo 或私有部署环境的模型调用。生产环境建议通过服务端环境变量配置，不要在浏览器中长期保存明文密钥。
                    </p>
                  </div>

                  {/* Test connection */}
                  <div>
                    <button onClick={() => showToast("连接测试功能将在后续版本启用")} className="bg-[#E5DED0] text-on-surface font-label-md text-label-md py-2.5 px-5 rounded-lg hover:bg-[#D8D0C4] transition-colors flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">lan</span>
                      测试连接
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Shared sub-components ── */

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-[#E5DED0] pb-4 mb-2">
      <h2 className="font-headline-sm text-headline-sm text-primary">{title}</h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-2xl">{desc}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#FFFCF5] border border-[#E5DED0] rounded-[24px] p-6 md:p-8">
      <h3 className="font-title-lg text-title-lg text-primary mb-6">{title}</h3>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h4 className="font-body-lg text-body-lg text-on-surface font-medium">{label}</h4>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">{desc}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SaveActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-4 mt-4">
      <button onClick={onCancel} className="bg-[#E5DED0] text-on-surface font-label-md text-label-md py-2.5 px-6 rounded-lg hover:bg-[#D8D0C4] transition-colors">取消</button>
      <button onClick={onSave} className="bg-primary text-on-primary font-label-md text-label-md py-2.5 px-6 rounded-lg hover:opacity-90 transition-opacity shadow-diffused">保存更改</button>
    </div>
  );
}
