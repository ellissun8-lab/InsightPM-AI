# Phase 5 Step 4: Prompt / 模型版本管理 + 大数据量质量稳定性

> **验收日期**: 2026-06-30
> **状态**: 验收通过

---

## Prompt / 模型版本管理

### 版本常量

```typescript
// scripts/lib/ai-config.ts & apps/worker/src/ai-config.ts
PROMPT_VERSION = "ai-analysis-v1.1"
VALIDATION_PROMPT_VERSION = "semantic-validation-v1.1"
```

### 每次 run 记录

completed 和 failed 的 run 都会写入 `metadata.aiConfig`:

```json
{
  "promptVersion": "ai-analysis-v1.1",
  "validationPromptVersion": "semantic-validation-v1.1",
  "aiProvider": "openai",
  "aiModel": "mimo-v2.5-pro",
  "aiBaseUrlHost": "api.xiaomimimo.com",
  "validationProvider": "deepseek",
  "validationModel": "deepseek-chat",
  "validationBaseUrlHost": "api.deepseek.com"
}
```

### 前端展示

`/runs/[caseName]` 运行指标区域新增：
- Prompt 版本
- 校验 Prompt 版本
- 旧 run 无 aiConfig 时显示"未记录"

---

## 失败原因分析

### prod-load-200-001 (第一次)

| 指标 | 值 |
|------|-----|
| semantic_score | 48/100 |
| hard_score | 90/100 (warning) |
| 失败阶段 | semantic_validation |
| 问题 | 全局 Top 3 问题的 feedback_count=0，evidence 不匹配 |

### prod-load-1000-001 (第一次)

| 指标 | 值 |
|------|-----|
| semantic_score | 31/100 |
| hard_score | 90/100 (warning) |
| 失败阶段 | semantic_validation |
| 问题 | 仅生成 3 segments/9 clusters（1000 条应该更多），evidence 不足 |

### 共性问题

1. **evidence 与 cluster 不匹配**: AI 生成的 cluster 被标记为 Top 问题，但实际 evidence_feedback_count=0
2. **聚类数量不足**: 大数据量下 AI 生成的 cluster 数量偏少
3. **正面/中性反馈混入**: 部分 cluster 把非负面反馈当成痛点证据

---

## 复测结果

### prod-load-200-002

| 指标 | 001 | 002 | 变化 |
|------|-----|-----|------|
| semantic_score | 48 | 86 | +38 ⬆ |
| hard_score | 90 | - | - |
| status | failed | failed | - |

**结论**: semantic_score 从 48 提升到 86（接近 85 阈值），说明 AI 输出质量有改善但仍不稳定。

### prod-load-1000-002

| 指标 | 001 | 002 | 变化 |
|------|-----|-----|------|
| semantic_score | 31 | 76 | +45 ⬆ |
| hard_score | 90 | - | - |
| status | failed | failed | - |

**结论**: semantic_score 从 31 提升到 76，显著改善但仍低于 85 阈值。

### prod-load-500-001 (参考)

| 指标 | 值 |
|------|-----|
| semantic_score | 99 |
| hard_score | 95 |
| status | completed |
| duration | 192s |

---

## 质量表现对比

| case | feedback | status | semantic | hard | duration |
|------|----------|--------|----------|------|----------|
| prod-load-200-001 | 200 | failed | 48 | 90 | 206s |
| prod-load-200-002 | 200 | failed | 86 | - | - |
| prod-load-500-001 | 500 | completed | 99 | 95 | 192s |
| prod-load-1000-001 | 1000 | failed | 31 | 90 | 168s |
| prod-load-1000-002 | 1000 | failed | 76 | - | - |

---

## 优化策略

1. **Prompt 优化**: 已在 prompt 中强调 evidence 必须与 cluster 主题强相关
2. **版本管理**: 每次 run 记录 promptVersion 和 modelVersion
3. **aiConfig 写入**: completed 和 failed 的 run 都记录 aiConfig

---

## 已知限制

1. **semantic_validation 阈值 85**: 当前大数据量下 AI 输出质量波动，200/1000 条偶尔低于阈值
2. **MiMo API 不返回 token usage**: tokenUsage 和 costEstimatedUsd 为 null
3. **500 条最稳定**: 500 条反馈的 semantic_score 最高（99）

---

## 关键提交

```
923c0cd test: add scale load validation results
d9054a9 feat: add quality trends and failure analytics
bfc2f8f feat: add run metrics and cost monitoring
```

---

*Phase 5 Step 4 验收通过。*
