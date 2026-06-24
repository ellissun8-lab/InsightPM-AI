# InsightPM AI Agent 训练与验证总结

## 一、本次训练目标

验证小米模型生成产品分析报告的质量，通过代码硬校验和 DeepSeek 语义审查评估报告准确性。

## 二、模型分工

- 数据生成：MiMo
- 报告生成：MiMo
- 硬校验：代码
- 语义验证：DeepSeek V4 Pro

## 三、数据集列表

| 数据集 | 反馈数量 | 问题簇数 |
|--------|----------|----------|
| b2b-saas-renewal | 120 | - |
| b2b-saas-activation | 120 | - |
| ai-product-experience | 120 | - |
| ecommerce-conversion | 120 | - |
| bi-tool-renewal | 120 | - |
| internal-system-cost | 120 | - |

## 四、各数据集评分

| 数据集 | 硬校验 | DeepSeek 状态 | 分数 |
|--------|--------|---------------|------|
| b2b-saas-renewal | FAIL | N/A | N/A |
| b2b-saas-activation | FAIL | N/A | N/A |
| ai-product-experience | FAIL | N/A | N/A |
| ecommerce-conversion | FAIL | N/A | N/A |
| bi-tool-renewal | FAIL | N/A | N/A |
| internal-system-cost | FAIL | N/A | N/A |

## 五、通过的数据集

无

## 六、需要人工复核的数据集

无

## 七、失败的数据集

- b2b-saas-renewal: 硬校验失败
- b2b-saas-activation: 硬校验失败
- ai-product-experience: 硬校验失败
- ecommerce-conversion: 硬校验失败
- bi-tool-renewal: 硬校验失败
- internal-system-cost: 硬校验失败

## 八、主要问题

待补充

## 九、下一步优化建议

待补充
