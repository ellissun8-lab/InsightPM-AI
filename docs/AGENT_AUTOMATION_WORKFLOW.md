# InsightPM AI Agent 自动化流程文档

## 1. 文档目的

本文档定义 InsightPM AI Agent 的自动化训练评测流程。

当前阶段不接数据库、不接用户正式产品流程、不做页面展示，只做文件级自动化流程。

核心流程：

```text
小米模型生成测试数据
  ↓
小米模型分析数据并生成产品分析报告
  ↓
代码执行硬校验
  ↓
DeepSeek 验证报告准确性并打分
  ↓
输出验证报告
  ↓
输出训练总结报告
```

一句话：

```text
小米负责生成和分析，DeepSeek 负责验证和打分，代码负责事实校验。
```

---

## 2. 一键自动化命令

主命令：

```bash
pnpm train-agent
```

执行后自动完成：

```text
1. 小米生成 6 组测试反馈数据
2. 小米生成 6 组产品分析报告
3. 代码执行硬校验
4. DeepSeek 验证报告准确性
5. DeepSeek 给报告打分
6. 生成 validation-report.json
7. 生成 validation-report.md
8. 生成 agent-training-summary.md
9. 终端输出 PASS / WARNING / FAIL
```

用户不需要手动执行中间步骤。

---

## 3. 模型分工

| 角色   | 模型              | 职责               |
| ---- | --------------- | ---------------- |
| 数据生成 | 小米模型            | 生成测试反馈数据         |
| 报告生成 | 小米模型            | 分析数据并生成产品分析报告    |
| 硬校验  | 代码              | 校验文件、数量、证据、格式、指标 |
| 语义验证 | DeepSeek V4 Pro | 验证报告准确性、幻觉、过度推断  |
| 打分   | DeepSeek V4 Pro | 给报告质量打分          |
| 总结输出 | DeepSeek V4 Pro | 生成验证报告和训练总结      |

原则：

```text
小米负责生产
DeepSeek 负责审核
代码负责事实校验
```

---

## 4. 当前阶段不做

当前阶段不要做：

```text
1. 不接数据库
2. 不写 validation_results 表
3. 不接正式用户上传流程
4. 不接"开始分析"按钮
5. 不做页面展示
6. 不做 GitHub Actions
7. 不处理真实用户数据
8. 不做模型 fine-tuning
```

当前阶段只做：

```text
1. 生成测试反馈数据
2. 生成产品分析报告
3. 验证报告准确性
4. 给报告打分
5. 输出训练评测结果
```

---

## 5. 自动化目录结构

```text
scripts/
  train-agent.ts
  generate-feedback-with-mimo.ts
  generate-analysis-with-mimo.ts
  validate-report-with-deepseek.ts

lib/
  ai/
    mimo-provider.ts
    deepseek-provider.ts

  validation/
    validate-files.ts
    validate-report-format.ts
    validate-evidence.ts
    validate-metrics.ts
    calculate-score.ts

fixtures/
  feedback/
  analysis/

validation-reports/
  .gitkeep

training-reports/
  .gitkeep

docs/
  AGENT_AUTOMATION_WORKFLOW.md
  GENERATION_PIPELINE_SPEC.md
  VALIDATION_OUTPUT_SPEC.md
```

---

## 6. package.json 命令

```json
{
  "scripts": {
    "train-agent": "tsx scripts/train-agent.ts",
    "generate:feedback": "tsx scripts/generate-feedback-with-mimo.ts",
    "generate:analysis": "tsx scripts/generate-analysis-with-mimo.ts",
    "validate:report": "tsx scripts/validate-report-with-deepseek.ts"
  }
}
```

---

## 7. 环境变量

```env
MIMO_API_KEY=
MIMO_BASE_URL=
MIMO_GENERATION_MODEL=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_VALIDATION_MODEL=deepseek-v4-pro
```

说明：

```text
MIMO_GENERATION_MODEL 必须使用小米平台真实 model id。
不要在代码里写死中文模型名。
```

---

## 8. 主控脚本执行顺序

`scripts/train-agent.ts` 必须按以下顺序执行：

```text
Step 1: 调用小米模型生成测试反馈数据
Step 2: 调用小米模型生成产品分析报告
Step 3: 执行代码硬校验
Step 4: 调用 DeepSeek 验证和打分
Step 5: 保存 validation-report.json
Step 6: 保存 validation-report.md
Step 7: 生成 agent-training-summary.md
Step 8: 输出终端总结
```

如果某组数据失败：

```text
不中断全部流程
继续下一组
最终汇总 pass / warning / fail
```

---

## 9. 终端输出示例

```text
InsightPM Agent Training Started

Step 1: Generating feedback data with MiMo...
Generated datasets: 6
Generated feedback items: 720

Step 2: Generating analysis reports with MiMo...
Generated reports: 6

Step 3: Running hard validation...
b2b-saas-renewal: PASS
b2b-saas-activation: PASS
ai-product-experience: PASS
ecommerce-conversion: PASS
bi-tool-renewal: PASS
internal-system-cost: PASS

Step 4: Running DeepSeek validation and scoring...
b2b-saas-renewal: PASS, score 92
b2b-saas-activation: PASS, score 90
ai-product-experience: WARNING, score 84
ecommerce-conversion: PASS, score 91
bi-tool-renewal: PASS, score 93
internal-system-cost: PASS, score 90

Final Result:
Passed: 5
Warning: 1
Failed: 0
```

---

## 10. 自动化验收标准

完成后必须满足：

```text
1. pnpm train-agent 可以一键执行
2. 小米模型能生成 6 组测试反馈数据
3. 小米模型能生成 6 组产品分析报告
4. analysis.md 保持现有产品分析报告格式
5. analysis.json 可用于验证
6. 代码完成硬校验
7. DeepSeek 完成报告准确性验证
8. DeepSeek 输出评分
9. validation-reports 下生成 json 和 md
10. training-reports 下生成总训练总结
11. 终端输出 pass / warning / fail
```
