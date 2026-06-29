# Cloud Real Pipeline Phase 2 Freeze

> **冻结日期**: 2026-06-29  
> **状态**: 生产 Railway Worker 端到端验收通过

---

## 最终生产验收案例

```
case_name: prod-smoke-e2e-007
status: completed
hard_score: 95
semantic_score: 96
workerResult: artifacts-written-ok
pipelineExecuted: true
artifactWritten: true
error: null
worker: railway-worker
storage_bucket: report-artifacts
source: real-pipeline
```

---

## Report Artifacts

| artifact_type | file_name | source |
|---------------|-----------|--------|
| summary-json | run-summary.json | real-pipeline |
| overall-md | prod-smoke-e2e-007.analysis.md | real-pipeline |
| validation-json | validation-summary.json | real-pipeline |
| segment-json | mixed-feedback.segments.json | real-pipeline |

---

## Pipeline 执行结果

```
Steps: 11 pass, 0 fail, 0 skipped
Hard Validation: warning (95/100)
Semantic Validation: pass (96/100)
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
- ✅ DeepSeek 语义校验通过（96/100）
- ✅ consistency_guard 通过
- ✅ promote_to_training 通过
- ✅ dataset_index_update 通过
- ✅ report_artifacts 写入 summary-json + overall-md + validation-json + segment-json
- ✅ 前端读取真实 artifacts
- ✅ /runs 显示真实报告
- ✅ /analysis-report 显示真实报告
- ✅ Railway Worker 常驻运行
- ✅ 失败 metadata.error 持久化

---

## Railway 修复项

| 修复 | 说明 |
|------|------|
| Nixpacks 安装 python312 | `nixpacks.toml` 配置 `nixPkgs = ["nodejs_22", "python312"]` |
| PYTHON_BIN=python3 | Railway Variables 设置 |
| training-data/manifests 自动 mkdir | `promote-to-training.ts` 写入前确保目录存在 |
| failed metadata.error 持久化 | Worker 所有异常写入 `metadata.error` |

---

## 当前限制

- **Concurrency**: 当前 concurrency = 1
- **AI 输出质量**: MiMo JSON 输出已有 repair/sanitize，但生产仍需监控
- **Storage 稳定性**: Supabase Storage 下载已有 REST fallback，但生产仍需监控网络稳定性
- **测试覆盖**: 124 条已完成验收，200 条建议作为压力测试
- **自动重试**: 失败自动重试和任务恢复后续产品化

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
399c548 fix: create training data directories during promote
9a91d2a chore: install python in railway worker
51b365e fix: persist railway worker preflight errors
e96b86e fix: support python3 and railway env propagation
046a7ca docs: freeze cloud real pipeline phase 2
```

---

*Cloud Real Pipeline Phase 2 生产验收通过，进入 Freeze 状态。*
