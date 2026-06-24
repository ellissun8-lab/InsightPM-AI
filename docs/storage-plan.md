# ProofLoop Supabase Storage Plan

> **版本**: 1.0.0  
> **日期**: 2026-06-24  
> **状态**: Cloud Foundation 阶段

---

## 一、Storage Buckets

### 1.1 uploads

**用途**: 用户上传 CSV / JSON 原始反馈文件

**访问权限**: 
- Authenticated users can upload
- Only owner can read

**路径规则**:
```
uploads/{workspaceId}/{runId}/source.csv
uploads/{workspaceId}/{runId}/source.json
```

---

### 1.2 report-artifacts

**用途**: 保存分析产物（Markdown、JSON、CSV、PDF、ZIP）

**访问权限**:
- Authenticated users can read
- Service role can write

**路径规则**:
```
report-artifacts/{workspaceId}/{runId}/overall.md
report-artifacts/{workspaceId}/{runId}/overall.json
report-artifacts/{workspaceId}/{runId}/segments/{segmentId}.json
report-artifacts/{workspaceId}/{runId}/segments/{segmentId}.md
report-artifacts/{workspaceId}/{runId}/hard-validation.json
report-artifacts/{workspaceId}/{runId}/semantic-validation.json
report-artifacts/{workspaceId}/{runId}/validation-summary.json
report-artifacts/{workspaceId}/{runId}/evidence-chain.csv
report-artifacts/{workspaceId}/{runId}/report.pdf
report-artifacts/{workspaceId}/{runId}/artifacts.zip
```

---

### 1.3 exports

**用途**: 临时导出文件（用户下载后可清理）

**访问权限**:
- Authenticated users can read
- Service role can write

**路径规则**:
```
exports/{workspaceId}/{runId}/{timestamp}/export.zip
```

---

## 二、创建 Storage Buckets

在 Supabase Dashboard → Storage 中创建以下 buckets：

```sql
-- 在 SQL Editor 中执行
insert into storage.buckets (id, name, public)
values 
  ('uploads', 'uploads', false),
  ('report-artifacts', 'report-artifacts', false),
  ('exports', 'exports', false);
```

---

## 三、Storage RLS Policies

### 3.1 uploads bucket

```sql
-- Allow authenticated users to upload
create policy "Authenticated users can upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'uploads');

-- Allow users to read their own uploads
create policy "Users can read own uploads"
on storage.objects for select
to authenticated
using (bucket_id = 'uploads' and auth.uid()::text = (storage.foldername(name))[1]);
```

### 3.2 report-artifacts bucket

```sql
-- Allow service role to manage artifacts
create policy "Service role can manage artifacts"
on storage.objects for all
to service_role
using (bucket_id = 'report-artifacts');

-- Allow authenticated users to read artifacts
create policy "Authenticated users can read artifacts"
on storage.objects for select
to authenticated
using (bucket_id = 'report-artifacts');
```

### 3.3 exports bucket

```sql
-- Allow service role to manage exports
create policy "Service role can manage exports"
on storage.objects for all
to service_role
using (bucket_id = 'exports');

-- Allow authenticated users to read exports
create policy "Authenticated users can read exports"
on storage.objects for select
to authenticated
using (bucket_id = 'exports');
```

---

## 四、文件命名规范

### 4.1 源文件

| 类型 | 路径 | 说明 |
|------|------|------|
| CSV | `uploads/{workspaceId}/{runId}/source.csv` | 原始反馈 CSV |
| JSON | `uploads/{workspaceId}/{runId}/source.json` | 原始反馈 JSON |

### 4.2 分析产物

| 类型 | 路径 | 说明 |
|------|------|------|
| Markdown | `report-artifacts/{workspaceId}/{runId}/overall.md` | 整体分析报告 |
| JSON | `report-artifacts/{workspaceId}/{runId}/overall.json` | 整体分析数据 |
| Segment JSON | `report-artifacts/{workspaceId}/{runId}/segments/{segmentId}.json` | 分组分析数据 |
| Segment MD | `report-artifacts/{workspaceId}/{runId}/segments/{segmentId}.md` | 分组分析报告 |
| Hard Validation | `report-artifacts/{workspaceId}/{runId}/hard-validation.json` | 硬性校验结果 |
| Semantic Validation | `report-artifacts/{workspaceId}/{runId}/semantic-validation.json` | 语义校验结果 |
| Validation Summary | `report-artifacts/{workspaceId}/{runId}/validation-summary.json` | 校验摘要 |
| Evidence Chain | `report-artifacts/{workspaceId}/{runId}/evidence-chain.csv` | 证据链 CSV |
| PDF | `report-artifacts/{workspaceId}/{runId}/report.pdf` | PDF 报告 |
| ZIP | `report-artifacts/{workspaceId}/{runId}/artifacts.zip` | 全部产物打包 |

### 4.3 导出文件

| 类型 | 路径 | 说明 |
|------|------|------|
| Export ZIP | `exports/{workspaceId}/{runId}/{timestamp}/export.zip` | 临时导出 |

---

## 五、本地模式对照

| 本地路径 | Supabase Storage 路径 |
|----------|----------------------|
| `runs/{caseName}/input/*.csv` | `uploads/{workspaceId}/{runId}/source.csv` |
| `runs/{caseName}/analysis-md/*.md` | `report-artifacts/{workspaceId}/{runId}/overall.md` |
| `runs/{caseName}/analysis/*.json` | `report-artifacts/{workspaceId}/{runId}/overall.json` |
| `runs/{caseName}/validation-report/*.json` | `report-artifacts/{workspaceId}/{runId}/hard-validation.json` |

---

## 六、Signed URL 策略

### 6.1 上传 Signed URL

- 有效期: 1 小时
- 用途: 前端直接上传到 Supabase Storage

### 6.2 下载 Signed URL

- 有效期: 24 小时
- 用途: 用户下载报告产物

### 6.3 临时导出 URL

- 有效期: 1 小时
- 用途: 导出 ZIP 下载

---

## 七、清理策略

### 7.1 uploads bucket

- 源文件保留 30 天
- 过期后自动删除（通过 Supabase Edge Function 或定时任务）

### 7.2 report-artifacts bucket

- 分析产物永久保留
- 除非用户手动删除 run

### 7.3 exports bucket

- 导出文件保留 24 小时
- 过期后自动删除

---

## 八、大小限制

| Bucket | 单文件限制 | 说明 |
|--------|-----------|------|
| uploads | 10 MB | CSV/JSON 源文件 |
| report-artifacts | 50 MB | PDF/ZIP 可能较大 |
| exports | 100 MB | 导出打包文件 |

---

## 九、监控与告警

### 9.1 监控指标

- 上传成功率
- 下载成功率
- 存储使用量
- 带宽使用量

### 9.2 告警规则

- 存储使用量超过 80%
- 上传失败率超过 5%
- 下载失败率超过 1%

---

*本文档在 Cloud Foundation 阶段创建，后续根据实际使用情况调整。*
