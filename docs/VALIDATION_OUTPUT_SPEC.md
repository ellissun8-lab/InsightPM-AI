# DeepSeek 验证与输出物规范

## 1. 文档目的

本文档定义 DeepSeek 在 Agent 训练评测链路中的验证、打分和输出规范。

DeepSeek 不负责生成测试数据，也不负责重写小米生成的分析报告。

DeepSeek 只负责：

```text
验证
审查
打分
给改进建议
输出验证报告
输出训练总结
```

---

## 2. DeepSeek 输入

DeepSeek 每次验证一个 dataset。

输入包括：

```text
1. fixtures/feedback/{dataset}.csv 的摘要
2. fixtures/analysis/{dataset}.analysis.md
3. fixtures/analysis/{dataset}.analysis.json
4. 代码硬校验结果
```

---

## 3. DeepSeek 验证内容

DeepSeek 负责检查：

```text
1. 报告是否遵守现有格式
2. 报告结论是否基于反馈数据
3. 高频问题 Top 5 是否合理
4. 高优先级机会是否合理
5. 核心结论是否有证据支撑
6. 建议行动是否过度推断
7. 指标是否匹配 product_type + business_goal
8. 是否出现 forbidden_metrics
9. 是否出现幻觉
10. 是否适合进入训练/测试/回归集
```

DeepSeek 不负责：

```text
1. 反馈数量硬校验
2. evidence_id 是否存在的硬校验
3. 文件是否存在的硬校验
4. CSV 字段完整性硬校验
```

这些由代码完成。

---

## 4. 代码硬校验内容

代码在调用 DeepSeek 前，必须先完成硬校验。

硬校验包括：

```text
1. CSV 是否存在
2. CSV 是否 120 条
3. CSV 字段是否完整
4. analysis.md 是否存在
5. analysis.json 是否存在
6. analysis.md 是否符合现有报告格式
7. analysis.json 的 evidence_feedback_ids 是否存在于 CSV
8. 每个 cluster 是否至少 2 条证据
9. analysis.md 是否出现 forbidden_metrics
10. analysis.json 的 feedback_count 是否等于 CSV 行数
```

硬校验结果作为 DeepSeek 的输入。

---

## 5. DeepSeek 评分规则

总分 100 分。

| 维度          | 分值 |
| ----------- | -: |
| 数据真实性       | 15 |
| 主题覆盖度       | 15 |
| 聚类准确性       | 15 |
| 证据引用准确性     | 15 |
| 指标匹配度       | 10 |
| 报告格式合规性     | 10 |
| 结论可信度       | 10 |
| 无幻觉 / 无过度推断 | 10 |

状态规则：

```text
score >= 90: pass
score 70-89: warning
score < 70: fail
```

---

## 6. DeepSeek 输出文件

每组 dataset 输出：

```text
validation-reports/{dataset}-{timestamp}.json
validation-reports/{dataset}-{timestamp}.md
```

整体训练评测完成后输出：

```text
training-reports/agent-training-summary-{timestamp}.md
```

---

## 7. validation-report.json 格式

```json
{
  "dataset": "b2b-saas-renewal",
  "status": "pass",
  "score": 92,
  "model_roles": {
    "generator": "mimo",
    "validator": "deepseek-v4-pro"
  },
  "summary": {
    "feedback_count": 120,
    "cluster_count": 8,
    "invalid_evidence_count": 0,
    "forbidden_metric_count": 0,
    "hallucination_count": 0,
    "over_inference_count": 0
  },
  "score_breakdown": {
    "data_realism": 14,
    "theme_coverage": 14,
    "cluster_accuracy": 13,
    "evidence_accuracy": 15,
    "metric_fit": 10,
    "format_compliance": 10,
    "conclusion_credibility": 9,
    "no_hallucination": 7
  },
  "training_decision": {
    "usable_for_training": true,
    "usable_for_testing": true,
    "usable_for_regression": true,
    "requires_human_review": false
  },
  "failed_checks": [],
  "warnings": [],
  "recommendations": []
}
```

---

## 8. validation-report.md 格式

```markdown
# Agent 报告验证与评分结果

## 基本信息
- Dataset:
- Generator Model: MiMo
- Validator Model: DeepSeek V4 Pro
- Status:
- Score:

## 一、总体判断

## 二、评分明细

## 三、数据真实性检查

## 四、主题覆盖检查

## 五、聚类准确性检查

## 六、证据引用检查

## 七、指标匹配检查

## 八、报告格式检查

## 九、幻觉与过度推断检查

## 十、是否可进入训练/测试/回归集

## 十一、修复建议
```

---

## 9. 训练总结报告格式

路径：

```text
training-reports/agent-training-summary-{timestamp}.md
```

格式：

```markdown
# InsightPM AI Agent 训练与验证总结

## 一、本次训练目标

## 二、模型分工
- 小米模型：
- DeepSeek：

## 三、数据集列表

## 四、各数据集评分

## 五、通过的数据集

## 六、需要人工复核的数据集

## 七、失败的数据集

## 八、主要问题

## 九、下一步优化建议
```

---

## 10. 输出验收标准

```text
1. validation-reports 下每个 dataset 有 json 报告
2. validation-reports 下每个 dataset 有 md 报告
3. training-reports 下有总训练总结
4. 每个 json 报告包含 score
5. 每个 json 报告包含 score_breakdown
6. 每个 json 报告包含 training_decision
7. DeepSeek 能识别 forbidden_metrics
8. DeepSeek 能识别幻觉和过度推断
9. DeepSeek 能给出明确修复建议
```

---

## 11. 人工抽检要求

为了降低双模型互相漏判的风险，每次生成 720 条数据后，建议人工抽检：

```text
每组抽 10 条反馈
每组抽 2 个问题簇
每组抽 1 份报告
```

人工检查：

```text
1. 反馈是否像真实用户说的话
2. 主题是否合理
3. 聚类是否准确
4. 报告是否可信
5. 建议是否过度推断
```

目标：

```text
人工抽检通过率 >= 80%
```

---

## 12. 最终结论

当前链路是：

```text
小米负责生成数据和分析报告，
代码负责事实校验，
DeepSeek 负责语义验证和评分，
最终用验证结果优化 Agent 的 Prompt、流程和报告质量。
```

这是一条 Agent 流程训练与评测链，不是大模型 fine-tuning 链。
