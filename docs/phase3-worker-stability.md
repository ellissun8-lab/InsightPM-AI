# Phase 3: Worker Stability

> **验收日期**: 2026-06-29
> **状态**: 验收通过

---

## Migrations

| Migration | 状态 | 说明 |
|-----------|------|------|
| `003_worker_stability.sql` | ✅ 已执行 | Worker 稳定性字段 + RPC 函数 |
| `004_fix_mark_run_failed.sql` | ✅ 已执行 | 完整 error payload + 锁清理 + 防护 trigger |

### 003 新增字段

```sql
retry_count   integer DEFAULT 0
max_retry     integer DEFAULT 2
locked_by     text
locked_at     timestamptz
heartbeat_at  timestamptz
completed_at  timestamptz
failed_at     timestamptz
last_error    jsonb
```

### 003 RPC 函数

| 函数 | 说明 |
|------|------|
| `claim_next_run(worker_id)` | 原子抢单，FOR UPDATE SKIP LOCKED |
| `update_run_heartbeat(run_id, worker_step)` | 心跳 + workerStep 更新 |
| `mark_run_completed(run_id, ...)` | 标记完成 + 写入分数 |
| `mark_run_failed(run_id, ...)` | 标记失败（004 重构） |

### 004 修复

- `mark_run_failed` 签名改为 `(run_id uuid, error_payload jsonb, retryable boolean)`
- 非重试路径：`locked_by = NULL`, `locked_at = NULL`
- 重试路径：`locked_by = NULL`, `locked_at = NULL`, `heartbeat_at = NULL`
- 终态保护：`completed`/`failed`/`cancelled` 不可覆盖
- `inputFile` 保留：失败时从现有 metadata 提取 inputFile 再 merge error
- Trigger `trg_prevent_running_with_error`：禁止 `status='running'` + `metadata.error IS NOT NULL`

---

## 错误分类优先级

```
1. semantic_validation  ← 最高优先级（summary "Semantic Validation: fail"）
2. hard_validation      ← 需同时包含 "validation" + "fail"（warning 不命中）
3. network              ← ECONNRESET / ETIMEDOUT / fetch failed / 5xx
4. training_data        ← promote_to_training / dataset_index_update
5. artifact_write       ← artifact
6. ai_generation        ← ai_analysis
7. unknown              ← 兜底
```

**关键修复**: `Hard Validation: warning (95/100)` 不再误分类为 `hard_validation`，因为 warning 不含 `fail`。

---

## 失败落库规则

### Non-retryable

```
status      = 'failed'
failed_at   = NOW()
last_error  = error_payload (完整 JSONB)
locked_by   = NULL
locked_at   = NULL
metadata    = { ...existing, inputFile, error: error_payload }
```

### Retryable (retry_count < max_retry)

```
status       = 'pending'
retry_count  = retry_count + 1
locked_by    = NULL
locked_at    = NULL
heartbeat_at = NULL
last_error   = error_payload
metadata     = { ...existing, retryHistory: [..., { retryAt, error, category, stdoutPreview, stderrPreview }] }
```

---

## 验收案例

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

**Report Artifacts:**

| artifact_type | file_name | source |
|---------------|-----------|--------|
| segment-json | mixed-feedback.segments.json | real-pipeline |
| validation-json | validation-summary.json | real-pipeline |
| overall-md | prod-stability-success-004.analysis.md | real-pipeline |
| summary-json | run-summary.json | real-pipeline |

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

## Worker 稳定性能力

- ✅ 原子抢单（claim_next_run + FOR UPDATE SKIP LOCKED）
- ✅ 心跳机制（30s 间隔，10min stale 超时）
- ✅ 自动重试（max_retry=2，retryable 错误自动回 pending）
- ✅ 完整错误捕获（stdout/stderr/exitCode/signal/command）
- ✅ 错误分类（7 级优先级）
- ✅ 失败落库（last_error + metadata.error 双写）
- ✅ 锁清理（failed/retry 均清空 locked_by/locked_at）
- ✅ 终态保护（completed/failed 不可覆盖）
- ✅ running + error 防护 trigger

---

## 关键提交

```
b6b2b17 fix: classify semantic validation failures correctly
c577092 fix: preserve pipeline failure details and finalize run status
```

---

*Phase 3 Worker Stability 验收通过。*
