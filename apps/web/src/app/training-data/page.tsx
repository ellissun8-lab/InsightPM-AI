"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import { getScenarioDisplayName } from "@/lib/report-display";

interface Dataset {
  caseName: string;
  baselineType: string;
  normalizedCount: number;
  acceptedAt: string | null;
}

interface FieldTemplate {
  name: string;
  required: boolean;
  description: string;
}

interface FieldMapping {
  systemField: string;
  currentColumn: string;
  status: "已匹配" | "缺失" | "建议补充";
}

export default function TrainingDataPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    accepted: 0,
    rejected: 0,
    feedbacks: 0,
    heldout: 0,
  });
  const [loading, setLoading] = useState(true);

  // Modal state
  const [activeModal, setActiveModal] = useState<
    | null
    | "import"
    | "template"
    | "config"
    | "quality"
  >(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  // Import form state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState("");
  const [importScenario, setImportScenario] = useState("auto");
  const [importDescription, setImportDescription] = useState("");

  // Template fields state
  const [templateFields, setTemplateFields] = useState<FieldTemplate[]>([
    { name: "feedback_text", required: true, description: "用户反馈文本" },
    { name: "category", required: false, description: "问题类别" },
    { name: "sentiment", required: false, description: "情绪标签" },
    { name: "priority", required: false, description: "优先级" },
    { name: "source", required: false, description: "反馈来源" },
    { name: "created_at", required: false, description: "创建时间" },
  ]);

  // Field mapping state
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/training-data");
      const data = await res.json();
      setDatasets(data.datasets || []);
      setStats({
        total: data.total || 0,
        accepted: data.accepted || 0,
        rejected: data.rejected || 0,
        feedbacks: data.feedbacks || 0,
        heldout: data.heldout || 0,
      });
    } catch {
      setDatasets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string) => {
    setToast(message);
  };

  const openConfigModal = (ds: Dataset) => {
    setSelectedDataset(ds);
    setFieldMappings([
      { systemField: "feedback_text", currentColumn: "feedback_text", status: "已匹配" },
      { systemField: "category", currentColumn: "category", status: "已匹配" },
      { systemField: "sentiment", currentColumn: "", status: "缺失" },
      { systemField: "priority", currentColumn: "priority_hint", status: "已匹配" },
      { systemField: "source", currentColumn: "source", status: "已匹配" },
      { systemField: "created_at", currentColumn: "created_at", status: "已匹配" },
    ]);
    setActiveModal("config");
  };

  const handleImport = () => {
    if (!importFile) {
      showToast("请先选择训练集文件");
      return;
    }
    setActiveModal(null);
    showToast("训练集导入功能将在后续版本接入后端");
    setImportFile(null);
    setImportName("");
    setImportScenario("auto");
    setImportDescription("");
  };

  const handleSaveTemplate = () => {
    setActiveModal(null);
    showToast("字段模板已保存到当前页面预览");
  };

  const handleAutoMatch = () => {
    showToast("已根据列名自动匹配字段");
  };

  const handleSaveConfig = () => {
    setActiveModal(null);
    showToast("字段配置已保存到当前页面预览");
  };

  const handleAddField = () => {
    setTemplateFields([
      ...templateFields,
      { name: "", required: false, description: "" },
    ]);
  };

  const handleRunAutoLabel = () => {
    setActiveModal(null);
    showToast("自动标注功能将在后续版本启用");
  };

  return (
    <div className="bg-background text-on-background min-h-screen font-body-md selection:bg-surface-dim selection:text-on-surface">
      {/* TopNavBar */}
      <header className="docked full-width top-0 border-b border-outline-variant bg-surface flex justify-between items-center h-16 px-8 ml-[280px] z-20 hidden md:flex">
        <div className="flex items-center gap-4">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
            <input className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-full font-label-md text-label-md focus:outline-none focus:border-primary focus:ring-0 w-64 transition-colors" placeholder="搜索数据集..." type="text" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-on-surface-variant hover:text-primary transition-opacity opacity-80 hover:opacity-100 flex items-center justify-center">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-opacity opacity-80 hover:opacity-100 flex items-center justify-center">
            <span className="material-symbols-outlined">help_outline</span>
          </button>
        </div>
      </header>

      {/* SideNavBar */}
      <Sidebar />

      {/* Main Content Canvas */}
      <main className="md:ml-[280px] pt-16 md:pt-0 min-h-screen p-margin-mobile md:p-margin-desktop flex flex-col items-center">
        <div className="w-full max-w-[max-width]">
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-xl gap-6">
            <div>
              <h2 className="font-display-lg text-display-lg text-primary mb-2">训练数据</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                管理和策展用于微调 AI 情感模型的定性反馈数据集。在启动新的训练运行之前，确保数据完整性和 schema 对齐。
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setActiveModal("import")}
                className="bg-surface-variant text-on-surface px-6 py-3 rounded-lg font-label-md text-label-md hover:bg-surface-dim transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">cloud_upload</span>
                导入训练集
              </button>
              <button
                onClick={() => setActiveModal("template")}
                className="bg-primary text-on-primary px-6 py-3 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                新建字段模板
              </button>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            {/* Main Data List */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {loading && (
                <div className="bg-surface-bright border border-outline-variant rounded-[24px] p-12 text-center">
                  <p className="font-body-md text-body-md text-on-surface-variant">加载中...</p>
                </div>
              )}
              {!loading && datasets.map((ds) => (
                <div key={ds.caseName} className="bg-surface-bright border border-outline-variant rounded-[24px] p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:shadow-diffused transition-shadow">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-title-lg text-title-lg text-primary">{ds.caseName}</h3>
                      <span className="bg-[#dce7c9] text-[#404a34] px-2 py-1 rounded font-label-sm text-label-sm">已验证</span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-4 max-w-xl">
                      {getScenarioDisplayName(ds.baselineType)} 场景的结构化反馈数据集。
                    </p>
                    <div className="flex items-center gap-6 font-label-sm text-label-sm text-outline">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">table_rows</span>
                        {ds.normalizedCount.toLocaleString()} 行
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">update</span>
                        {ds.acceptedAt ? new Date(ds.acceptedAt).toLocaleDateString("zh-CN") : "-"}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 bg-[#dce7c9] text-[#404a34] rounded-sm">{getScenarioDisplayName(ds.baselineType)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => openConfigModal(ds)}
                      className="px-4 py-2 border border-outline-variant text-primary rounded-lg font-label-md text-label-md hover:bg-surface-variant transition-colors"
                    >
                      配置字段
                    </button>
                  </div>
                </div>
              ))}
              {!loading && datasets.length === 0 && (
                <div className="bg-surface-bright border border-outline-variant rounded-[24px] p-12 text-center">
                  <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">database</span>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-4">暂无训练数据集</p>
                </div>
              )}
            </div>

            {/* Side Panel */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Stats Card */}
              <div className="bg-surface-bright border border-outline-variant rounded-[24px] p-8">
                <h4 className="font-title-lg text-title-lg text-primary mb-6">存储概览</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between font-label-md text-label-md mb-2">
                      <span className="text-on-surface-variant">已采纳数据集</span>
                      <span className="text-primary font-bold">{stats.accepted}</span>
                    </div>
                    <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${stats.total > 0 ? (stats.accepted / stats.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-label-md text-label-md mb-2">
                      <span className="text-on-surface-variant">总反馈量</span>
                      <span className="text-primary font-bold">{stats.feedbacks.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
                      <div className="bg-outline h-full" style={{ width: "35%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-label-md text-label-md mb-2">
                      <span className="text-on-surface-variant">预留评估集</span>
                      <span className="text-primary font-bold">{stats.heldout}</span>
                    </div>
                    <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
                      <div className="bg-sage h-full" style={{ width: "15%" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Quality Callout */}
              <div className="bg-[#EFE4CC] border-l-4 border-primary rounded-r-[24px] p-6 shadow-diffused">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary mt-1">auto_awesome</span>
                  <div className="flex-1">
                    <h4 className="font-title-lg text-title-lg text-primary mb-2">数据质量建议</h4>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                      当前数据集中有 12% 的行缺少情感标签。建议在进入模型训练前运行自动标注工具。
                    </p>
                    <button
                      onClick={() => setActiveModal("quality")}
                      className="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity"
                    >
                      查看建议
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Import Modal */}
      {activeModal === "import" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[rgba(23,21,17,0.35)]"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative bg-[#FFFCF5] border border-[#E5DED0] rounded-2xl p-8 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">导入训练集</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              上传已验证的反馈数据，用于后续模型评估、语义校验和分析质量优化。
            </p>

            {/* File Upload */}
            <div className="mb-4">
              <label className="block font-label-md text-label-md text-primary mb-2">数据文件</label>
              <div className="border-2 border-dashed border-outline-variant rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant mb-2">cloud_upload</span>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    {importFile ? importFile.name : "点击或拖拽上传 CSV / JSON 文件"}
                  </p>
                </label>
              </div>
            </div>

            {/* Dataset Name */}
            <div className="mb-4">
              <label className="block font-label-md text-label-md text-primary mb-2">数据集名称</label>
              <input
                type="text"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="输入数据集名称"
                className="w-full px-4 py-2 border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Scenario Select */}
            <div className="mb-4">
              <label className="block font-label-md text-label-md text-primary mb-2">场景</label>
              <select
                value={importScenario}
                onChange={(e) => setImportScenario(e.target.value)}
                className="w-full px-4 py-2 border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
              >
                <option value="auto">自动识别</option>
                <option value="enterprise-saas-renewal">企业 SaaS 续费</option>
                <option value="onboarding-activation">新用户激活</option>
                <option value="ai-product-experience">AI 产品体验</option>
                <option value="bi-dashboard-renewal">BI 报表续费</option>
                <option value="ecommerce-conversion">电商转化</option>
                <option value="internal-tools-efficiency">内部工具效率</option>
                <option value="mixed-feedback">混合反馈</option>
              </select>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block font-label-md text-label-md text-primary mb-2">说明</label>
              <textarea
                value={importDescription}
                onChange={(e) => setImportDescription(e.target.value)}
                placeholder="输入数据集说明（可选）"
                rows={3}
                className="w-full px-4 py-2 border border-outline-variant rounded-lg font-body-md text-body-md focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2 bg-[#EEE8DA] text-primary rounded-lg font-label-md text-label-md hover:bg-[#E5DED0] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-[#14120F] text-white rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {activeModal === "template" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[rgba(23,21,17,0.35)]"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative bg-[#FFFCF5] border border-[#E5DED0] rounded-2xl p-8 w-full max-w-2xl mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">新建字段模板</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              定义训练数据需要包含的字段，确保后续分析、校验和导出结构一致。
            </p>

            {/* Fields Table */}
            <div className="border border-outline-variant rounded-lg overflow-hidden mb-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-variant">
                    <th className="py-3 px-4 font-label-md text-label-md text-primary">字段名</th>
                    <th className="py-3 px-4 font-label-md text-label-md text-primary">是否必填</th>
                    <th className="py-3 px-4 font-label-md text-label-md text-primary">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {templateFields.map((field, index) => (
                    <tr key={index}>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => {
                            const newFields = [...templateFields];
                            newFields[index].name = e.target.value;
                            setTemplateFields(newFields);
                          }}
                          placeholder="字段名"
                          className="w-full px-2 py-1 border border-outline-variant rounded font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={field.required ? "required" : "optional"}
                          onChange={(e) => {
                            const newFields = [...templateFields];
                            newFields[index].required = e.target.value === "required";
                            setTemplateFields(newFields);
                          }}
                          className="px-2 py-1 border border-outline-variant rounded font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
                        >
                          <option value="required">必填</option>
                          <option value="optional">选填</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={field.description}
                          onChange={(e) => {
                            const newFields = [...templateFields];
                            newFields[index].description = e.target.value;
                            setTemplateFields(newFields);
                          }}
                          placeholder="说明"
                          className="w-full px-2 py-1 border border-outline-variant rounded font-body-md text-body-md focus:outline-none focus:border-primary transition-colors"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add Field Button */}
            <button
              onClick={handleAddField}
              className="mb-6 flex items-center gap-2 text-primary font-label-md text-label-md hover:text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              添加字段
            </button>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2 bg-[#EEE8DA] text-primary rounded-lg font-label-md text-label-md hover:bg-[#E5DED0] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveTemplate}
                className="px-6 py-2 bg-[#14120F] text-white rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                保存模板
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {activeModal === "config" && selectedDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[rgba(23,21,17,0.35)]"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative bg-[#FFFCF5] border border-[#E5DED0] rounded-2xl p-8 w-full max-w-2xl mx-4 shadow-xl">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">
              配置字段：{selectedDataset.caseName}
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              检查当前数据集字段是否满足训练和校验要求。
            </p>

            {/* Field Mapping Table */}
            <div className="border border-outline-variant rounded-lg overflow-hidden mb-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-variant">
                    <th className="py-3 px-4 font-label-md text-label-md text-primary">系统字段</th>
                    <th className="py-3 px-4 font-label-md text-label-md text-primary">当前数据列</th>
                    <th className="py-3 px-4 font-label-md text-label-md text-primary">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {fieldMappings.map((mapping, index) => (
                    <tr key={index}>
                      <td className="py-3 px-4 font-body-md text-body-md text-primary">{mapping.systemField}</td>
                      <td className="py-3 px-4 font-body-md text-body-md text-on-surface-variant">
                        {mapping.currentColumn || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded font-label-sm text-label-sm ${
                          mapping.status === "已匹配"
                            ? "bg-[#E7ECDD] text-[#2F6B3F]"
                            : mapping.status === "缺失"
                              ? "bg-[#F3DCDC] text-[#8A2F2F]"
                              : "bg-[#F3E5C8] text-[#8A5A00]"
                        }`}>
                          {mapping.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleAutoMatch}
                className="px-6 py-2 bg-[#EEE8DA] text-primary rounded-lg font-label-md text-label-md hover:bg-[#E5DED0] transition-colors"
              >
                自动匹配字段
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2 bg-[#EEE8DA] text-primary rounded-lg font-label-md text-label-md hover:bg-[#E5DED0] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-6 py-2 bg-[#14120F] text-white rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quality Modal */}
      {activeModal === "quality" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[rgba(23,21,17,0.35)]"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative bg-[#FFFCF5] border border-[#E5DED0] rounded-2xl p-8 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="font-headline-md text-headline-md text-primary mb-2">数据质量建议</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              当前数据集中有 12% 的行缺少情感标签，建议在进入模型训练前运行自动标注工具。
            </p>

            {/* Suggestions */}
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 p-4 bg-surface-variant rounded-lg">
                <span className="material-symbols-outlined text-primary mt-0.5">priority_high</span>
                <div>
                  <h4 className="font-label-md text-label-md text-primary mb-1">补齐 sentiment 字段</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    影响：提升语义评估和情感分布准确性
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-surface-variant rounded-lg">
                <span className="material-symbols-outlined text-primary mt-0.5">warning</span>
                <div>
                  <h4 className="font-label-md text-label-md text-primary mb-1">检查空 feedback_text</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    影响：避免空反馈进入训练数据
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-surface-variant rounded-lg">
                <span className="material-symbols-outlined text-primary mt-0.5">info</span>
                <div>
                  <h4 className="font-label-md text-label-md text-primary mb-1">统一 scenario 标签</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    影响：提升不同场景下的模型评估稳定性
                  </p>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 py-2 bg-[#EEE8DA] text-primary rounded-lg font-label-md text-label-md hover:bg-[#E5DED0] transition-colors"
              >
                我知道了
              </button>
              <button
                onClick={handleRunAutoLabel}
                className="px-6 py-2 bg-[#14120F] text-white rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity"
              >
                运行自动标注
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#14120F] text-white px-6 py-3 rounded-lg shadow-lg font-body-md text-body-md animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
