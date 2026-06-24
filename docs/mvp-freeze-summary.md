# ProofLoop MVP Freeze Summary

> **版本**: 1.0.0-mvp  
> **冻结日期**: 2026-06-24  
> **状态**: MVP 验收通过，进入 Freeze 阶段

---

## 一、MVP 当前能力

ProofLoop 是一个面向产品经理的 AI 用户反馈分析工具。MVP 实现了完整的端到端流程：

1. **数据导入** - 支持 CSV/JSON 格式的用户反馈数据上传
2. **AI 分析** - 自动聚类、主题提取、情感分析
3. **校验体系** - 硬性校验（43 项规则）+ 语义校验（AI 交叉验证）
4. **报告生成** - 结构化分析报告，含证据链追溯
5. **产物导出** - 支持 PDF、Markdown、JSON 多格式导出

---

## 二、已完成页面

| 路由 | 页面名称 | 功能 |
|------|----------|------|
| `/` | 官网首页 | 产品介绍、营销展示 |
| `/login` | 登录页 | Demo 登录入口 |
| `/signup` | 注册页 | 账号注册（Demo 模式） |
| `/dashboard` | 控制台 | 运行概览、最近运行列表、统计卡片 |
| `/new-analysis` | 新建分析 | 上传 CSV、配置参数、触发分析 |
| `/runs` | 运行历史 | 所有分析运行的完整列表 |
| `/runs/[caseName]` | 运行详情 | 单个运行的详细信息 |
| `/analysis-report` | 分析报告 | 报告查看、分组切换 |
| `/analysis-report/print` | 打印页面 | PDF 导出专用页面 |
| `/training-data` | 训练数据 | 数据集管理、字段配置 |
| `/evaluation` | 评估校验 | 评估结果查看 |
| `/settings` | 系统设置 | 工作区、引擎、验证、场景、API 密钥配置 |

---

## 三、已完成 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/runs` | GET | 获取所有运行数据（统一数据源） |
| `/api/dashboard` | GET | 获取仪表盘数据 |
| `/api/training-data` | GET | 获取训练数据统计 |
| `/api/upload` | POST | 上传反馈文件 |
| `/api/analyze` | POST | 触发分析流程 |
| `/api/runs/[caseName]` | GET | 获取单个运行详情 |
| `/api/runs/[caseName]/report` | GET | 获取运行报告 |
| `/api/runs/[caseName]/validation` | GET | 获取校验结果 |
| `/api/runs/[caseName]/download` | GET | 下载运行产物 |

---

## 四、数据流程

```
用户上传 CSV
    ↓
/api/upload → runs/<caseName>/input/
    ↓
/api/analyze → Pipeline 执行
    ↓
┌─────────────────────────────────────────────────┐
│  1. generate_raw_feedback                        │
│  2. normalize_feedback                           │
│  3. build_segments                               │
│  4. split_segment_json                           │
│  5. rebuild_overall_json                         │
│  6. render_markdown                              │
│  7. hard_validation (43 项规则)                   │
│  8. semantic_validation (AI 交叉验证)             │
│  9. consistency_guard                            │
│  10. promote_to_training                         │
│  11. dataset_index_update                        │
└─────────────────────────────────────────────────┘
    ↓
runs/<caseName>/
├── run-summary.json          # 运行摘要
├── input/                    # 原始输入
├── normalized/               # 标准化数据
├── analysis/                 # 分析结果 (JSON)
├── analysis-md/              # 分析结果 (Markdown)
├── validation-report/        # 校验报告
└── training-data/            # 训练数据（已采纳）
```

---

## 五、验收通过项

| # | 验收项 | 状态 |
|---|--------|------|
| 1 | 所有页面能打开，不白屏 | ✅ |
| 2 | 没有裸 HTML | ✅ |
| 3 | 没有明显英文 UI | ✅ |
| 4 | Renance 暖色风格保持一致 | ✅ |
| 5 | 上传测试 CSV 能进入分析流程 | ✅ |
| 6 | /dashboard 和 /runs 都能看到新 run | ✅ |
| 7 | 状态显示正确，不再全部是"处理中" | ✅ |
| 8 | /analysis-report 能切换报告和分组 | ✅ |
| 9 | 导出 PDF 打开的是正式 print 页面 | ✅ |
| 10 | /training-data 按钮都有 modal/toast 反馈 | ✅ |
| 11 | /settings 左侧只有 5 个菜单项 | ✅ |
| 12 | 不修改 pipeline、不修改原始数据 | ✅ |

---

## 六、已知限制

### 6.1 功能限制

| 限制项 | 说明 | 影响 |
|--------|------|------|
| 无真实登录后端 | 使用 Demo 模式，直接跳转 | 无法区分用户 |
| API 密钥仅本地存储 | 使用 localStorage | 清除浏览器数据会丢失 |
| 自定义场景不持久化 | 仅在页面 state 中 | 刷新页面会丢失 |
| 无团队协作功能 | 单用户模式 | 无法多人协作 |
| 无实时通知 | 静态页面 | 需手动刷新查看新结果 |

### 6.2 技术限制

| 限制项 | 说明 |
|--------|------|
| 文件上传大小 | 默认 10MB |
| 并发分析 | 不支持（串行执行） |
| 数据库 | 无（文件系统存储） |
| 缓存 | 无（每次请求重新读取） |

### 6.3 数据限制

| 限制项 | 说明 |
|--------|------|
| 反馈数据格式 | 仅支持 CSV/JSON |
| 场景覆盖 | 7 个预设场景 |
| 语言支持 | 主要支持中文 |

---

## 七、后续路线图

### Phase 1: 基础设施（1-2 周）

- [ ] 接入 Supabase Auth（真实登录）
- [ ] 接入 PostgreSQL（数据持久化）
- [ ] 用户权限管理

### Phase 2: 核心增强（2-3 周）

- [ ] 实时分析进度推送
- [ ] 批量分析任务队列
- [ ] 分析结果对比功能
- [ ] 自定义校验规则

### Phase 3: 协作功能（3-4 周）

- [ ] 团队工作区
- [ ] 报告分享与评论
- [ ] 权限分级（管理员/分析师/查看者）
- [ ] 操作日志审计

### Phase 4: 高级功能（4-6 周）

- [ ] 多语言支持（英文）
- [ ] API 开放接口
- [ ] Webhook 集成
- [ ] 定时分析任务
- [ ] 数据可视化增强

### Phase 5: SaaS 化（6-8 周）

- [ ] 多租户架构
- [ ] 计费系统
- [ ] 监控告警
- [ ] 性能优化
- [ ] 安全审计

---

## 八、技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Next.js 14 (App Router) |
| UI 框架 | Tailwind CSS + shadcn/ui |
| 状态管理 | React useState/useEffect |
| 后端 | Next.js API Routes |
| 存储 | 文件系统 (runs/, training-data/) |
| AI 模型 | DeepSeek V4 Pro / GPT-4 / Claude |

---

## 九、目录结构

```
insightpm-ai/
├── apps/
│   └── web/                    # Next.js 应用
│       ├── src/
│       │   ├── app/            # 页面和 API Routes
│       │   ├── components/     # React 组件
│       │   └── lib/            # 工具函数和 Helper
│       └── public/             # 静态资源
├── docs/                       # 项目文档
├── runs/                       # 分析运行数据
├── training-data/              # 训练数据集
├── evaluation-data/            # 评估数据集
└── baseline/                   # 基线数据
```

---

## 十、联系方式

- **产品负责人**: [待填写]
- **技术负责人**: [待填写]
- **文档维护**: [待填写]

---

*本文档在 MVP Freeze 阶段自动生成，后续更新请走正式流程。*
