"use client";

import { useState, useEffect, useRef } from "react";
import type { TimeRange } from "@/lib/dashboard-filter";
import { getTimeRangeLabel } from "@/lib/dashboard-filter";

const options: { value: TimeRange; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
  { value: "quarter", label: "本季度" },
  { value: "all", label: "全部时间" },
];

interface Props {
  timeRange: TimeRange;
  hasTimeData: boolean;
  onTimeRangeChange: (range: TimeRange) => void;
  onRefresh: () => void;
}

export default function DashboardToolbar({
  timeRange,
  hasTimeData,
  onTimeRangeChange,
  onRefresh,
}: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  return (
    <>
      {toast && (
        <div className="fixed top-20 right-8 z-50 bg-primary text-on-primary px-4 py-3 rounded-lg shadow-diffused font-label-md text-label-md animate-fade-in">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Time Range Selector — only if reliable time data exists */}
        {hasTimeData ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="font-label-md text-label-md text-[#171511] flex items-center gap-2 bg-[#EEE8DA] px-4 py-2 rounded-lg border border-[#D8CDBA] hover:bg-[#E5DED0] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              {getTimeRangeLabel(timeRange)}
              <span className="material-symbols-outlined text-[14px]">expand_more</span>
            </button>
            {showDropdown && (
              <div className="absolute top-full mt-1.5 right-0 bg-[#FFFCF5] border border-[#D8CDBA] rounded-xl shadow-lg py-1 z-50 min-w-[140px]">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onTimeRangeChange(opt.value);
                      setShowDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 font-body-md text-body-md transition-colors ${
                      opt.value === timeRange
                        ? "bg-[#EFE4CC] text-primary font-semibold"
                        : "text-on-surface hover:bg-[#F5EEDD]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="font-label-md text-label-md text-on-surface-variant flex items-center gap-2 bg-[#EEE8DA] px-4 py-2 rounded-lg border border-[#D8CDBA]">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            数据范围：全部时间
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={() => { onRefresh(); showToast("数据已刷新"); }}
          className="font-label-md text-label-md text-[#171511] flex items-center gap-2 bg-[#EEE8DA] px-4 py-2 rounded-lg border border-[#D8CDBA] hover:bg-[#E5DED0] transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          刷新数据
        </button>

        {/* Export Summary Button — disabled state */}
        <button
          onClick={() => showToast("控制台摘要导出将在后续版本启用")}
          disabled
          className="font-label-md text-label-md flex items-center gap-2 bg-[#CFC6B7] text-[#6F6A5F] px-4 py-2 rounded-lg cursor-not-allowed"
          title="控制台摘要导出将在后续版本启用"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          导出摘要
        </button>
      </div>
    </>
  );
}
