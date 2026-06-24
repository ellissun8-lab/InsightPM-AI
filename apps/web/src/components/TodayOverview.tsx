"use client";

export default function TodayOverview() {
  const items = [
    { icon: "add_comment", label: "新增反馈", value: "24 条", color: "text-secondary" },
    { icon: "new_releases", label: "新增问题", value: "5 个", color: "text-primary" },
    { icon: "pending_actions", label: "待复核报告", value: "12 份", color: "text-on-surface" },
    { icon: "check_circle", label: "最新校验", value: "通过", color: "text-secondary" },
  ];

  return (
    <div className="mb-xl">
      <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-3">今日概览</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-[#FFFCF5] border border-[#E5DED0] rounded-lg p-4 flex items-center gap-3"
          >
            <span className={`material-symbols-outlined text-[20px] ${item.color}`}>{item.icon}</span>
            <div>
              <div className="font-body-md text-body-md text-on-surface-variant">{item.label}</div>
              <div className="font-title-lg text-title-lg text-primary font-semibold">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
