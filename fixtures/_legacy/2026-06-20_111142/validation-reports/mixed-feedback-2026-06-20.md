# Agent 报告验证与评分结果

## 基本信息
- Dataset: mixed-feedback
- Generator Model: MiMo
- Validator Model: deepseek-v4-pro
- Status: ⚠️ warning
- Score: 77/100

## 一、总体判断

报告存在一些问题，建议人工复核。

## 二、评分明细

| 维度 | 分值 | 满分 |
|------|------|------|
| 数据真实性 | 10 | 15 |
| 主题覆盖度 | 10 | 15 |
| 聚类准确性 | 10 | 15 |
| 证据引用准确性 | 15 | 15 |
| 指标匹配度 | 10 | 10 |
| 报告格式合规性 | 7 | 10 |
| 结论可信度 | 8 | 10 |
| 无幻觉/无过度推断 | 7 | 10 |

## 三、数据真实性检查

反馈数量: 124
问题簇数量: 24
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

幻觉数量: 0
过度推断数量: 1

## 十、是否可进入训练/测试/回归集

- 可用于训练: 否
- 可用于测试: 是
- 可用于回归: 是
- 需要人工复核: 是

## 十一、修复建议

- Fix the feedback count inconsistency in B2B SaaS renewal segment so that cluster totals match the segment count
- Separate the analysis JSON from the Markdown report into distinct files
- Refine the cross-segment problem identification to only include issues with evidence spanning multiple segments
