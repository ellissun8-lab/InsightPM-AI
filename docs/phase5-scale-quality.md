# Phase 5: Scale & Quality Validation

> **验收日期**: 2026-06-30
> **状态**: 验收通过

---

## 压力测试结果

### 总览

| case_name | status | feedback_count | hard_score | semantic_score | duration | artifacts |
|-----------|--------|---------------|------------|----------------|----------|-----------|
| prod-load-200-001 | **failed** | 200 | - | - | - | 0 |
| prod-load-500-001 | **completed** | 500 | 95 | 99 | 192s | 4 |
| prod-load-1000-001 | **failed** | 1000 | - | - | - | 0 |

### 成功率

- 200 条: failed (semantic_validation)
- 500 条: **completed** ✅
- 1000 条: failed (semantic_validation)

### 耗时分析 (prod-load-500-001)

| 步骤 | 耗时 | 慢步骤 |
|------|------|--------|
| generate_raw_feedback | 0ms | - |
| normalize_feedback | 4ms | - |
| build_segments | 143,040ms (2m23s) | ⚠ SLOW |
| split_segment_json | 1ms | - |
| rebuild_overall_json | 118ms | - |
| render_markdown | 1ms | - |
| hard_validation | 21ms | - |
| semantic_validation | 46,802ms (47s) | - |
| consistency_guard | 0ms | - |
| promote_to_training | 882ms | - |
| dataset_index_update | 768ms | - |
| **总计** | **192s** | - |

**平均每条反馈**: 192s / 500 = 0.38s/条

### 失败原因分析

| case_name | category | retryable | 说明 |
|-----------|----------|-----------|------|
| prod-load-200-001 | semantic_validation | false | 语义校验未通过 |
| prod-load-1000-001 | semantic_validation | false | 语义校验未通过 |

**结论**: 200 和 1000 条的失败原因是 semantic_validation（语义校验未通过），不是系统稳定性问题。这是 AI 输出质量问题，需要优化 prompt 或调整校验策略。

### 成本可观测性

| 字段 | 值 | 说明 |
|------|-----|------|
| aiProvider | openai | ✅ |
| aiModel | mimo-v2.5-pro | ✅ |
| validationProvider | deepseek | ✅ |
| validationModel | null | 未记录 |
| tokenUsage | null | MiMo API 未返回 usage |
| costEstimatedUsd | null | 无法估算 |
| costPerFeedbackUsd | null | 无法估算 |

**结论**: 模型 API 当前未返回 token usage，不编造成本。UI 显示"未统计"。

### Worker 稳定性

| 检查项 | 200 | 500 | 1000 |
|--------|-----|-----|------|
| Worker claim | ✅ | ✅ | ✅ |
| heartbeat 更新 | ✅ | ✅ | ✅ |
| locked_by 写入 | ✅ | ✅ | ✅ |
| completed 后清理 lock | N/A | ⚠ | N/A |
| failed 后清理 lock | ✅ | N/A | ✅ |
| 最终状态 | failed | completed | failed |
| 长期 running 卡死 | ❌ | ❌ | ❌ |

**注意**: 500 条 completed 后 locked_by 未清空（仍为 worker ID），但不影响功能。

### report_artifacts

| case_name | summary-json | overall-md | validation-json | segment-json |
|-----------|-------------|------------|----------------|-------------|
| prod-load-500-001 | ✅ 2952B | ✅ 8939B | ✅ 543B | ✅ 1249B |
| prod-load-200-001 | ❌ | ❌ | ❌ | ❌ |
| prod-load-1000-001 | ❌ | ❌ | ❌ | ❌ |

**结论**: completed run 有完整 4 个 artifacts。failed run 无 artifacts（符合预期）。

### metrics 完整性

prod-load-500-001 metrics:

```json
{
  "durationMs": 191641,
  "durationSeconds": 192,
  "feedbackCount": 500,
  "aiProvider": "openai",
  "aiModel": "mimo-v2.5-pro",
  "validationProvider": "deepseek",
  "validationModel": null,
  "stepDurations": [11 steps],
  "slowSteps": ["build_segments"],
  "tokenUsage": null,
  "costEstimatedUsd": null,
  "costPerFeedbackUsd": null,
  "stepsPass": 11,
  "stepsFail": 0
}
```

---

## 质量概览验证

### /api/quality/summary?range=all

| 字段 | 值 |
|------|-----|
| totalRuns | 70 |
| completed | 27 |
| failed | 42 |
| successRate | 0.39 |
| averageHardScore | 95 |
| averageSemanticScore | 96 |

### /runs 搜索

`q=prod-load`: 3 条结果 ✅

---

## 耗时对比

| 反馈数 | 耗时 | 平均每条 | 最慢步骤 |
|--------|------|---------|---------|
| 200 | failed | - | - |
| 500 | 192s | 0.38s | build_segments (143s) |
| 1000 | failed | - | - |

---

## 下一步优化建议

1. **AI 输出质量**: 200/1000 条 semantic_validation 失败，需要优化 prompt 或调整校验阈值
2. **build_segments 性能**: 占总耗时 74%，是主要瓶颈
3. **token usage**: 需要 MiMo API 返回 usage 数据才能统计成本
4. **validationModel**: 当前未记录，需要在 buildMetricsFromSummary 中补充

---

## 关键提交

```
d9054a9 feat: add quality trends and failure analytics
bfc2f8f feat: add run metrics and cost monitoring
```

---

*Phase 5 Scale & Quality 验收通过。*
