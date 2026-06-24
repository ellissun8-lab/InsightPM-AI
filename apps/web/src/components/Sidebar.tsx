"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "控制台", icon: "dashboard", activeIcon: "dashboard" },
  { href: "/new-analysis", label: "新建分析", icon: "add_chart", activeIcon: "add_chart" },
  { href: "/runs", label: "运行历史", icon: "history", activeIcon: "history" },
  { href: "/analysis-report", label: "分析报告", icon: "analytics", activeIcon: "analytics" },
  { href: "/evaluation", label: "评估校验", icon: "check_circle", activeIcon: "check_circle" },
  { href: "/training-data", label: "训练数据", icon: "database", activeIcon: "database" },
  { href: "/settings", label: "系统设置", icon: "settings", activeIcon: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="fixed left-0 top-0 h-screen w-[280px] bg-[#F5EEDD] border-r border-[#E5DED0] flex flex-col p-6 z-20">
      {/* Brand */}
      <div className="mb-12">
        <h1 className="font-headline-sm text-headline-sm text-primary tracking-tight">
          ProofLoop
        </h1>
        <p className="font-label-md text-label-md text-on-surface-variant mt-1">
          AI 反馈分析引擎
        </p>
      </div>

      {/* CTA */}
      <Link
        href="/new-analysis"
        className="w-full bg-primary text-on-primary rounded-lg py-3 px-4 font-label-md text-label-md mb-8 hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(23,21,17,0.1)]"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        新建分析
      </Link>

      {/* Navigation Links */}
      <ul className="flex flex-col gap-1 font-body-md text-body-md flex-grow">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-100 scale-95 ${
                  active
                    ? "bg-secondary-container text-on-secondary-container font-bold"
                    : "text-on-surface-variant hover:bg-surface-variant"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom Navigation */}
      <ul className="mt-auto flex flex-col gap-1 font-body-md text-body-md">
        <li>
          <div className="flex items-center gap-3 px-4 py-3 text-on-surface-variant text-label-sm font-label-sm">
            <span className="w-2 h-2 rounded-full bg-sage" />
            演示模式
          </div>
        </li>
        <li>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-all duration-100"
          >
            <span className="material-symbols-outlined">language</span>
            官网
          </Link>
        </li>
        <li>
          <Link
            href="/login"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-all duration-100"
          >
            <span className="material-symbols-outlined">login</span>
            登录
          </Link>
        </li>
      </ul>
    </nav>
  );
}
