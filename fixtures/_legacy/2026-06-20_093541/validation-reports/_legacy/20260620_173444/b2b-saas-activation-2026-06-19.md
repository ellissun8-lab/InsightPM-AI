# Agent 报告验证与评分结果

## 基本信息
- Dataset: b2b-saas-activation
- Generator Model: MiMo
- Validator Model: deepseek-v4-pro
- Status: ⚠️ warning
- Score: 85/100

## 一、总体判断

报告存在一些问题，建议人工复核。

## 二、评分明细

| 维度 | 分值 | 满分 |
|------|------|------|
| 数据真实性 | 10 | 15 |
| 主题覆盖度 | 14 | 15 |
| 聚类准确性 | 14 | 15 |
| 证据引用准确性 | 14 | 15 |
| 指标匹配度 | 10 | 10 |
| 报告格式合规性 | 7 | 10 |
| 结论可信度 | 8 | 10 |
| 无幻觉/无过度推断 | 8 | 10 |

## 三、数据真实性检查

反馈数量: 120
问题簇数量: 3
无效证据数: 0

## 四、主题覆盖检查

待补充

## 五、聚类准确性检查

待补充

## 六、证据引用检查

待补充

## 七、指标匹配检查

禁止指标出现: 0

## 八、报告格式检查

待补充

## 九、幻觉与过度推断检查

幻觉数量: 1
过度推断数量: 0

## 十、是否可进入训练/测试/回归集

- 可用于训练: 否
- 可用于测试: 否
- 可用于回归: 否
- 需要人工复核: 是

## 十一、修复建议

- Correct summary.clustered_feedback_count to 50 (or explicitly mark that only 50 were clustered in this iteration).
- Deliver the validated analysis in a single JSON object without surrounding prose.
- In all conclusions intended for executive audiences, clearly qualify that the findings are based on the first 50 of 120 feedbacks and are preliminary.
- Consider re-running clustering on the full 120-feedback dataset to eliminate the sample-vs-population discrepancy.
