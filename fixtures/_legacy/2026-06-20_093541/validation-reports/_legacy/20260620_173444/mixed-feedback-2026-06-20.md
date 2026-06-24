# Agent 报告验证与评分结果

## 基本信息
- Dataset: mixed-feedback
- Generator Model: MiMo
- Validator Model: deepseek-v4-pro
- Status: ✅ pass
- Score: 92/100

## 一、总体判断

报告质量良好，可以用于训练。

## 二、评分明细

| 维度 | 分值 | 满分 |
|------|------|------|
| 数据真实性 | 15 | 15 |
| 主题覆盖度 | 14 | 15 |
| 聚类准确性 | 10 | 15 |
| 证据引用准确性 | 15 | 15 |
| 指标匹配度 | 10 | 10 |
| 报告格式合规性 | 9 | 10 |
| 结论可信度 | 9 | 10 |
| 无幻觉/无过度推断 | 10 | 10 |

## 三、数据真实性检查

反馈数量: 120
问题簇数量: 36
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
过度推断数量: 0

## 十、是否可进入训练/测试/回归集

- 可用于训练: 是
- 可用于测试: 是
- 可用于回归: 是
- 需要人工复核: 否

## 十一、修复建议

- Ensure all cluster_id values are unique across the entire analysis (e.g., prefix with segment id) to avoid confusion and improve maintainability.
- Consider providing a separate analysis.json file alongside the markdown report to satisfy strict format requirements, though the current inline JSON is acceptable.
