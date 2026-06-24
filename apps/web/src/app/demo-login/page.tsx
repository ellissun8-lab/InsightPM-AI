"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthCard from "@/components/auth/AuthCard";
import { ArrowRight, Key, Brain, BadgeCheck, GitBranch, FileText } from "lucide-react";

const FEATURES = [
  {
    label: "43 项 Hard Validation",
    desc: "自动检查结构完整性、证据链和报告质量。",
    icon: BadgeCheck,
    iconBg: "rgba(0,0,0,0.06)",
    iconColor: "#000000",
  },
  {
    label: "Evidence Trace 证据链",
    desc: "每个结论都能追溯到原始反馈。",
    icon: GitBranch,
    iconBg: "rgba(120,100,80,0.1)",
    iconColor: "#786450",
  },
  {
    label: "支持 Markdown / JSON 导出",
    desc: "方便用于汇报、归档和后续分析。",
    icon: FileText,
    iconBg: "rgba(0,98,66,0.1)",
    iconColor: "#006242",
  },
];

export default function DemoLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const isLocalMode = !process.env.NEXT_PUBLIC_PROOFLOOP_DEMO_KEY;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const demoKey = process.env.NEXT_PUBLIC_PROOFLOOP_DEMO_KEY;
    if (demoKey && code !== demoKey) {
      setError("访问码不正确");
      return;
    }
    localStorage.setItem("demoAccess", "true");
    router.push("/dashboard");
  };

  const handleLocalEnter = () => {
    localStorage.setItem("demoAccess", "true");
    router.push("/dashboard");
  };

  return (
    <AuthShell
      logoIcon={Brain}
      heroTitle={
        <>
          体验 ProofLoop<br />
          <span style={{ color: "#000000" }}>Demo 模式</span>
        </>
      }
      heroDescription="无需注册，直接体验完整的 AI 反馈分析流程。所有数据仅保存在本地。"
      features={FEATURES}
    >
      <AuthCard>
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#1e1b13", marginBottom: 4 }}>
            演示控制台
          </h3>
          <p style={{ fontSize: 14, color: "#4b463f" }}>
            {isLocalMode ? "本地演示模式已启用" : "请输入您的 Demo 访问码"}
          </p>
        </div>

        {isLocalMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "rgba(250,243,228,0.8)",
                border: "1px solid #E5DED0",
                borderRadius: 8,
                padding: 16,
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 14, color: "#000000", fontWeight: 700 }}>
                本地演示模式
              </p>
              <p style={{ fontSize: 12, color: "#4b463f", marginTop: 4 }}>
                本地环境无需 Access Code
              </p>
            </div>
            <button
              onClick={handleLocalEnter}
              style={{
                width: "100%",
                height: 48,
                background: "#000000",
                color: "#ffffff",
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 14,
                transition: "all 0.2s",
                boxShadow: "0 8px 32px rgba(23, 21, 17, 0.04)",
              }}
            >
              本地环境直接进入 <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#1e1b13", marginLeft: 4 }}>
                访问码
              </label>
              <div style={{ position: "relative" }}>
                <Key
                  size={16}
                  style={{
                    position: "absolute",
                    left: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#7c766e",
                  }}
                />
                <input
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "0 16px 0 44px",
                    background: "#faf3e4",
                    borderRadius: 8,
                    border: "1px solid #cdc5bc",
                    fontSize: 14,
                    color: "#1e1b13",
                    outline: "none",
                    transition: "all 0.2s",
                    boxSizing: "border-box",
                  }}
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError("");
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#000000";
                    e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.06)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#cdc5bc";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  placeholder="输入访问码"
                />
              </div>
              {error && (
                <p style={{ fontSize: 12, color: "#ba1a1a", marginTop: 4 }}>{error}</p>
              )}
            </div>
            <button
              type="submit"
              style={{
                width: "100%",
                height: 48,
                background: "#000000",
                color: "#ffffff",
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 14,
                transition: "all 0.2s",
                boxShadow: "0 8px 32px rgba(23, 21, 17, 0.04)",
              }}
            >
              进入演示 <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <p style={{ fontSize: 14, color: "#4b463f" }}>
            <button
              onClick={() => router.push("/login")}
              style={{ color: "#000000", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 14 }}
            >
              返回登录
            </button>
          </p>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(205,197,188,0.5)" }}>
            <p style={{ fontSize: 11, color: "#7c766e" }}>
              Demo 模式仅用于本地演示和内部测试。
            </p>
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
