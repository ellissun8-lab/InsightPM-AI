# ProofLoop Cloud Worker

Cloud Worker 负责处理 Supabase 中的 pending runs，执行真实 pipeline 分析。

## 快速开始

### 安装依赖

```bash
cd apps/worker
npm install
```

### 配置环境变量

创建 `.env` 文件：

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
WORKER_POLL_INTERVAL_MS=10000
```

### 启动 Worker

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm run start
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SUPABASE_URL` | Supabase 项目 URL | 必填 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | 必填 |
| `WORKER_POLL_INTERVAL_MS` | 轮询间隔（毫秒） | 10000 |

## 当前状态

Phase 2 Step 2 - 基础框架

- ✅ 连接 Supabase
- ✅ 轮询 pending runs
- ✅ 日志输出
- ⏳ 更新状态为 running（Step 3）
- ⏳ 下载 input.csv（Step 4）
- ⏳ 执行 pipeline（Step 5）
- ⏳ 写回 Supabase（Step 6）

## 日志示例

```
[Worker] ProofLoop Cloud Worker starting...
[Worker] Supabase URL: configured
[Worker] Service Role Key: configured
[Worker] Poll interval: 10s
[Worker] Waiting for pending runs...
[Worker] Found 1 pending run(s)
[Worker] Processing run: 36ef1631-415a-4085-827a-e2f90da69de6
[Worker]   caseName: 测试11
[Worker]   scenario: mixed-feedback
[Worker]   feedback_count: 200
[Worker]   status: pending
[Worker] Run 36ef1631-415a-4085-827a-e2f90da69de6 processing complete (dry run)
```
