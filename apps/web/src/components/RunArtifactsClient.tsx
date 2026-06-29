"use client";

import { useState } from "react";
import { FileText, Download, Eye, X, AlertTriangle } from "lucide-react";

interface ArtifactItem {
  id: string;
  artifactType: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  metadata?: { source?: string };
  createdAt: string;
}

const ARTIFACT_LABELS: Record<string, string> = {
  "summary-json": "运行摘要",
  "overall-md": "完整 Markdown 报告",
  "validation-json": "验证结果",
  "segment-json": "分组结构",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RunArtifactsClient({
  artifacts,
  runId,
}: {
  artifacts: ArtifactItem[];
  runId: string;
}) {
  const [preview, setPreview] = useState<{
    type: string;
    fileName: string;
    content: any;
    loading: boolean;
    error: string | null;
    truncated: boolean;
  } | null>(null);

  const handlePreview = async (artifactType: string, fileName: string) => {
    setPreview({ type: artifactType, fileName, content: null, loading: true, error: null, truncated: false });

    try {
      const res = await fetch(`/api/artifacts/${runId}/preview?type=${encodeURIComponent(artifactType)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPreview({
        type: artifactType,
        fileName: data.fileName || fileName,
        content: data.content,
        loading: false,
        error: null,
        truncated: data.truncated || false,
      });
    } catch (err: any) {
      setPreview({ type: artifactType, fileName, content: null, loading: false, error: err.message, truncated: false });
    }
  };

  const closePreview = () => setPreview(null);

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden mb-xl">
      <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low">
        <h3 className="text-title-lg font-title-lg text-on-surface font-semibold">报告产物</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant/50">
              <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">类型</th>
              <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">文件名</th>
              <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">大小</th>
              <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">来源</th>
              <th className="px-lg py-sm text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody className="text-body-md font-body-md text-on-surface divide-y divide-outline-variant/50">
            {artifacts.map((a) => (
              <tr key={a.id} className="hover:bg-surface-container-low transition-colors">
                <td className="px-lg py-md">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText size={14} className="text-on-surface-variant" />
                    {ARTIFACT_LABELS[a.artifactType] || a.artifactType}
                  </span>
                </td>
                <td className="px-lg py-md text-on-surface-variant font-mono text-label-md">{a.fileName}</td>
                <td className="px-lg py-md text-on-surface-variant text-label-md">{formatSize(a.sizeBytes)}</td>
                <td className="px-lg py-md text-on-surface-variant text-label-md">{a.metadata?.source || "-"}</td>
                <td className="px-lg py-md text-right">
                  <div className="inline-flex items-center gap-3">
                    <button
                      onClick={() => handlePreview(a.artifactType, a.fileName)}
                      className="text-primary font-label-md hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={14} /> 预览
                    </button>
                    <a
                      href={`/api/artifacts/${runId}/download?type=${encodeURIComponent(a.artifactType)}`}
                      className="text-on-surface-variant font-label-md hover:underline inline-flex items-center gap-1"
                    >
                      <Download size={14} /> 下载
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview Panel */}
      {preview && (
        <div className="border-t border-outline-variant bg-surface-container-low">
          <div className="px-lg py-md flex items-center justify-between border-b border-outline-variant/50">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-primary" />
              <span className="text-title-md font-title-md text-on-surface">
                {ARTIFACT_LABELS[preview.type] || preview.type}
              </span>
              <span className="text-label-md font-label-md text-on-surface-variant font-mono">
                {preview.fileName}
              </span>
              {preview.truncated && (
                <span className="px-2 py-0.5 rounded text-label-sm font-label-sm bg-yellow-50 text-yellow-700 border border-yellow-200">
                  已截断
                </span>
              )}
            </div>
            <button onClick={closePreview} className="text-on-surface-variant hover:text-on-surface p-1 cursor-pointer">
              <X size={18} />
            </button>
          </div>
          <div className="px-lg py-md max-h-[500px] overflow-y-auto">
            {preview.loading && (
              <div className="text-center py-8 text-on-surface-variant">加载中...</div>
            )}
            {preview.error && (
              <div className="flex items-start gap-3 p-md rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-body-md font-body-md text-red-800 font-medium">加载 artifact 失败</div>
                  <div className="text-label-md font-label-md text-red-600 mt-1">{preview.error}</div>
                </div>
              </div>
            )}
            {preview.content != null && !preview.loading && !preview.error && (
              preview.type === "overall-md" ? (
                <pre className="whitespace-pre-wrap font-body-md text-body-md text-on-surface bg-surface-container-lowest rounded-lg p-md border border-outline-variant">
                  {typeof preview.content === "string" ? preview.content : JSON.stringify(preview.content, null, 2)}
                </pre>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-label-md text-on-surface bg-surface-container-lowest rounded-lg p-md border border-outline-variant">
                  {typeof preview.content === "string" ? preview.content : JSON.stringify(preview.content, null, 2)}
                </pre>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
