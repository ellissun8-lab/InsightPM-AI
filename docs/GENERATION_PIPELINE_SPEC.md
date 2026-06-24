# 小米生成数据与分析报告规范

## 1. 文档目的

本文档定义小米模型负责生成的内容。

小米模型在当前 Agent 训练评测链路中负责两类产出：

```text
1. 测试反馈数据
2. 产品分析报告
```

这份文档只描述"小米生成"部分，不描述 DeepSeek 验证和最终输出。

---

## 2. 小米模型职责

小米模型负责：

```text
1. 生成测试反馈数据
2. 根据测试反馈进行产品分析
3. 生成 issue_clusters 结构化分析结果
4. 生成产品反馈分析报告
```

小米模型不负责：

```text
1. 验证报告准确性
2. 给报告打分
3. 输出验证报告
4. 代替代码做硬校验
5. 代替 DeepSeek 做语义审查
```

---

## 3. 数据生成规模

第一阶段生成 6 组数据，每组 120 条，总计 720 条。

数据集：

```text
b2b-saas-renewal
b2b-saas-activation
ai-product-experience
ecommerce-conversion
bi-tool-renewal
internal-system-cost
```

---

## 4. 测试数据输出路径

小米生成 CSV 文件：

```text
fixtures/feedback/{dataset}.csv
```

示例：

```text
fixtures/feedback/b2b-saas-renewal.csv
fixtures/feedback/b2b-saas-activation.csv
fixtures/feedback/ai-product-experience.csv
fixtures/feedback/ecommerce-conversion.csv
fixtures/feedback/bi-tool-renewal.csv
fixtures/feedback/internal-system-cost.csv
```

---

## 5. CSV 字段格式

```csv
feedback_id,content,product_type,business_goal,user_type,source,created_at,expected_theme
```

字段说明：

| 字段             | 说明      |
| -------------- | ------- |
| feedback_id    | 反馈唯一 ID |
| content        | 用户反馈内容  |
| product_type   | 产品类型    |
| business_goal  | 当前业务目标  |
| user_type      | 用户类型    |
| source         | 反馈来源    |
| created_at     | 反馈时间    |
| expected_theme | 预期主题    |

---

## 6. 数据生成要求

每条反馈必须满足：

```text
1. content 像真实用户反馈
2. expected_theme 必须明确
3. product_type 必须匹配数据集
4. business_goal 必须匹配数据集
5. user_type 多样化
6. source 多样化
7. created_at 分布在最近 60 天
8. 不允许出现真实个人信息
9. 不允许出现真实公司名
10. 不允许出现手机号、邮箱、身份证等敏感信息
```

生成失败处理：

```text
1. 自动重试一次
2. 仍失败则 fallback 到本地模板生成
3. 在训练总结报告中记录 fallback_used = true
```

---

## 7. 第一阶段数据场景

### 7.1 B端 SaaS / 提升续费

主题：

```text
权限配置复杂
数据准确性不足
报表导出困难
系统集成需求
性能稳定性问题
价格套餐不清晰
客户成功支持不足
```

---

### 7.2 B端 SaaS / 提升激活

主题：

```text
新手引导不清晰
首次配置复杂
示例数据缺失
关键功能找不到
登录注册问题
术语理解困难
销售需要反复指导
```

---

### 7.3 AI 产品 / 改善体验

主题：

```text
AI 幻觉
回复不稳定
响应速度慢
结果不可解释
缺少原始证据
提示词门槛高
人工审核需求
```

---

### 7.4 电商平台 / 提升转化

主题：

```text
商品页信息不清晰
优惠规则复杂
支付失败
物流费用不透明
搜索结果不准确
购物车体验差
售后信任不足
```

---

### 7.5 数据 / BI 工具 / 提升续费

主题：

```text
数据口径不一致
报表加载慢
导出格式混乱
权限配置复杂
自动报告不稳定
数据刷新不及时
系统集成需求
```

---

### 7.6 内部系统 / 降低成本

主题：

```text
审批流程复杂
重复录入
权限申请慢
数据导入麻烦
人工核对成本高
通知不及时
培训成本高
```

---

## 8. 小米生成分析结果

小米读取：

```text
fixtures/feedback/{dataset}.csv
```

然后生成：

```text
fixtures/analysis/{dataset}.analysis.json
fixtures/analysis/{dataset}.analysis.md
```

---

## 9. analysis.md 格式

小米生成的 `analysis.md` 必须使用现有产品分析报告格式：

```markdown
# 产品反馈分析报告

## 一、分析范围
- 反馈数量：
- 问题聚类：
- 来源与时间：

## 二、核心结论

## 三、高频问题 Top 5

## 四、高优先级机会

## 五、建议行动

## 六、风险提醒

## 七、需要进一步验证的问题

## 八、给老板看的摘要
```

禁止：

```text
1. 改标题
2. 删除章节
3. 新增不相关一级章节
4. 写成训练报告
5. 写成验证报告
6. 写成技术文档
```

---

## 10. analysis.json 格式

```json
{
  "dataset": "b2b-saas-renewal",
  "summary": {
    "feedback_count": 120,
    "cluster_count": 8
  },
  "issue_clusters": [
    {
      "name": "权限配置复杂",
      "summary": "企业管理员反馈权限设置流程复杂，缺少批量配置和角色复制能力。",
      "feedback_count": 24,
      "evidence_feedback_ids": ["FB001", "FB009", "FB018"],
      "possible_metrics": ["客服工单量", "客户健康分", "续费率"],
      "priority": "P0",
      "opportunity_score": 88,
      "recommendation": "优先优化权限配置流程，支持批量配置和角色模板。"
    }
  ],
  "analysis_markdown_path": "fixtures/analysis/b2b-saas-renewal.analysis.md"
}
```

---

## 11. analysis.json 要求

```text
1. issue_clusters 必须引用真实 feedback_id
2. evidence_feedback_ids 必须存在于 CSV
3. 每个 cluster 至少 2 条 evidence_feedback_ids
4. feedback_count 必须和数据接近
5. possible_metrics 不能包含 forbidden_metrics
6. analysis_markdown_path 必须真实存在
```

---

## 12. 小米产出验收标准

```text
1. fixtures/feedback 下生成 6 个 CSV
2. 每个 CSV 有 120 条反馈
3. fixtures/analysis 下生成 6 个 analysis.md
4. fixtures/analysis 下生成 6 个 analysis.json
5. analysis.md 使用现有产品分析报告格式
6. analysis.json 中 issue_clusters 有证据 ID
7. evidence_feedback_ids 能对应 CSV 中的 feedback_id
```
