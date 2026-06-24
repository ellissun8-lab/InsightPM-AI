import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ProofLoop - 把用户反馈变成可信产品洞察",
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-cream-bg">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-card">
        <div className="max-w-[1280px] mx-auto px-margin-mobile md:px-margin-desktop h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined fill text-2xl">analytics</span>
            <span className="font-headline-sm text-headline-sm">ProofLoop</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-label-md text-label-md">
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="#features">产品</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="#workflow">工作流</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="#reports">分析报告</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="#validation">验证能力</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="#pricing">定价</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors" href="#faq">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <a href="/login" className="hidden md:block font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">登录</a>
            <a href="/signup" className="bg-near-black text-white px-6 py-2 rounded-full font-label-md text-label-md hover:bg-black transition-colors">
              开始使用
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-xl md:pt-48 md:pb-24 px-margin-mobile md:px-margin-desktop max-w-[1280px] mx-auto">
        <div className="grid md:grid-cols-12 gap-gutter items-center">
          <div className="md:col-span-6 space-y-8 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-variant rounded-full text-label-sm font-label-sm text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-sage" />
              AI 反馈分析引擎
            </div>
            <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg text-near-black leading-tight">
              把用户反馈变成<br />
              <span className="italic text-outline">可信产品洞察</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
              上传原始用户反馈，ProofLoop 自动完成聚类分析、证据链追踪、语义校验和报告生成，让产品决策不再依赖感觉。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <a href="/login" className="bg-near-black text-white px-8 py-3 rounded-full font-label-md text-label-md hover:bg-black transition-all flex items-center justify-center gap-2 group">
                开始分析反馈
                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </a>
              <a href="/analysis-report" className="bg-warm-gray bg-opacity-20 text-near-black px-8 py-3 rounded-full font-label-md text-label-md hover:bg-opacity-40 transition-all border border-warm-gray">
                查看示例报告
              </a>
            </div>
          </div>
          <div className="md:col-span-6 mt-12 md:mt-0 relative">
            <div className="absolute inset-0 bg-sage rounded-full blur-[100px] opacity-20 transform -translate-x-10 translate-y-10" />
            <div className="bg-warm-white rounded-2xl p-8 editorial-border shadow-diffused relative z-10 transform md:rotate-1 hover:rotate-0 transition-transform duration-500">
              <div className="flex justify-between items-start mb-8 border-b border-warm-gray pb-6">
                <div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant mb-1">执行摘要</div>
                  <h3 className="font-headline-sm text-headline-sm text-near-black">Q3 产品反馈综合分析</h3>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-near-black">88<span className="text-sm text-outline font-normal">/100</span></div>
                  <div className="font-label-sm text-label-sm text-sage mt-1 flex items-center justify-end gap-1">
                    <span className="material-symbols-outlined text-xs">trending_up</span> 健康度
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-cream-bg rounded-lg editorial-border">
                    <div className="font-label-sm text-label-sm text-on-surface-variant mb-2">处理样本量</div>
                    <div className="font-title-lg text-title-lg text-near-black">4,200 <span className="text-sm font-normal text-outline">条</span></div>
                  </div>
                  <div className="p-4 bg-cream-bg rounded-lg editorial-border">
                    <div className="font-label-sm text-label-sm text-on-surface-variant mb-2">识别高优议题</div>
                    <div className="font-title-lg text-title-lg text-near-black">12 <span className="text-sm font-normal text-outline">项</span></div>
                  </div>
                </div>
                <div className="space-y-3 pt-4">
                  <div className="font-label-md text-label-md text-near-black mb-2">首要产品洞察</div>
                  <div className="flex items-start gap-3 p-3 rounded bg-[#EFE4CC] border-l-2 border-near-black">
                    <span className="material-symbols-outlined text-near-black text-sm mt-1">lightbulb</span>
                    <p className="font-body-md text-body-md text-near-black text-sm">
                      核心支付流程中的「多币种结算延迟」问题在企业客户中提及率环比上升 45%，建议在下个 Sprint 提升优先级。
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded hover:bg-cream-bg transition-colors">
                    <span className="material-symbols-outlined text-outline text-sm mt-1">warning</span>
                    <p className="font-body-md text-body-md text-on-surface-variant text-sm">
                      新版 Dashboard 的导航逻辑受到 28% 新手用户的混淆反馈。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-xl px-margin-mobile md:px-margin-desktop bg-[#FFF8EA] relative" id="features">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-headline-md text-headline-md text-near-black mb-4">产品反馈太多，但真正可信的结论太少</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              传统的词云图和情绪分析无法支撑复杂的产品决策，现代团队需要的是具备逻辑严密性与可追溯性的分析框架。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-cream-bg p-8 rounded-2xl editorial-border hover:shadow-diffused transition-shadow">
              <div className="w-12 h-12 bg-[#FFFCF5] rounded-full flex items-center justify-center border border-warm-gray mb-6">
                <span className="material-symbols-outlined text-outline">scatter_plot</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-near-black mb-3">反馈渠道高度分散</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                来自 Zendesk、App Store、NPS 问卷与销售访谈的数据孤岛，导致团队难以获得产品的全景视图。
              </p>
            </div>
            <div className="bg-cream-bg p-8 rounded-2xl editorial-border hover:shadow-diffused transition-shadow">
              <div className="w-12 h-12 bg-[#FFFCF5] rounded-full flex items-center justify-center border border-warm-gray mb-6">
                <span className="material-symbols-outlined text-outline">link_off</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-near-black mb-3">结论缺乏可追溯性</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                黑盒式的 AI 总结往往忽略上下文，当管理层询问「为什么得出这个结论」时，产品经理难以提供原始证据链。
              </p>
            </div>
            <div className="bg-cream-bg p-8 rounded-2xl editorial-border hover:shadow-diffused transition-shadow">
              <div className="w-12 h-12 bg-[#FFFCF5] rounded-full flex items-center justify-center border border-warm-gray mb-6">
                <span className="material-symbols-outlined text-outline">recycling</span>
              </div>
              <h3 className="font-title-lg text-title-lg text-near-black mb-3">一次性分析难以复用</h3>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                耗费数天整理的竞品分析或用户访谈报告，往往在会议后就被归档，无法转化为持续迭代的知识库资产。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="py-xl px-margin-mobile md:px-margin-desktop bg-cream-bg border-y border-warm-gray" id="workflow">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-md text-headline-md text-near-black mb-16 text-center">标准化分析流，重塑洞察产出效率</h2>
          <div className="relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-warm-gray -translate-y-1/2 z-0" />
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
              {[
                { step: 1, icon: "upload_file", title: "上传反馈", desc: "支持 CSV/JSON 批量上传或 API 接入多渠道源数据。" },
                { step: 2, icon: "bubble_chart", title: "自动聚类", desc: "自适应主题模型提取核心概念，去除冗余与噪音。" },
                { step: 3, icon: "article", title: "生成报告", desc: "运用行业最佳实践，自动生成含证据链的结构化报告。", active: true },
                { step: 4, icon: "track_changes", title: "证据追踪", desc: "建立基线指标，监控核心产品问题的演变趋势。" },
                { step: 5, icon: "output", title: "校验与导出", desc: "导出 PDF/Markdown 完美融入您现有的工作流。" },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`bg-warm-white p-6 rounded-xl shadow-diffused flex flex-col items-center text-center ${
                    s.active ? "border-2 border-near-black shadow-md transform md:-translate-y-2" : "editorial-border"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-near-black text-white flex items-center justify-center font-label-md mb-4 shadow-md">{s.step}</div>
                  <span className={`material-symbols-outlined text-3xl mb-3 ${s.active ? "text-near-black" : "text-outline"}`}>{s.icon}</span>
                  <h4 className="font-title-lg text-title-lg text-near-black mb-2">{s.title}</h4>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="py-xl px-margin-mobile md:px-margin-desktop bg-[#FFF8EA]" id="reports">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-headline-md text-headline-md text-near-black mb-4">核心能力</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              从数据汇入到报告导出，每一步都经过严格校验。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "psychology", title: "AI 产品反馈分析", desc: "基于大语言模型的语义聚类与主题提取，自动识别高频问题与趋势。" },
              { icon: "link", title: "证据链 Evidence Trace", desc: "每条结论可追溯至原始反馈片段，支持管理层质询与审计。" },
              { icon: "verified", title: "硬性校验 Hard Validation", desc: "43 项规则校验确保数据完整性、格式合规与逻辑一致性。" },
              { icon: "fact_check", title: "语义校验 Semantic Validation", desc: "AI 交叉验证分析结论与原始数据的语义一致性。" },
              { icon: "database", title: "训练数据管理", desc: "支持数据集版本控制、留出集管理与持续质量监控。" },
              { icon: "download", title: "报告产物导出", desc: "支持 PDF、Markdown、JSON 多格式导出，无缝融入现有工作流。" },
            ].map((item) => (
              <div key={item.title} className="bg-warm-white p-8 rounded-2xl editorial-border hover:shadow-diffused transition-shadow">
                <div className="w-12 h-12 bg-cream-bg rounded-full flex items-center justify-center border border-warm-gray mb-6">
                  <span className="material-symbols-outlined text-primary">{item.icon}</span>
                </div>
                <h3 className="font-title-lg text-title-lg text-near-black mb-3">{item.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Validation Section */}
      <section className="py-xl px-margin-mobile md:px-margin-desktop bg-cream-bg border-y border-warm-gray" id="validation">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-headline-md text-headline-md text-near-black mb-6">校验能力，让结论可信</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant mb-8 leading-relaxed">
                ProofLoop 不只是生成报告，更确保每一条结论都经过严格校验。从硬性规则到语义验证，构建完整的质量保障体系。
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-warm-white rounded-xl editorial-border">
                  <span className="material-symbols-outlined text-sage mt-0.5">check_circle</span>
                  <div>
                    <div className="font-title-lg text-title-lg text-near-black">43 项硬性校验规则</div>
                    <div className="font-body-md text-body-md text-on-surface-variant mt-1">覆盖数据完整性、格式合规、逻辑一致性等维度</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-warm-white rounded-xl editorial-border">
                  <span className="material-symbols-outlined text-sage mt-0.5">check_circle</span>
                  <div>
                    <div className="font-title-lg text-title-lg text-near-black">语义交叉验证</div>
                    <div className="font-body-md text-body-md text-on-surface-variant mt-1">AI 对比分析结论与原始数据的语义一致性</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-warm-white rounded-xl editorial-border">
                  <span className="material-symbols-outlined text-sage mt-0.5">check_circle</span>
                  <div>
                    <div className="font-title-lg text-title-lg text-near-black">证据链完整追踪</div>
                    <div className="font-body-md text-body-md text-on-surface-variant mt-1">每条结论可追溯至原始反馈片段</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-warm-white rounded-2xl p-8 editorial-border shadow-diffused">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-sage">verified</span>
                <span className="font-title-lg text-title-lg text-near-black">校验结果示例</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "数据完整性", status: "pass", detail: "12/12 字段已填充" },
                  { label: "格式合规性", status: "pass", detail: "日期、数值格式正确" },
                  { label: "逻辑一致性", status: "pass", detail: "无矛盾结论" },
                  { label: "语义一致性", status: "pass", detail: "AI 评分 0.92" },
                  { label: "证据覆盖率", status: "warning", detail: "87% 结论有证据支撑" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-cream-bg editorial-border">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.status === "pass" ? "bg-sage" : "bg-[#EFE4CC]"}`} />
                      <span className="font-body-md text-body-md text-near-black">{item.label}</span>
                    </div>
                    <span className={`font-label-sm text-label-sm ${item.status === "pass" ? "text-sage" : "text-outline"}`}>{item.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Scenarios */}
      <section className="py-xl px-margin-mobile md:px-margin-desktop bg-[#FFF8EA]" id="pricing">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-headline-md text-headline-md text-near-black mb-4">支持场景</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              无论是 B2B 还是 B2C，ProofLoop 都能为您的产品决策提供可信洞察。
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: "business_center", title: "B2B 激活", desc: "分析企业客户初次使用反馈，优化激活流程与上手体验。" },
              { icon: "autorenew", title: "B2B 续费", desc: "追踪续费周期中的客户声音，识别流失风险与挽留机会。" },
              { icon: "smart_toy", title: "AI 产品体验", desc: "评估 AI 功能的用户满意度，定位模型表现与预期差距。" },
              { icon: "shopping_cart", title: "电商转化", desc: "从购物车放弃到支付完成，全链路分析转化障碍。" },
              { icon: "build", title: "内部工具效率", desc: "收集内部用户对工具的反馈，持续优化工作流效率。" },
              { icon: "tune", title: "自定义场景", desc: "灵活配置分析维度与校验规则，适配您的业务需求。" },
            ].map((item) => (
              <div key={item.title} className="bg-warm-white p-6 rounded-2xl editorial-border hover:shadow-diffused transition-shadow text-center">
                <div className="w-12 h-12 bg-cream-bg rounded-full flex items-center justify-center border border-warm-gray mx-auto mb-4">
                  <span className="material-symbols-outlined text-primary">{item.icon}</span>
                </div>
                <h3 className="font-title-lg text-title-lg text-near-black mb-2">{item.title}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-xl px-margin-mobile md:px-margin-desktop bg-cream-bg border-y border-warm-gray" id="faq">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-headline-md text-headline-md text-near-black mb-16 text-center">常见问题</h2>
          <div className="max-w-3xl mx-auto space-y-6">
            {[
              { q: "ProofLoop 支持哪些数据格式？", a: "目前支持 CSV 和 JSON 格式的反馈数据上传。未来将支持更多格式和 API 直接接入。" },
              { q: "分析报告的校验准确率如何？", a: "硬性校验（Hard Validation）覆盖 43 项规则，确保数据完整性与逻辑一致性。语义校验（Semantic Validation）通过 AI 交叉验证，当前平均语义评分达 88%。" },
              { q: "是否支持团队协作？", a: "当前为本地 Demo 模式。SaaS 版本将支持多成员协作、权限管理与实时通知。" },
              { q: "数据安全如何保障？", a: "所有数据处理在本地完成，不上传至外部服务器。SaaS 版本将提供端到端加密与 SOC 2 合规。" },
            ].map((item) => (
              <div key={item.q} className="bg-warm-white p-6 rounded-xl editorial-border">
                <h3 className="font-title-lg text-title-lg text-near-black mb-2">{item.q}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call To Action */}
      <section className="py-xl px-margin-mobile md:px-margin-desktop bg-near-black text-white text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="font-headline-md text-headline-md text-white">让每一个产品决策都有证据可追踪</h2>
          <p className="font-body-lg text-body-lg text-outline-variant">
            加入数百个卓越产品团队，用 ProofLoop 构建可信赖的用户声音体系。
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/login" className="bg-white text-near-black px-8 py-3 rounded-full font-label-md text-label-md hover:bg-surface-container-high transition-colors">
              开始分析反馈
            </a>
            <a href="/analysis-report" className="bg-transparent text-white px-8 py-3 rounded-full font-label-md text-label-md border border-outline-variant hover:bg-inverse-surface transition-colors">
              查看示例报告
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#FFF8EA] py-12 px-margin-mobile md:px-margin-desktop border-t border-warm-gray">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined fill text-xl text-outline">analytics</span>
            <span className="font-label-md text-label-md text-outline">&copy; 2024 ProofLoop. All rights reserved.</span>
          </div>
          <div className="flex gap-6 font-label-sm text-label-sm text-outline">
            <a className="hover:text-near-black transition-colors" href="#">隐私政策</a>
            <a className="hover:text-near-black transition-colors" href="#">服务条款</a>
            <a className="hover:text-near-black transition-colors" href="#">联系支持</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
