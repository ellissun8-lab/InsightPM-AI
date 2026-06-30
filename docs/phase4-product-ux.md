# Phase 4: Product UX

> **验收日期**: 2026-06-30
> **状态**: 验收通过

---

## Steps

| Step | 名称 | 状态 | Commit |
|------|------|------|--------|
| 1 | Runs 状态与错误展示 | ✅ | b8b047e |
| 2 | 报告下载与 artifact 预览 | ✅ | f8cb3d8, 3d8865d |
| 3 | 运行历史搜索/筛选/分页 | ✅ | aeca439, 1ab1db9 |
| 4 | 新手引导、空状态、文案 polish | ✅ | a1c2f85 |

---

## 最终验收案例

### 成功链路: prod-stability-success-004

```
case_name:       prod-stability-success-004
status:          completed
feedback_count:  124
hard_score:      95
semantic_score:  100
worker:          railway-worker
workerResult:    artifacts-written-ok
artifactWritten: true
error:           null
```

**Artifacts:**

| artifact_type | file_name | size |
|---------------|-----------|------|
| summary-json | run-summary.json | 2963 bytes |
| overall-md | prod-stability-success-004.analysis.md | 8310 bytes |
| validation-json | validation-summary.json | 554 bytes |
| segment-json | mixed-feedback.segments.json | 1358 bytes |

### 失败链路: prod-stability-success-003

```
case_name:  prod-stability-success-003
status:     failed
category:   semantic_validation
retryable:  false
error:      语义校验未通过，说明报告内容与原始反馈的证据一致性不足。
stdoutPreview: ✅ 可展开查看
stderrPreview: ✅ 可展开查看
技术详情:      ✅ 默认折叠
```

---

## 页面能力清单

### /new-analysis

- ✅ 新手引导说明（上传 CSV → 自动生成报告）
- ✅ CSV 字段要求说明
- ✅ 示例 CSV 格式折叠区（FB001/FB002/FB003）
- ✅ 上传成功后显示"分析任务已创建，正在排队处理"
- ✅ 查看任务状态 / 返回任务列表按钮

### /runs

- ✅ 搜索（case_name、scenario）
- ✅ 状态筛选（全部/排队中/分析中/已完成/失败）
- ✅ Artifact 筛选（有完整报告/缺少完整报告/有任意产物/无产物）
- ✅ 时间筛选（全部/今天/7天/30天）
- ✅ 排序（最新创建/最早创建/最近更新/语义评分）
- ✅ 分页（20/50/100 条/页，上一页/下一页）
- ✅ URL 同步（刷新后筛选条件保留）
- ✅ 空状态引导（无 runs → 新建分析；无匹配 → 清空筛选）
- ✅ Artifact 数量/报告 badge 显示

### /runs/[caseName]

- ✅ "分析任务详情"标题
- ✅ 状态摘要卡片（status/feedback_count/scores/retry/worker/heartbeat）
- ✅ 状态说明文案（pending/running/completed/failed）
- ✅ completed → "查看完整报告" CTA
- ✅ failed → 错误详情卡片（用户可读解释 + 技术详情折叠）
- ✅ 错误分类解释（semantic_validation/hard_validation/storage/network/unknown 等）
- ✅ retryable 文案（可自动重试 / 需要修正输入）
- ✅ Artifact 列表（预览 + 下载 + 大小）
- ✅ Artifact 内联预览面板（Markdown / JSON）

### /analysis-report

- ✅ 默认选中最新 completed + artifactWritten 的 run
- ✅ 顶部中文标签（分析任务/real-pipeline/railway-worker）
- ✅ 4 个下载按钮（下载完整报告/运行摘要/验证结果/分组结构）
- ✅ 空状态（暂无可查看的分析报告 → 新建分析任务）

---

## Artifact API

### Preview API

```
GET /api/artifacts/{runId}/preview?type={artifactType}
```

| type | HTTP | Content-Type | 说明 |
|------|------|-------------|------|
| overall-md | 200 | application/json | 返回 Markdown 文本 |
| summary-json | 200 | application/json | 返回 pretty JSON |
| validation-json | 200 | application/json | 返回 pretty JSON |
| segment-json | 200 | application/json | 返回 pretty JSON |

### Download API

```
GET /api/artifacts/{runId}/download?type={artifactType}
```

| type | HTTP | Content-Disposition |
|------|------|-------------------|
| overall-md | 200 | attachment; filename="*.analysis.md" |
| summary-json | 200 | attachment; filename="run-summary.json" |
| validation-json | 200 | attachment; filename="validation-summary.json" |
| segment-json | 200 | attachment; filename="mixed-feedback.segments.json" |

### 安全

- ✅ 白名单校验（4 种 type）
- ✅ 非法 type → 400
- ✅ 不存在 runId → 404
- ✅ 缺少 type → 400
- ✅ 不暴露 API key / service role key

---

## 文案统一

- ✅ Analysis/Run → 分析任务
- ✅ Artifact → 报告产物
- ✅ overall-md → 完整报告
- ✅ summary-json → 运行摘要
- ✅ validation-json → 验证结果
- ✅ segment-json → 分组结构
- ✅ pending → 排队中 / running → 分析中 / completed → 已完成 / failed → 失败
- ✅ 无 Cloud MVP / mock / fixture / inline fallback 字样

---

## 错误消息映射

| category | 用户可读标题 | 描述 |
|----------|------------|------|
| semantic_validation | 语义校验未通过 | 报告内容与原始反馈证据的一致性不足 |
| hard_validation | 硬性校验未通过 | 输入格式或结构性规则不满足 |
| storage | 文件访问失败 | 系统无法读取上传的 CSV 文件 |
| ai_generation | AI 分析生成失败 | AI 模型在生成分析报告时出错 |
| network | 网络请求失败 | AI 服务或存储访问超时 |
| unknown | 分析失败 | 系统处理时发生未知错误 |

---

## 关键提交

```
a1c2f85 feat: polish onboarding empty states and copy
1ab1db9 fix: correct artifact filter pagination totals
aeca439 feat: add runs search filters and pagination
3d8865d fix: use direct Supabase queries in artifact preview/download APIs
f8cb3d8 feat: add artifact preview and download
b8b047e feat: improve run status and artifact UX
```

---

## 已知限制

- 本地 DeepSeek 未配置会导致 verify:cloud-final 3 项 fail（Railway 生产已配，不阻塞）

---

*Phase 4 Product UX 验收通过。*
