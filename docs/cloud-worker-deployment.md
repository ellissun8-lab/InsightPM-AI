# Cloud Worker 部署指南

> **版本**: Phase 3 Production
> **状态**: Railway 部署成功（含 Worker 稳定性）

---

## 一、Railway 部署

### 1.1 仓库配置

根目录 `nixpacks.toml`:
```toml
[phases.setup]
nixPkgs = ["nodejs_22", "python312"]

[phases.install]
cmds = [
  "npm install --include=dev",
  "cd apps/worker && npm install --include=dev"
]

[start]
cmd = "cd apps/worker && npm run start"
```

根目录 `railway.json`:
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd apps/worker && npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 1.2 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase Service Role Key |
| `PYTHON_BIN` | ✅ | `python3` |
| `WORKER_POLL_INTERVAL_MS` | ❌ | 轮询间隔，默认 10000ms |
| `AI_PROVIDER` | ✅ | `openai` |
| `OPENAI_API_KEY` | ✅ | MiMo API Key |
| `OPENAI_BASE_URL` | ✅ | `https://api.xiaomimimo.com/v1` |
| `OPENAI_MODEL` | ✅ | `mimo-v2.5-pro` |
| `VALIDATION_AI_PROVIDER` | ✅ | `deepseek` |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | ✅ | `https://api.deepseek.com` |
| `DEEPSEEK_VALIDATION_MODEL` | ✅ | `deepseek-chat` |

### 1.3 部署步骤

1. Fork/Clone 仓库到 GitHub
2. 在 Railway 创建新项目
3. 连接 GitHub 仓库
4. 配置环境变量
5. Railway 自动检测 `nixpacks.toml` 并部署

---

## 二、Worker Start Command

### 开发模式（本地）

```bash
cd apps/worker
npm install
npm run dev
```

### 生产模式（Railway）

```bash
cd apps/worker
npm run start
```

---

## 三、查看 Worker 日志

### Railway Dashboard

1. 进入项目
2. 点击 "Deployments"
3. 点击最新部署
4. 查看 "Logs"

### 日志示例

```
[Worker] ProofLoop Cloud Worker started
[Worker] Poll interval: 10000ms
[Worker] PYTHON_BIN: python3
[Worker] Python: Python 3.12.0
[Worker] Waiting for pending runs...
[Supabase] Querying pending runs...
[Supabase] Found 1 pending run(s)
[Worker] ==============================
[Worker] Picked pending run: xxx
[Worker]   caseName: prod-smoke-e2e-007
[Worker] ==============================
[Worker] Claiming run xxx...
[Worker] Claim success for run xxx
[Worker] Starting processRun...
```

---

## 四、确认 Worker 正在运行

Worker 日志应显示：

```
[Worker] ProofLoop Cloud Worker started
[Worker] Poll interval: 10000ms
[Worker] Python: Python 3.12.0
[Worker] Waiting for pending runs...
[Supabase] Querying pending runs...
[Supabase] Found 0 pending runs
[Worker] No pending runs found. Checking again in 10s...
```

---

## 五、上线 Smoke 测试

### 5.1 创建 Pending Run

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('URL', 'KEY');
supabase.from('runs').insert({
  case_name: 'smoke-test-001',
  scenario: 'mixed-feedback',
  status: 'pending',
  feedback_count: 10,
  metadata: { inputFile: { bucket: 'uploads', path: '...' } }
}).then(({data}) => console.log('Created:', data.id));
"
```

### 5.2 检查 Worker 日志

```
[Worker] Found 1 pending run(s)
[Worker] Picked pending run: xxx
[StorageDownloader] REST download successful
[PipelineRunner] Pipeline Completed Successfully
[Worker] Updated run xxx to completed
```

### 5.3 验证 Supabase

```sql
SELECT status, hard_score, semantic_score, metadata->>'workerResult'
FROM runs WHERE case_name = 'smoke-test-001';
```

---

## 六、常见故障排查

### 6.1 Pending Run 不被处理

**症状**: Worker 日志显示 "No pending runs found"

**排查**:
1. 检查 Worker 环境变量
2. 检查 Supabase runs 表
3. 检查 Worker 日志

### 6.2 Python Not Found

**症状**: `python: not found` 或 `python3: not found`

**排查**:
1. 检查 `nixpacks.toml` 是否包含 `python312`
2. 检查 Railway Variables 中 `PYTHON_BIN=python3`
3. 查看 Worker 启动日志中的 Python 版本

### 6.3 Storage 下载失败

**症状**: `REST download failed`

**排查**:
1. 检查 `uploads` bucket 是否存在
2. 检查文件路径是否正确
3. 检查网络连接

### 6.4 DEEPSEEK_API_KEY Missing

**症状**: `DEEPSEEK_API_KEY is required`

**排查**:
1. 检查 Railway Variables
2. 检查 Worker 启动日志

### 6.5 Semantic Validation Failed

**症状**: `Semantic Validation: fail`

**排查**:
1. 检查 AI 输出质量
2. 检查 evidence_support 得分
3. 检查 DEEPSEEK_API_KEY 配置

### 6.6 Training Data 目录不存在

**症状**: `ENOENT: no such file or directory, open 'training-data/manifests/...'`

**排查**:
1. 检查 `promote-to-training.ts` 是否有 `mkdirSync`
2. 检查 `.gitkeep` 文件是否存在
3. 重新部署 Worker

### 6.7 Metadata Error 为空

**症状**: `status = failed` 但 `metadata.error = null`

**排查**:
1. 检查 Worker 日志
2. 检查 `process-run.ts` 的 catch 块
3. 检查 `index.ts` 的 poll() 错误处理

---

## 七、监控建议

### 7.1 Worker 健康检查

- 定期检查 Worker 日志
- 监控 pending run 数量
- 监控失败率

### 7.2 性能指标

- Pipeline 执行时间
- 上传/下载时间
- AI 分析时间

### 7.3 告警

- Worker 离线
- Pending run 积压
- 失败率异常

---

## 八、Supabase Migrations

| Migration | 说明 |
|-----------|------|
| `001_initial_schema.sql` | 初始表结构 |
| `002_validation_results.sql` | 校验结果字段 |
| `003_worker_stability.sql` | Worker 稳定性字段 + RPC（抢单/心跳/完成/失败） |
| `004_fix_mark_run_failed.sql` | 完整 error payload + 锁清理 + 终态防护 trigger |

---

## 九、生产 Smoke 结果

### prod-stability-success-004（成功）

```
case_name:       prod-stability-success-004
status:          completed
feedback_count:  124
hard_score:      95
semantic_score:  100
worker:          railway-worker
workerResult:    artifacts-written-ok
pipelineExecuted: true
artifactWritten:  true
error:           null

artifacts:
- segment-json / mixed-feedback.segments.json
- validation-json / validation-summary.json
- overall-md / prod-stability-success-004.analysis.md
- summary-json / run-summary.json

steps: 11 pass, 0 fail
promoted: true
```

### prod-stability-success-003（失败）

```
case_name:     prod-stability-success-003
status:        failed
category:      semantic_validation
retryable:     false
stdoutPreview: ✅ 已保存
stderrPreview: ✅ 已保存
locked_by:     null
locked_at:     null
```

---

*Cloud Worker 部署指南 - Phase 3 Production*
