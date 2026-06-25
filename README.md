# Cloud MVP Freeze Summary

> Version: `cloud-mvp-freeze`
> Status: Frozen
> Stack: Vercel + Supabase + Next.js
> Product: ProofLoop / InsightPM-AI
> Freeze Scope: Cloud MVP Demo

---

## 1. Freeze 结论

Cloud MVP 已完成最终验收，可以进入 Freeze 阶段。

当前版本已实现从线上上传 CSV 到生成可演示分析报告的完整闭环：

```text
上传 CSV
→ 解析反馈数量
→ 创建分析任务
→ 写入 Supabase runs
→ Cloud MVP inline 分析完成
→ 写入评分与 metadata
→ 生成报告 artifact
→ /runs 显示运行历史
→ /analysis-report 展示分析报告
```

本阶段不再修改功能代码，只允许修复阻塞性 bug、部署配置问题或明显文案错误。

---

## 2. 当前版本能力

| 能力          | 状态 | 说明                                              |
| ----------- | -: | ----------------------------------------------- |
| CSV 上传      |  ✅ | `/new-analysis` 支持上传 CSV 并解析反馈数量                |
| 反馈数量识别      |  ✅ | 前端解析 CSV 行数，排除表头                                |
| Cloud Mode  |  ✅ | `PROOFLOOP_STORAGE_MODE=cloud` 时走 Supabase      |
| 分析任务创建      |  ✅ | `/api/analyze` 写入 `runs` 表                      |
| 任务状态更新      |  ✅ | Cloud MVP inline 模式直接更新为 `completed`            |
| 运行历史        |  ✅ | `/runs` 读取 `/api/runs` 并显示 completed run        |
| 分数展示        |  ✅ | 硬性校验 95，语义评分 95，证据断裂 0                          |
| 报告生成        |  ✅ | 写入 `report_artifacts`，metadata 存 Markdown 与展示数据 |
| 分析报告页       |  ✅ | `/analysis-report` 默认读取最新 completed run         |
| 分组视图        |  ✅ | 使用 `metadata.segments` 展示 3 个分组                 |
| 证据链         |  ✅ | 使用 `metadata.evidenceItems` 展示证据追踪              |
| 完整 Markdown |  ✅ | 使用 `metadata.markdown` 展示完整报告正文                 |
| PDF 导出页面    |  ✅ | print 页面已加 null 检查，不阻塞                          |
| Local Mode  |  ✅ | 本地 `PROOFLOOP_STORAGE_MODE=local` 不受影响          |

---

## 3. 线上架构

```text
ProofLoop Cloud MVP
├── Vercel
│   ├── Next.js App Router
│   ├── API Routes
│   │   ├── /api/analyze
│   │   ├── /api/runs
│   │   ├── /api/training-data
│   │   └── /api/storage/upload
│   └── Pages
│       ├── /new-analysis
│       ├── /runs
│       ├── /analysis-report
│       └── /analysis-report/print
│
├── Supabase
│   ├── Postgres
│   │   ├── runs
│   │   ├── report_artifacts
│   │   ├── training_datasets
│   │   └── workspace_settings
│   ├── Storage
│   └── API Keys
│
└── Storage Mode
    ├── local → 本地 runs/、training-data/、evaluation-data/
    └── cloud → Supabase Postgres + Storage
```

---

## 4. 核心数据流

### 4.1 新建分析

```text
/new-analysis
→ 选择 CSV
→ parseCsvCount(file)
→ 得到 feedbackCount
→ POST /api/analyze
```

请求核心字段：

```json
{
  "caseName": "11111111",
  "dataset": "mixed-feedback",
  "count": 80
}
```

### 4.2 Cloud MVP inline 分析

`/api/analyze` 在 cloud mode 下不会执行本地 pipeline，也不会调用：

```text
tsx scripts/run-pipeline.ts
```

而是执行 Cloud MVP inline 流程：

```text
createRun()
→ updateRunById(completed)
→ create report_artifacts
→ return completed run
```

### 4.3 runs 表结果

核心字段：

```json
{
  "caseName": "11111111",
  "status": "completed",
  "feedbackCount": 80,
  "hardScore": 95,
  "semanticScore": 95,
  "evidenceBroken": 0,
  "metadata": {
    "mode": "cloud",
    "source": "vercel",
    "worker": "inline-mvp",
    "hasReport": true,
    "feedbackCount": 80,
    "analyzedCount": 80,
    "issueCount": 3,
    "clusterCount": 3,
    "segmentCount": 3,
    "businessSegmentCount": 3,
    "topIssueCount": 3
  }
}
```

### 4.4 report_artifacts 结果

`report_artifacts` 使用真实 schema：

```text
id
run_id
artifact_type
file_name
storage_bucket
storage_path
content_type
size_bytes
created_at
metadata
```

当前 MVP 报告正文存储在：

```text
report_artifacts.metadata.markdown
```

artifact 类型：

```text
overall-md
```

---

## 5. 页面验收状态

| 页面                       | 状态 | 说明                     |
| ------------------------ | -: | ---------------------- |
| `/`                      |  ✅ | 营销首页                   |
| `/dashboard`             |  ✅ | 控制台，显示最近运行             |
| `/new-analysis`          |  ✅ | 上传 CSV，创建 Cloud MVP 分析 |
| `/runs`                  |  ✅ | 显示运行历史、分数、状态、查看报告      |
| `/analysis-report`       |  ✅ | 默认显示最新 completed run   |
| `/analysis-report/print` |  ✅ | PDF/打印页可打开             |
| `/training-data`         |  ✅ | 训练数据管理，modal/toast 正常  |
| `/evaluation`            |  ✅ | 评估校验页面可打开              |
| `/settings`              |  ✅ | 系统设置页面可打开              |
| `/login`                 |  ✅ | Demo 登录                |
| `/signup`                |  ✅ | Demo 注册                |

---

## 6. API 验收状态

| API                   | 状态 | 说明                                                 |
| --------------------- | -: | -------------------------------------------------- |
| `/api/analyze`        |  ✅ | Cloud mode 创建 completed run                        |
| `/api/runs`           |  ✅ | 返回 completed/feedbackCount/hardScore/semanticScore |
| `/api/training-data`  |  ✅ | 返回训练数据统计                                           |
| `/api/storage/upload` |  ✅ | Supabase Storage 上传端点                              |
| `/api/dashboard`      |  ✅ | 保留兼容                                               |

---

## 7. 环境变量

### 7.1 Vercel Production

必须配置：

```env
PROOFLOOP_STORAGE_MODE=cloud

NEXT_PUBLIC_SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_URL=https://<project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<secret-key>

APP_URL=https://<your-vercel-domain>
```

可选模型配置：

```env
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_BASE_URL=

VALIDATION_AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_VALIDATION_MODEL=deepseek-v4-pro
```

### 7.2 Local Mode

本地 `.env.local` 建议：

```env
PROOFLOOP_STORAGE_MODE=local
APP_URL=http://localhost:3000
```

Local mode 会继续使用：

```text
runs/
training-data/
evaluation-data/
```

不会走 Supabase cloud 流程。

---

## 8. Supabase RLS 当前策略

MVP 阶段为了跑通 Demo，`runs` 表已临时放通：

```sql
select / insert / update
to anon, authenticated
```

`report_artifacts` 如需线上读写，也应临时放通对应策略。

注意：这是 MVP Demo 策略，不是生产安全策略。

正式生产需要改成：

```text
workspace_id
user_id
auth.uid()
workspace_members
role-based access
```

---

## 9. 已知限制

| 类别       | 限制                    | 说明                                |
| -------- | --------------------- | --------------------------------- |
| Auth     | 无真实登录后端               | 当前仍是 Demo 登录模式                    |
| Worker   | 无真实 Cloud Worker      | 当前使用 inline MVP 模拟分析              |
| Pipeline | 线上不执行真实 pipeline      | 不执行 `tsx scripts/run-pipeline.ts` |
| 报告       | 报告为 MVP 生成内容          | 不代表真实模型分析结果                       |
| 聚类       | 聚类为 metadata fallback | 非真实聚类算法输出                         |
| 证据链      | 证据为 MVP 示例            | 非真实用户原文追踪                         |
| Storage  | Markdown 存 metadata   | 尚未完整接入 Storage artifact           |
| RLS      | MVP 放通策略              | 生产需重构权限策略                         |
| 多用户      | 未实现团队协作               | 暂无 workspace 成员体系                 |
| 实时进度     | 未实现                   | 当前任务直接 completed                  |
| 导出       | PDF 可打开但能力有限          | 后续需完善正式导出链路                       |

---

## 10. 验收清单

|  # | 验收项                                             | 状态 |
| -: | ----------------------------------------------- | -: |
|  1 | `/new-analysis` CSV 解析 feedbackCount            |  ✅ |
|  2 | `/api/analyze` 收到 count 并写入 runs.feedback_count |  ✅ |
|  3 | `/api/runs` 返回 completed run                    |  ✅ |
|  4 | `/api/runs` 返回 feedbackCount=80                 |  ✅ |
|  5 | `/api/runs` 返回 hardScore=95                     |  ✅ |
|  6 | `/api/runs` 返回 semanticScore=95                 |  ✅ |
|  7 | `/runs` 显示运行历史                                  |  ✅ |
|  8 | `/runs` 操作列显示“查看报告”                             |  ✅ |
|  9 | `/analysis-report` 默认选择最新 completed run         |  ✅ |
| 10 | 综合诊断显示 80 / 95 / 95 / Top 3                     |  ✅ |
| 11 | 分组视图显示 3 个分组                                    |  ✅ |
| 12 | 证据链显示 evidenceItems                             |  ✅ |
| 13 | 完整 Markdown 显示 metadata.markdown                |  ✅ |
| 14 | 导出 PDF 不报错                                      |  ✅ |
| 15 | Local mode 不受影响                                 |  ✅ |
| 16 | pipeline 未修改                                    |  ✅ |
| 17 | Supabase schema 未修改                             |  ✅ |
| 18 | UI 风格未修改                                        |  ✅ |

---

## 11. 当前 Freeze Tag

Git tag：

```text
cloud-mvp-freeze
```

Git 状态：

```text
main up to date with origin/main
working tree clean
```

---

## 12. 后续路线图

### Phase 1: Auth 与权限

* 接入 Supabase Auth
* 实现登录 / 注册真实后端
* 创建 workspace
* 添加 workspace_members
* 重构 RLS policy

### Phase 2: Cloud Worker

* 实现后台 Worker
* 执行真实 pipeline
* 将结果写入 Supabase
* 支持任务状态流转：

  * pending
  * running
  * completed
  * failed

### Phase 3: 真实报告产物

* 写入完整 report_artifacts
* Supabase Storage 持久化 Markdown / PDF / JSON
* Signed URL 下载
* 报告版本管理

### Phase 4: 真实分析能力

* 真实问题聚类
* 真实情感分析
* 真实证据链追踪
* 真实 P0/P1/P2 优先级判断
* 真实语义校验

### Phase 5: 协作与商业化

* 团队工作区
* 报告分享链接
* 权限分级
* 操作日志
* 计费系统
* 多租户隔离

---

## 13. Freeze 规则

从 `cloud-mvp-freeze` 开始：

```text
不再修改功能代码
不再重构架构
不再调整 Supabase schema
不再修改 pipeline
不再变更 UI 风格
```

允许修改：

```text
阻塞性 bug
部署配置错误
安全配置问题
明显文案错误
文档补充
```

---

## 14. 结论

Cloud MVP 已完成端到端演示闭环。

当前版本可以用于：

```text
产品 Demo
投资人演示
内部验收
Cloud 架构验证
Vercel + Supabase 部署验证
```

当前版本不适合直接作为正式生产版本，因为：

```text
暂无真实 Auth
暂无真实 Cloud Worker
暂无真实 pipeline 云端执行
暂无生产级 RLS
暂无团队权限体系
```

最终状态：

```text
✅ Local MVP：通过
✅ Cloud Foundation：通过
✅ Cloud MVP Demo：通过
✅ Vercel + Supabase 线上闭环：通过
✅ cloud-mvp-freeze：完成
```
