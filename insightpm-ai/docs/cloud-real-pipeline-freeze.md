# Cloud Real Pipeline Phase 2 Freeze

> **冻结日期**: 2026-06-28  
> **状态**: 真实 Pipeline 端到端验收通过

---

## 最终验收案例

```
case_name: cc-final-e2e-final-v2
id: 7a3e381a-f244-41e1-9e0d-6421ba80bfc8
status: completed
hard_score: 95
semantic_score: 100
workerResult: artifacts-written-ok
pipelineExecuted: true
artifactWritten: true
error: null
feedback_count: 124
```

---

## Report Artifacts

| artifact_type | file_name | size_bytes | source |
|---------------|-----------|------------|--------|
| summary-json | run-summary.json | 2982 | real-pipeline |
| overall-md | cc-final-e2e-final-v2.analysis.md | 6994 | real-pipeline |
| validation-json | validation-summary.json | 549 | real-pipeline |
| segment-json | mixed-feedback.segments.json | 1184 | real-pipeline |

---

## Pipeline 执行结果

```
Steps: 11 pass, 0 fail, 0 skipped
Hard Validation: warning (95/100)
Semantic Validation: pass (100/100)
Promoted: true
```

---

## 当前能力

- ✅ 上传 CSV 到 Supabase Storage uploads bucket
- ✅ 创建 pending run
- ✅ Worker 拉取 pending run
- ✅ Worker 下载 input.csv（REST API + SDK fallback）
- ✅ Worker 执行真实 pipeline（scripts/run-pipeline.ts）
- ✅ MiMo 生成 analysis.json（含 evidence guard + priority guard）
- ✅ hard_validation 通过（95/100）
- ✅ DeepSeek semantic_validation 通过（100/100）
- ✅ consistency_guard 通过
- ✅ promote_to_training 通过
- ✅ dataset_index_update 通过
- ✅ report_artifacts 写入 summary-json + overall-md
- ✅ 前端读取真实 artifacts
- ✅ /runs 显示真实报告
- ✅ /analysis-report 显示真实报告

---

## 当前限制

- **Worker 部署**: 仍需部署到 Railway / Render 才能生产常驻
- **Concurrency**: 当前 concurrency = 1
- **AI 输出质量**: MiMo JSON 输出已有 repair/sanitize，但生产仍需监控
- **Storage 稳定性**: Supabase Storage 下载已有 REST fallback，但生产仍需监控网络稳定性
- **测试覆盖**: 124 条已完成验收，200 条建议作为部署后压力测试
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

### Worker

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
WORKER_POLL_INTERVAL_MS=10000
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
bf548f9 fix: Worker env 传递使用 loadedVars
b221e46 fix: load-env 添加详细日志追踪 DEEPSEEK_API_KEY
17f9923 fix: artifacts 发现修复 Windows 路径兼容
97d1696 docs: Phase 2 Cloud Worker Freeze 文档
b0d52d7 fix: load-env 返回 loadedVars 确保环境变量持久化
bb3bfcd fix: pipeline-runner env 传递只包含非空变量
```

---

*Cloud Real Pipeline Phase 2 验收通过，进入 Freeze 状态。*
