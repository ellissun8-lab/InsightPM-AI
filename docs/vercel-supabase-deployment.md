# ProofLoop Vercel + Supabase 部署指南

> **版本**: 1.0.0  
> **日期**: 2026-06-24  
> **状态**: Cloud Foundation 阶段

---

## 一、前置条件

- GitHub 账号
- Vercel 账号
- Supabase 账号
- Node.js 18+

---

## 二、创建 Supabase 项目

### 2.1 创建项目

1. 访问 https://supabase.com
2. 点击 "New Project"
3. 填写项目信息：
   - Name: `proofloop`
   - Database Password: 设置强密码
   - Region: 选择最近的区域（如 `Northeast Asia (Tokyo)`）
4. 点击 "Create new project"

### 2.2 获取 API Keys

1. 进入项目 → Settings → API
2. 复制以下信息：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

---

## 三、执行数据库 Schema

### 3.1 打开 SQL Editor

1. 进入项目 → SQL Editor
2. 点击 "New query"

### 3.2 执行 Schema

1. 复制 `docs/cloud-schema.sql` 的内容
2. 粘贴到 SQL Editor
3. 点击 "Run" 执行

### 3.3 验证表创建

```sql
-- 检查所有表是否创建成功
select table_name 
from information_schema.tables 
where table_schema = 'public'
order by table_name;
```

应该看到以下表：
- workspaces
- runs
- report_artifacts
- report_segments
- report_clusters
- evidence_items
- training_datasets
- training_feedback
- custom_scenarios
- workspace_settings
- api_key_settings

---

## 四、创建 Storage Buckets

### 4.1 打开 Storage

1. 进入项目 → Storage
2. 点击 "New bucket"

### 4.2 创建 Buckets

创建以下 3 个 buckets：

| Bucket Name | Public | 说明 |
|-------------|--------|------|
| `uploads` | No | 用户上传文件 |
| `report-artifacts` | No | 分析产物 |
| `exports` | No | 临时导出 |

### 4.3 设置 RLS Policies

在 SQL Editor 中执行：

```sql
-- uploads bucket
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'uploads');

create policy "Users can read own uploads"
on storage.objects for select
to authenticated
using (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);

-- report-artifacts bucket
create policy "Service role can manage artifacts"
on storage.objects for all
to service_role
using (bucket_id = 'report-artifacts');

create policy "Authenticated users can read artifacts"
on storage.objects for select
to authenticated
using (bucket_id = 'report-artifacts');

-- exports bucket
create policy "Service role can manage exports"
on storage.objects for all
to service_role
using (bucket_id = 'exports');

create policy "Authenticated users can read exports"
on storage.objects for select
to authenticated
using (bucket_id = 'exports');
```

---

## 五、Vercel 部署

### 5.1 导入 GitHub 仓库

1. 访问 https://vercel.com
2. 点击 "Add New..." → "Project"
3. 选择 GitHub 仓库
4. 点击 "Import"

### 5.2 配置项目

1. Framework Preset: Next.js
2. Root Directory: `apps/web`
3. Build Command: `npm run build`
4. Output Directory: `.next`

### 5.3 配置环境变量

在 Vercel 项目 → Settings → Environment Variables 中添加：

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key | Production, Preview, Development |
| `PROOFLOOP_STORAGE_MODE` | `cloud` | Production, Preview |
| `PROOFLOOP_STORAGE_MODE` | `local` | Development |
| `OPENAI_API_KEY` | OpenAI API Key | Production, Preview, Development |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | Anthropic API Key (可选) | Production, Preview, Development |

### 5.4 部署

1. 点击 "Deploy"
2. 等待构建完成
3. 访问分配的域名

---

## 六、验证部署

### 6.1 验证 API

```bash
# 验证 /api/runs
curl https://your-app.vercel.app/api/runs

# 验证 /api/training-data
curl https://your-app.vercel.app/api/training-data

# 验证 /api/storage/upload (cloud 模式)
curl -X POST https://your-app.vercel.app/api/storage/upload
```

### 6.2 验证页面

1. 访问 `/` - 官网首页
2. 访问 `/login` - 登录页
3. 访问 `/dashboard` - 控制台
4. 访问 `/runs` - 运行历史
5. 访问 `/training-data` - 训练数据

### 6.3 验证数据库

在 Supabase Dashboard → Table Editor 中检查：
- runs 表是否有数据
- training_datasets 表是否有数据

---

## 七、常见问题

### 7.1 Vercel 不支持长期写本地文件

**问题**: Vercel 的文件系统是临时的，每次部署后会重置。

**解决方案**: 
- 使用 `PROOFLOOP_STORAGE_MODE=cloud`
- 所有数据存储在 Supabase
- 不要依赖本地 `runs/`、`training-data/`

### 7.2 .env 不能上传 GitHub

**问题**: 真实的 API keys 不能提交到 Git。

**解决方案**:
- 使用 `.env.example` 作为模板
- 在 Vercel 中配置环境变量
- `.gitignore` 已排除 `.env` 文件

### 7.3 Service Role Key 不能在客户端使用

**问题**: `SUPABASE_SERVICE_ROLE_KEY` 有完全访问权限，不能暴露给前端。

**解决方案**:
- 只在 API Route 中使用 `admin.ts`
- 客户端使用 `client.ts`（anon key）
- Server Component 使用 `server.ts`（anon key）

### 7.4 Cloud Analysis Worker 尚未实现

**问题**: `PROOFLOOP_STORAGE_MODE=cloud` 时，`/api/analyze` 只创建记录，不执行分析。

**解决方案**:
- 当前版本只支持 `local` 模式的完整分析
- `cloud` 模式需要后续实现 worker
- 可以使用 Vercel Cron Jobs 或外部 worker

### 7.5 数据库连接失败

**问题**: Supabase 连接超时或拒绝。

**解决方案**:
- 检查环境变量是否正确
- 检查 Supabase 项目是否暂停（免费版 7 天不活动会暂停）
- 检查网络是否正常

---

## 八、监控与维护

### 8.1 Supabase 监控

- Database → Reports: 查看查询性能
- Storage → Reports: 查看存储使用量
- Auth → Users: 查看用户列表

### 8.2 Vercel 监控

- Dashboard → Analytics: 查看访问量
- Dashboard → Logs: 查看日志
- Dashboard → Speed Insights: 查看性能

### 8.3 告警设置

- Supabase: 设置邮件告警
- Vercel: 设置部署通知

---

## 九、成本估算

### 9.1 Supabase 免费版

- Database: 500 MB
- Storage: 1 GB
- Auth: 50,000 MAU
- Bandwidth: 2 GB

### 9.2 Vercel 免费版

- Build: 1000 分钟/月
- Serverless Functions: 100 GB-hours
- Edge Functions: 500,000 执行次数

### 9.3 升级建议

当超过免费额度时：
- Supabase Pro: $25/月
- Vercel Pro: $20/月

---

*本文档在 Cloud Foundation 阶段创建，后续根据实际部署情况更新。*
