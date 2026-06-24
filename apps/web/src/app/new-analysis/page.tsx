"use client";

import { useState, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { Upload, Play, CloudUpload, FileText, Settings2, Bot, FileUp } from "lucide-react";
import { getScenarioDisplayName } from "@/lib/report-display";

const DATASETS = [
  "enterprise-saas-renewal",
  "onboarding-activation",
  "ai-product-experience",
  "internal-tools-efficiency",
  "ecommerce-conversion",
  "bi-dashboard-renewal",
  "mixed-feedback",
];

export default function NewAnalysisPage() {
  const [caseName, setCaseName] = useState("");
  const [dataset, setDataset] = useState("enterprise-saas-renewal");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file || !caseName) return;
    setUploading(true);
    const form = new FormData();
    form.append("caseName", caseName);
    form.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.ok) setResult("上传成功");
      else setResult("上传失败: " + (data.error || "unknown"));
    } catch (e: any) {
      setResult("上传失败: " + e.message);
    }
    setUploading(false);
  };

  const handleAnalyze = async () => {
    if (!caseName) return;
    setAnalyzing(true);
    setResult("分析中...");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseName, dataset, count: 0 }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult("分析完成");
        window.location.href = `/runs/${caseName}`;
      } else {
        setResult("分析失败: " + (data.error || "unknown"));
      }
    } catch (e: any) {
      setResult("分析失败: " + e.message);
    }
    setAnalyzing(false);
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-[280px] mt-16 p-margin-desktop w-[calc(100%-260px)] h-[calc(100vh-64px)] overflow-y-auto">
        <div className="mb-xl">
          <h2 className="text-headline-lg font-headline-lg text-on-surface mb-xs">
            新建分析任务
          </h2>
          <p className="text-body-lg font-body-lg text-on-surface-variant">
            上传数据并配置您的 AI 分析流水线。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-xl">
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant card-shadow flex-1 flex flex-col">
              <div className="p-lg border-b border-outline-variant/50 flex items-center justify-between">
                <h3 className="text-title-lg font-title-lg text-on-surface">
                  上传反馈数据
                </h3>
                <FileUp size={20} className="text-on-surface-variant" />
              </div>
              <div className="p-lg flex-1 flex flex-col">
                <p className="text-body-md font-body-md text-on-surface-variant mb-md">
                  支持 raw customer feedback CSV 格式.
                </p>
                <div
                  onClick={() => inputRef.current?.click()}
                  className="flex-1 border-2 border-dashed border-outline-variant rounded-lg bg-surface-container-low hover:bg-surface-container-high/50 transition-colors flex flex-col items-center justify-center p-xl cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center mb-md group-hover:scale-110 transition-transform">
                    <CloudUpload size={32} className="text-primary" />
                  </div>
                  <p className="text-body-lg font-body-lg text-on-surface font-medium mb-xs">
                    拖拽 CSV 文件至此处，或点击浏览
                  </p>
                  <p className="text-label-md font-label-md text-on-surface-variant">
                    最大支持 50MB. (仅限 .csv)
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                {file && (
                  <div className="mt-md flex items-center gap-xs font-label-md text-label-md text-on-surface">
                    <FileText size={16} className="text-primary" />
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <div className="bg-surface-container-lowest rounded-lg border border-outline-variant card-shadow flex-1 flex flex-col">
              <div className="p-lg border-b border-outline-variant/50 flex items-center justify-between">
                <h3 className="text-title-lg font-title-lg text-on-surface">
                  运行配置
                </h3>
                <Settings2 size={20} className="text-on-surface-variant" />
              </div>
              <div className="p-lg flex-1 space-y-lg overflow-y-auto">
                <div>
                  <label className="block text-label-sm font-label-sm uppercase text-on-surface-variant mb-sm tracking-wider">
                    分析场景
                  </label>
                  <div className="relative">
                    <select
                      value={dataset}
                      onChange={(e) => setDataset(e.target.value)}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-md px-md py-sm text-body-md font-body-md text-on-surface focus:ring-1 focus:ring-primary focus:border-primary appearance-none pr-xl"
                    >
                      {DATASETS.map((d) => (
                        <option key={d} value={d}>
                          {getScenarioDisplayName(d)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-label-sm font-label-sm uppercase text-on-surface-variant mb-sm tracking-wider">
                    案例名称
                  </label>
                  <input
                    type="text"
                    value={caseName}
                    onChange={(e) => setCaseName(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-md px-md py-sm text-body-md font-body-md text-on-surface focus:ring-1 focus:ring-primary focus:border-primary"
                    placeholder="my-feedback-analysis"
                  />
                  <p className="text-label-sm font-label-sm text-on-surface-variant mt-1">
                    仅允许 a-z, 0-9, -, _
                  </p>
                </div>

                <div>
                  <label className="block text-label-sm font-label-sm uppercase text-on-surface-variant mb-sm tracking-wider">
                    语义模型
                  </label>
                  <div className="p-md rounded-md bg-surface-container-low border border-outline-variant/50 flex items-center justify-between">
                    <div className="flex items-center">
                      <Bot size={18} className="text-purple-600 mr-sm" />
                      <span className="text-body-md font-body-md text-on-surface font-medium">
                        DeepSeek V4 Pro
                      </span>
                    </div>
                    <span className="text-label-sm font-label-sm text-primary bg-surface-container-high px-2 py-1 rounded">
                      默认
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-label-sm font-label-sm uppercase text-on-surface-variant mb-sm tracking-wider">
                    硬性校验 Hard Validation 规则
                  </label>
                  <div className="space-y-sm">
                    <label className="flex items-start">
                      <input
                        checked
                        className="mt-1 mr-sm rounded border-outline-variant text-primary focus:ring-primary"
                        type="checkbox"
                      />
                      <span className="text-body-md font-body-md text-on-surface">
                        最少字数要求（&gt;10）
                      </span>
                    </label>
                    <label className="flex items-start">
                      <input
                        checked
                        className="mt-1 mr-sm rounded border-outline-variant text-primary focus:ring-primary"
                        type="checkbox"
                      />
                      <span className="text-body-md font-body-md text-on-surface">
                        过滤 PII（个人可识别信息）
                      </span>
                    </label>
                    <label className="flex items-start">
                      <input
                        className="mt-1 mr-sm rounded border-outline-variant text-primary focus:ring-primary"
                        type="checkbox"
                      />
                      <span className="text-body-md font-body-md text-on-surface">
                        严格 JSON 格式输出
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-md">
          <button
            onClick={handleUpload}
            disabled={!file || !caseName || uploading}
            className="flex-1 h-12 rounded-lg bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md font-body-md font-medium hover:bg-surface-container-low transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Upload size={18} />
            {uploading ? "上传中..." : "上传 CSV"}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!caseName || analyzing}
            className="flex-1 h-12 rounded-lg bg-primary-container text-white text-body-md font-body-md font-medium hover:bg-primary transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Play size={18} />
            {analyzing ? "分析中..." : "开始分析"}
          </button>
        </div>

        {result && (
          <div className="mt-md text-body-md font-body-md text-on-surface-variant p-md rounded-lg bg-surface-container-lowest border border-outline-variant">
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
