"use client";

const TABS = ["完整报告", "分组视图", "证据链", "综合诊断", "下载"] as const;
export type Tab = (typeof TABS)[number];

interface ReportTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function ReportTabs({ activeTab, onTabChange }: ReportTabsProps) {
  return (
    <div className="border-b border-outline-variant">
      <nav className="flex gap-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-1 pb-3 font-body-md text-body-md transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary font-semibold text-primary"
                : "border-b-2 border-transparent font-medium text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
}

export { TABS };
