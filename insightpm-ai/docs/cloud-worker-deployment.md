# Cloud Worker 部署指南

> **版本**: Phase 2  
> **状态**: 生产就绪

---

## 一、Railway 部署

### 1.1 创建项目

1. 访问 https://railway.app
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择 `InsightPM-AI` 仓库

### 1.2 配置 Root Directory

```
apps/worker
```

### 1.3 配置 Start Command

```
npm install && npm run start
```

### 1.4 配置环境变量

| 变量 | 值 |
|------|-----|
| `SUPABASE_URL` | https://xxx.supabase.co |
| `SUPABASE_SERVICE_ROLE_KEY` | sb_secret_xxx |
| `WORKER_POLL_INTERVAL_MS` | 10000 |
| `AI_PROVIDER` | openai |
| `OPENAI_API_KEY` | sk-xxx |
| `OPENAI_BASE_URL` | https://api.xiaomimimo.com/v1 |
| `OPENAI_MODEL` | mimo-v2.5-pro |
| `VALIDATION_AI_PROVIDER` | deepseek |
| `DEEPSEEK_API_KEY` | sk-xxx |
| `DEEPSEEK_BASE_URL` | https://api.deepseek.com |
| `DEEPSEEK_VALIDATION_MODEL` | deepseek-chat |

### 1.5 部署

点击 "Deploy" 按钮

---

## 二、Render 部署

### 2.1 创建 Web Service

1. 访问 https://render.com
2. 点击 "New" → "Web Service"
3. 连接 GitHub 仓库

### 2.2 配置

| 配置项 | 值 |
|--------|-----|
| Name | proofloop-worker |
| Root Directory | apps/worker |
| Environment | Node |
| Build Command | npm install |
| Start Command | npm run start |
| Plan | Free (或 Starter) |

### 2.3 环境变量

同 Railway 配置

### 2.4 部署

点击 "Create Web Service"

---

## 三、Worker Start Command

### 开发模式（本地）

```bash
cd apps/worker
npm install
npm run dev
```

### 生产模式（部署）

```bash
cd apps/worker
npm install
npm run start
```

---

## 四、环境变量清单

| 变量 | 必填 | 说明 |
|------|------|------|
| `SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase Service Role Key |
| `WORKER_POLL_INTERVAL_MS` | ❌ | 轮询间隔，默认 10000ms |
| `AI_PROVIDER` | ✅ | AI 提供商，如 openai |
| `OPENAI_API_KEY` | ✅ | MiMo API Key |
| `OPENAI_BASE_URL` | ✅ | MiMo API URL |
| `OPENAI_MODEL` | ✅ | MiMo 模型名 |
| `VALIDATION_AI_PROVIDER` | ✅ | 验证 AI 提供商 |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | ✅ | DeepSeek API URL |
| `DEEPSEEK_VALIDATION_MODEL` | ✅ | DeepSeek 模型名 |

---

## 五、Supabase Bucket 要求

### 5.1 uploads

- 用途：存储用户上传的 CSV 文件
- 路径格式：`{workspaceId}/{runId}/input.csv`
- 访问：Worker 使用 service_role_key 读取

### 5.2 report-artifacts

- 用途：存储分析产物
- 路径格式：`{runId}/run-summary.json`、`{runId}/analysis.md`
- 访问：Worker 使用 service_role_key 写入

---

## 六、查看 Worker 日志

### Railway

1. 进入项目
2. 点击 "Deployments"
3. 点击最新部署
4. 查看 "Logs"

### Render

1. 进入 Web Service
2. 点击 "Logs"

---

## 七、确认 Worker 正在 Polling

Worker 日志应显示：

```
[Worker] ProofLoop Cloud Worker started
[Worker] Poll interval: 10000ms
[Worker] Waiting for pending runs...
[Supabase] Querying pending runs...
[Supabase] Found 0 pending runs
[Worker] No pending runs found. Checking again in 10s...
```

---

## 八、上线 Smoke 测试

### 8.1 创建 Pending Run

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

### 8.2 检查 Worker 日志

```
[Worker] Found 1 pending run(s)
[Worker] Picked pending run: xxx
[StorageDownloader] REST download successful
[PipelineRunner] Pipeline Completed Successfully
[Worker] Updated run xxx to completed
```

### 8.3 验证 Supabase

```sql
SELECT status, hard_score, semantic_score, metadata->>'workerResult'
FROM runs WHERE case_name = 'smoke-test-001';
```

---

## 九、常见故障排查

### 9.1 Pending Run 不被处理

**症状**: Worker 日志显示 "No pending runs found"

**排查**:
1. 检查 Worker 环境变量 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`
2. 检查 Supabase runs 表中 run 的 status 是否为 "pending"
3. 检查 Worker 日志是否有错误

**解决**:
- 确认 Worker 正在运行
- 确认环境变量正确
- 手动查询 Supabase 验证连接

---

### 9.2 Storage 下载失败

**症状**: `REST download failed` 或 `SDK download failed`

**排查**:
1. 检查 `uploads` bucket 是否存在
2. 检查文件路径是否正确
3. 检查网络连接

**解决**:
- 确认 bucket 存在
- 确认文件已上传
- 检查 Supabase Storage 配置

---

### 9.3 DEEPSEEK_API_KEY Missing

**症状**: `DEEPSEEK_API_KEY is required`

**排查**:
1. 检查 Worker 环境变量
2. 检查 load-env.ts 日志

**解决**:
- 确认环境变量已配置
- 重启 Worker

---

### 9.4 Semantic Validation Failed

**症状**: `Semantic Validation: fail (xx/100)`

**排查**:
1. 检查 AI 输出质量
2. 检查 evidence_support 得分

**解决**:
- 改进 AI prompt
- 增加 max_tokens
- 使用更好的模型

---

### 9.5 Report Artifacts 缺 Overall-md

**症状**: 只有 summary-json，没有 overall-md

**排查**:
1. 检查 artifacts.ts 的 findFiles 函数
2. 检查 pipeline 输出目录

**解决**:
- 确认 pipeline 生成了 markdown 文件
- 检查 Windows 路径兼容性

---

### 9.6 Runs.status 卡 Running

**症状**: Run 状态一直是 "running"

**排查**:
1. 检查 Worker 日志是否有错误
2. 检查 pipeline 是否超时

**解决**:
- 手动重置为 pending
- 检查 Worker 错误日志
- 增加超时时间

---

## 十、监控建议

### 10.1 Worker 健康检查

- 定期检查 Worker 日志
- 监控 pending run 数量
- 监控失败率

### 10.2 性能指标

- Pipeline 执行时间
- 上传/下载时间
- AI 分析时间

### 10.3 告警

- Worker 离线
- Pending run 积压
- 失败率异常

---

*Cloud Worker 部署指南 - Phase 2*
