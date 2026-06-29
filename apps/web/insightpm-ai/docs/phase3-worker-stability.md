# Phase 3: Cloud Worker 生产稳定性

> **版本**: 1.0.0  
> **状态**: 生产就绪

---

## 一、原子抢单机制

### 1.1 Supabase RPC

```sql
CREATE OR REPLACE FUNCTION claim_next_run(worker_id text)
RETURNS TABLE(run_id uuid, case_name text, ...) AS $$
  -- 原子操作：SELECT ... FOR UPDATE SKIP LOCKED
  -- 只认领 pending 或 stale running
$$ LANGUAGE plpgsql;
```

### 1.2 认领条件

- `status = 'pending'` 且 `retry_count < max_retry`
- 或 `status = 'running'` 但 `heartbeat_at` 超时（stale）

### 1.3 认领后更新

```sql
UPDATE runs SET
  status = 'running',
  locked_by = worker_id,
  locked_at = NOW(),
  heartbeat_at = NOW(),
  started_at = COALESCE(started_at, NOW())
WHERE id = run_id;
```

---

## 二、Heartbeat

### 2.1 实现

Worker 执行 pipeline 期间，每 30 秒更新 `heartbeat_at`。

```typescript
startHeartbeat(runId, 30000);
// ...
updateHeartbeat(runId, "executing-pipeline");
// ...
stopHeartbeat();
```

### 2.2 作用

- 防止 run 被判定为 stale
- 记录当前 worker step
- 监控 Worker 存活状态

---

## 三、超时恢复

### 3.1 Stale 判定

```sql
-- heartbeat_at 超过 10 分钟没更新
OR (heartbeat_at < NOW() - INTERVAL '10 minutes')
```

### 3.2 处理规则

- `retry_count < max_retry` → 回到 pending，retry_count + 1
- `retry_count >= max_retry` → 标记 failed

---

## 四、失败自动重试

### 4.1 可重试错误

- Supabase fetch failed
- ECONNRESET / ETIMEDOUT
- AI API timeout
- 5xx 错误

### 4.2 不可重试错误

- raw_input_schema_check fail
- hard_validation fail (invalid CSV)
- semantic_validation fail (below threshold)
- missing inputFile
- permission / auth error

### 4.3 重试逻辑

```typescript
if (retryable && retry_count < max_retry) {
  // status = pending, retry_count + 1
} else {
  // status = failed
}
```

---

## 五、错误结构标准化

```json
{
  "message": "...",
  "name": "Error",
  "stack": "...",
  "code": "429",
  "category": "ai_generation",
  "retryable": true,
  "failedAt": "2026-...",
  "workerStep": "executing-pipeline",
  "source": "railway-worker",
  "inputPath": "...",
  "outputDir": "..."
}
```

---

## 六、数据库字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `retry_count` | integer | 当前重试次数 |
| `max_retry` | integer | 最大重试次数 |
| `locked_by` | text | Worker ID |
| `locked_at` | timestamptz | 认领时间 |
| `heartbeat_at` | timestamptz | 最后心跳时间 |
| `completed_at` | timestamptz | 完成时间 |
| `failed_at` | timestamptz | 失败时间 |
| `last_error` | jsonb | 最后错误信息 |

---

## 七、运维 SQL

### 查看 Worker 状态

```sql
SELECT
  id,
  case_name,
  status,
  retry_count,
  max_retry,
  locked_by,
  heartbeat_at,
  metadata->>'workerStep' as worker_step
FROM runs
WHERE status IN ('running', 'pending')
ORDER BY created_at DESC;
```

### 恢复 Stale Runs

```sql
-- 手动恢复超时的 running
UPDATE runs
SET status = 'pending',
    retry_count = retry_count + 1,
    locked_by = NULL,
    locked_at = NULL
WHERE status = 'running'
  AND heartbeat_at < NOW() - INTERVAL '10 minutes'
  AND retry_count < max_retry;
```

---

## 八、环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WORKER_POLL_INTERVAL_MS` | 轮询间隔 | 10000 |
| `PYTHON_BIN` | Python 命令 | python3 |

---

## 九、关键提交

```
399c548 fix: create training data directories during promote
9a91d2a chore: install python in railway worker
51b365e fix: persist railway worker preflight errors
```

---

*Phase 3: Cloud Worker 生产稳定性*
