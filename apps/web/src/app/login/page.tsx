"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col md:flex-row selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Left Pane: Branding */}
      <div className="relative flex-1 md:w-1/2 p-8 md:p-xl flex flex-col justify-between overflow-hidden bg-surface border-b md:border-b-0 md:border-r border-outline-variant/30">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-24">
            <span className="material-symbols-outlined text-[28px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              data_exploration
            </span>
            <span className="font-headline-sm text-headline-sm text-primary tracking-tight">ProofLoop</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-primary mb-6">
              把用户反馈变成可信产品洞察。
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-10 leading-relaxed">
              上传原始用户反馈，自动生成产品分析报告，并通过证据链、硬性校验 Hard Validation 和语义评分验证每一个结论。
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                43 项硬性校验
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-variant text-on-surface-variant font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px]">link</span>
                证据链追踪
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-md text-label-md">
                <span className="material-symbols-outlined text-[16px]">download</span>
                Markdown / JSON 导出
              </span>
            </div>
          </div>
        </div>
        <div className="relative z-10 hidden md:block mt-24">
          <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider">AI 反馈分析引擎</p>
        </div>
      </div>

      {/* Right Pane: Login Form */}
      <div className="flex-1 md:w-1/2 flex items-center justify-center p-8 bg-surface-container-low relative">
        <div className="w-full max-w-[440px] bg-surface-bright border border-outline-variant rounded-[24px] p-8 md:p-lg shadow-diffused relative z-10">
          <div className="mb-10 text-center">
            <h2 className="font-headline-md text-headline-md text-primary mb-2">登录工作台</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">进入 ProofLoop Demo 工作区</p>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block font-label-sm text-label-sm text-primary mb-2 uppercase tracking-wide" htmlFor="email">工作邮箱</label>
              <input
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-primary placeholder-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block font-label-sm text-label-sm text-primary uppercase tracking-wide" htmlFor="password">密码</label>
                <button
                  type="button"
                  className="font-label-sm text-label-sm text-outline hover:text-primary transition-colors underline decoration-outline-variant underline-offset-4"
                  onClick={() => alert("密码重置将在 SaaS 版本启用")}
                >
                  忘记密码？
                </button>
              </div>
              <input
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-primary placeholder-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface cursor-pointer"
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label className="font-label-sm text-label-sm text-on-surface-variant cursor-pointer" htmlFor="remember">记住我</label>
            </div>
            <button
              className="w-full bg-primary text-on-primary font-label-md text-label-md py-4 rounded-lg hover:bg-inverse-surface transition-colors mt-4 flex items-center justify-center gap-2 group"
              type="submit"
            >
              登录
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>
            <div className="flex items-center gap-4 my-8">
              <div className="h-px bg-outline-variant flex-1" />
              <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">或</span>
              <div className="h-px bg-outline-variant flex-1" />
            </div>
            <button
              className="w-full bg-surface text-primary border border-outline-variant font-label-md text-label-md py-3.5 rounded-lg hover:bg-surface-variant transition-colors flex items-center justify-center gap-3"
              type="button"
              onClick={() => router.push("/demo-login")}
            >
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              使用 Demo 访问码
            </button>
          </form>
          <div className="mt-8 text-center">
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              还没有账号？{" "}
              <Link className="text-primary underline decoration-outline-variant hover:decoration-primary underline-offset-4 transition-colors" href="/signup">创建账号</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
