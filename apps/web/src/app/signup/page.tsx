"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("正式账号系统将在 SaaS 版本启用");
  };

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col md:flex-row selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Left Column: Editorial Brand & Quote */}
      <div
        className="hidden md:flex md:w-5/12 lg:w-1/2 flex-col justify-between p-lg lg:p-xl border-r border-outline-variant relative overflow-hidden"
        style={{
          background: "radial-gradient(circle at 100% 0%, rgba(233, 226, 212, 0.4) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(233, 226, 212, 0.4) 0%, transparent 50%), #fff9ee",
        }}
      >
        <div className="z-10">
          <h1 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            ProofLoop
          </h1>
        </div>
        <div className="z-10 max-w-lg mb-xl">
          <blockquote className="font-display-lg text-display-lg text-primary mb-8 leading-tight">
            &ldquo;把用户反馈变成可信产品洞察。这是我们产品决策所缺失的智识严谨性。&rdquo;
          </blockquote>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant bg-surface-container">
              <div className="w-full h-full bg-surface-variant" />
            </div>
            <div>
              <div className="font-label-md text-label-md text-primary">Eleanor Vance</div>
              <div className="font-body-md text-body-md text-on-surface-variant">产品总监，FinTech Innovators</div>
            </div>
          </div>
        </div>
        <div className="z-10 flex gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="w-2 h-2 rounded-full bg-outline-variant" />
          <div className="w-2 h-2 rounded-full bg-outline-variant" />
        </div>
      </div>

      {/* Right Column: Signup Form */}
      <div className="w-full md:w-7/12 lg:w-1/2 flex items-center justify-center p-6 md:p-lg lg:p-xl bg-surface relative min-h-screen">
        <div className="absolute top-6 left-6 md:hidden">
          <h1 className="font-headline-sm text-headline-sm text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
            ProofLoop
          </h1>
        </div>
        <div className="w-full max-w-md">
          <div className="mb-10 text-center md:text-left">
            <h2 className="font-headline-md text-headline-md text-primary mb-2">创建账号</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">开始使用 ProofLoop 工作区</p>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 md:p-10 shadow-diffused">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2" htmlFor="name">姓名</label>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  id="name"
                  type="text"
                  placeholder="张三"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2" htmlFor="email">工作邮箱</label>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  id="email"
                  type="email"
                  placeholder="zhang@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2" htmlFor="workspace">工作区名称</label>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  id="workspace"
                  type="text"
                  placeholder="my-team"
                  required
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2" htmlFor="password">密码</label>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-2 font-label-sm text-label-sm text-outline">密码长度至少 8 个字符。</p>
              </div>
              <div>
                <label className="block font-label-md text-label-md text-on-surface-variant mb-2" htmlFor="confirmPassword">确认密码</label>
                <input
                  className="w-full bg-surface-bright border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-bright cursor-pointer"
                    id="terms"
                    type="checkbox"
                    required
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label className="font-body-md text-body-md text-on-surface-variant" htmlFor="terms">
                    我同意 <a className="text-primary underline decoration-outline-variant underline-offset-4 hover:decoration-primary transition-colors" href="#">服务条款</a> 和 <a className="text-primary underline decoration-outline-variant underline-offset-4 hover:decoration-primary transition-colors" href="#">隐私政策</a>。
                  </label>
                </div>
              </div>
              <div className="pt-2">
                <button
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-diffused font-label-md text-label-md text-on-primary bg-primary hover:bg-inverse-surface focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all active:scale-[0.98]"
                  type="submit"
                >
                  创建账号
                </button>
              </div>
            </form>
            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-surface-container-lowest font-label-sm text-label-sm text-outline uppercase tracking-wider">或使用以下方式</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-outline-variant rounded-lg bg-surface-bright font-label-md text-label-md text-on-surface hover:bg-surface-variant transition-colors" type="button">
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google
              </button>
              <button className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-outline-variant rounded-lg bg-surface-bright font-label-md text-label-md text-on-surface hover:bg-surface-variant transition-colors" type="button">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd" />
                </svg>
                GitHub
              </button>
            </div>
          </div>
          <p className="mt-8 text-center font-body-md text-body-md text-on-surface-variant">
            已有账号？{" "}
            <Link className="font-label-md text-label-md text-primary hover:text-on-surface-variant transition-colors ml-1 underline decoration-outline-variant underline-offset-4 hover:decoration-primary" href="/login">登录</Link>
          </p>
          <p className="mt-4 text-center">
            <button
              className="font-label-sm text-label-sm text-outline hover:text-primary transition-colors underline decoration-outline-variant underline-offset-4"
              type="button"
              onClick={() => router.push("/demo-login")}
            >
              使用 Demo 访问码
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
