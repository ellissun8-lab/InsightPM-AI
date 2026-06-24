"use client";

import { useState } from "react";
import { ChevronDown, FileText, Copy, Download } from "lucide-react";

interface MarkdownCollapseProps {
  content?: string | null;
}

export default function MarkdownCollapse({ content }: MarkdownCollapseProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-[24px] border border-outline-variant shadow-diffused overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-container-low transition-colors"
      >
        <span className="text-body-md font-title-lg text-on-surface flex items-center gap-2">
          <FileText size={16} className="text-on-surface-variant" />
          完整 Markdown 报告
        </span>
        <ChevronDown
          size={16}
          className={`text-on-surface-variant transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="border-t border-outline-variant">
          <div className="px-6 py-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <span className="text-label-sm text-on-surface-variant font-body-md">完整分析报告</span>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1 rounded border border-outline-variant text-label-sm font-medium text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low flex items-center gap-1 font-body-md"
              >
                <Copy size={12} />
                {copied ? "已复制" : "复制"}
              </button>
              <button className="px-3 py-1 rounded border border-outline-variant text-label-sm font-medium text-primary bg-surface-container-high hover:bg-surface-container flex items-center gap-1 font-body-md">
                <Download size={12} />
                下载 .md
              </button>
            </div>
          </div>
          <div className="p-6 bg-surface-container-low max-h-[500px] overflow-y-auto font-mono text-body-md text-on-surface-variant whitespace-pre-wrap">
            {content || "暂无 Markdown 报告。请先运行分析生成报告。"}
          </div>
        </div>
      )}
    </div>
  );
}
