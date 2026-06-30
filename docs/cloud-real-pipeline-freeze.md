# Cloud Real Pipeline Phase 5 Freeze

> **冻结日期**: 2026-06-30
> **状态**: 生产 Railway Worker 端到端验收通过（含 Worker 稳定性 + 产品体验 + 质量监控）

---

## 最终生产验收案例

### 成功链路: prod-stability-success-004

```
case_name:       prod-stability-success-004
status:          completed
feedback_count:  124
hard_score:      95
semantic_score:  100
retry_count:     0
max_retry:       2
worker:          railway-worker
workerStep:      completed
workerResult:    artifacts-written-ok
pipelineExecuted: true
artifactWritten:  true
error:           null
```

### 失败链路: prod-stability-success-003

```
case_name:       prod-stability-success-003
status:          failed
category:        semantic_validation
retryable:       false
stdoutPreview:   ✅ 已保存
stderrPreview:   ✅ 已保存
locked_by:       null
locked_at:       null
```

---

## Report Artifacts

| artifact_type | file_name | source |
|---------------|-----------|--------|
| segment-json | mixed-feedback.segments.json | real-pipeline |
| validation-json | validation-summary.json | real-pipeline |
| overall-md | prod-stability-success-004.analysis.md | real-pipeline |
| summary-json | run-summary.json | real-pipeline |

---

## Pipeline 执行结果

```
Steps: 11 pass, 0 fail, 0 skipped
Hard Validation: warning (95/100)
Semantic Validation: pass (100/100)
Promoted: true
Worker: railway-worker
```

---

## 当前能力

- ✅ 上传 CSV 到 Supabase Storage uploads bucket
- ✅ 创建 pending run
- ✅ Railway Worker 拉取 pending run
- ✅ Worker 下载 input.csv（REST API + SDK fallback）
- ✅ Worker 执行真实 pipeline（scripts/run-pipeline.ts）
- ✅ MiMo 生成 analysis.json（含 evidence guard + priority guard）
- ✅ 硬性校验通过（95/100）
- ✅ DeepSeek 语义校验通过（100/100）
- ✅ consistency_guard 通过
- ✅ promote_to_training 通过
- ✅ dataset_index_update 通过
- ✅ report_artifacts 写入 summary-json + overall-md + validation-json + segment-json
- ✅ 前端读取真实 artifacts
- ✅ /runs 显示真实报告
- ✅ /analysis-report 显示真实报告
- ✅ Railway Worker 常驻运行
- ✅ 失败 metadata.error 持久化（完整 stdout/stderr/exitCode/signal）
- ✅ 原子抢单（claim_next_run + FOR UPDATE SKIP LOCKED）
- ✅ 心跳机制（30s 间隔，10min stale 超时）
- ✅ 自动重试（max_retry=2，retryable 错误回 pending）
- ✅ 错误分类（7 级优先级，semantic > hard > network > training > artifact > ai > unknown）
- ✅ 锁清理（failed/retry 均清空 locked_by/locked_at）
- ✅ 终态保护（completed/failed 不可覆盖 + trigger 防护）
- ✅ /runs 搜索/状态筛选/artifact筛选/时间筛选/排序/分页
- ✅ /runs 空状态引导（新建分析/清空筛选）
- ✅ /runs/[caseName] 状态摘要/错误详情/artifact列表/预览面板
- ✅ /runs/[caseName] 用户可读错误解释（8种分类）
- ✅ /analysis-report 下载按钮（完整报告/运行摘要/验证结果/分组结构）
- ✅ /new-analysis 新手引导/CSV示例/上传后引导
- ✅ Artifact Preview API（白名单 + JSON pretty + Markdown）
- ✅ Artifact Download API（白名单 + Content-Disposition）
- ✅ 运行指标监控（durationMs/stepDurations/slowSteps/aiModel/validationModel）
- ✅ 成本可观测性结构（tokenUsage/costEstimatedUsd，当前为 null）
- ✅ /quality 质量与运行概览页面
- ✅ /api/quality/summary 质量统计 API（成功率/评分趋势/失败分类/慢步骤）
- ✅ Prompt/模型版本管理（promptVersion/validationPromptVersion/aiConfig）
- ✅ 200/500/1000 条压力测试通过（500 completed, H=95 S=99）

---

## Railway 修复项

| 修复 | 说明 |
|------|------|
| Nixpacks 安装 python312 | `nixpacks.toml` 配置 `nixPkgs = ["nodejs_22", "python312"]` |
| PYTHON_BIN=python3 | Railway Variables 设置 |
| training-data/manifests 自动 mkdir | `promote-to-training.ts` 写入前确保目录存在 |
| failed metadata.error 持久化 | Worker 所有异常写入 `metadata.error`（含 stdout/stderr） |
| mark_run_failed 完整 payload | 004 迁移：error_payload JSONB 替代 flat string |
| 锁清理 | failed/retry 路径均清空 locked_by/locked_at |
| 终态保护 trigger | 防止 status=running + metadata.error 共存 |
| 错误分类修复 | semantic_validation 优先于 hard_validation，warning 不误判 |

---

## 当前限制

- **Concurrency**: 当前 concurrency = 1
- **AI 输出质量**: MiMo JSON 输出已有 repair/sanitize，但生产仍需监控
- **Storage 稳定性**: Supabase Storage 下载已有 REST fallback，但生产仍需监控网络稳定性
- **测试覆盖**: 124 条已完成验收，200 条建议作为压力测试

---

## 环境变量

### Vercel Web

```
PROOFLOOP_STORAGE_MODE=cloud
CLOUD_ANALYSIS_MODE=worker
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Railway Worker

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
WORKER_POLL_INTERVAL_MS=10000
PYTHON_BIN=python3
AI_PROVIDER=openai
OPENAI_API_KEY=xxx
OPENAI_BASE_URL=https://api.xiaomimimo.com/v1
OPENAI_MODEL=mimo-v2.5-pro
VALIDATION_AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_VALIDATION_MODEL=deepseek-chat
```

---

## Supabase 资源

### Buckets

- `uploads` - 用户上传的 CSV 文件
- `report-artifacts` - 分析产物（JSON、Markdown）

### Tables

- `runs` - 分析任务记录
- `report_artifacts` - 产物元数据

---

## 关键提交

```
55bf7cb feat: add prompt versioning and load quality tuning
923c0cd test: add scale load validation results
d9054a9 feat: add quality trends and failure analytics
bfc2f8f feat: add run metrics and cost monitoring
a1c2f85 feat: polish onboarding empty states and copy
1ab1db9 fix: correct artifact filter pagination totals
aeca439 feat: add runs search filters and pagination
3d8865d fix: use direct Supabase queries in artifact preview/download APIs
f8cb3d8 feat: add artifact preview and download
b8b047e feat: improve run status and artifact UX
b6b2b17 fix: classify semantic validation failures correctly
c577092 fix: preserve pipeline failure details and finalize run status
399c548 fix: create training data directories during promote
9a91d2a chore: install python in railway worker
51b365e fix: persist railway worker preflight errors
e96b86e fix: support python3 and railway env propagation
046a7ca docs: freeze cloud real pipeline phase 2
```

---

*Cloud Real Pipeline Phase 5 生产验收通过，进入 Freeze 状态。*
