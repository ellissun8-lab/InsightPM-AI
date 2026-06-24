# InsightPM AI - Demo Summary

## Project Goal

InsightPM AI is an AI-powered user feedback analysis tool for product managers. The MVP core loop: **Create Project → Upload Feedback → AI Analysis → Opportunity Sorting → Generate Report**.

## MVP Capabilities

1. **Feedback Normalization**: Raw CSV → structured JSON with sentiment, category, urgency
2. **Segmentation**: Group feedback by product area, business goal, feedback type
3. **Issue Clustering**: Identify patterns and group related feedback into actionable clusters
4. **Priority Assignment**: P0/P1/P2 based on feedback volume and impact
5. **Opportunity Scoring**: 40-90 scale ranking for product improvement opportunities
6. **Report Generation**: Executive summary, risk alerts, detailed segment analysis

## Data Pipeline

```
raw CSV → normalized JSON → segments.json → overall JSON → segment JSONs → MDs → validation
```

### Pipeline Steps

1. **Copy Input**: Raw feedback CSV
2. **Normalize**: AI-powered normalization (sentiment, category, urgency)
3. **Analyze**: Generate segments and clusters
4. **Split Segments**: Create individual segment analysis files
5. **Rebuild Overall**: Aggregate into overall analysis JSON and MD
6. **Copy MDs**: Move markdown reports to analysis-md/
7. **Hard Validation**: 42 automated checks
8. **Semantic Validation**: AI-powered quality assessment
9. **Consistency Guard**: Cross-file consistency verification
10. **Promote**: Move to training data if all checks pass

## Validation Pipeline

### Hard Validation (42 checks)

- **Count Closure**: feedback_count === evidence_feedback_ids.length
- **Evidence Dedup**: Each feedback_id appears in only one cluster per segment
- **Priority Rules**: fc >= 8 → P0, 5-7 → P1, < 5 → P2
- **Opportunity Score**: Must vary (40-90 range), cannot be all 50
- **Evidence IDs**: Uppercase, valid format (FB\d+), exist in source data
- **Report Structure**: Required sections present, no empty sections

### Semantic Validation (AI-powered)

- Evidence support: All conclusions traceable to feedback IDs
- Recommendation match: Suggestions directly address identified issues
- Priority合理性: Priorities align with feedback volume and impact
- Over-interpretation: No unwarranted conclusions from limited data
- Boss summary accuracy: Executive summary reflects key findings

### Promotion Criteria

- hardFail = 0
- semanticScore >= 85
- criticalIssues = 0
- evidenceBroken = 0
- consistencyGuard = passed

## Training Data Scale

| Metric | Value |
|--------|-------|
| Total Datasets | 20 |
| Accepted Datasets | 20 |
| Rejected Datasets | 0 |
| Total Feedbacks | 2,957 |
| Min Semantic Score | 89 |
| Avg Semantic Score | 95.5 |
| Scenario Types | 7 |

## Scenario Coverage

| Scenario Type | Datasets | Feedbacks | Description |
|---------------|----------|-----------|-------------|
| enterprise-saas-renewal | 3 | 450 | Enterprise SaaS renewal challenges |
| onboarding-activation | 3 | 447 | User onboarding and activation issues |
| ai-product-experience | 3 | 450 | AI product user experience |
| internal-tools-efficiency | 3 | 450 | Internal tool productivity |
| ecommerce-conversion | 3 | 450 | E-commerce conversion optimization |
| bi-dashboard-renewal | 3 | 450 | BI dashboard renewal and value |
| mixed-feedback | 1 | 130 | Mixed realistic feedback |

## Example Commands

### Run Single Pipeline

```bash
npm run insightpm:run -- --case my-case --count 150 --dataset enterprise-saas-renewal
```

### Run Batch

```bash
npm run insightpm:batch-run -- --scenarios enterprise-saas-renewal,onboarding-activation --variants 3
```

### Run CI Smoke Test

```bash
npm run insightpm:ci-smoke
```

### Create Evaluation Split

```bash
npm run insightpm:create-eval-split
```

### Run Evaluation

```bash
npm run insightpm:evaluate -- --case enterprise-saas-renewal-v3
```

### Generate Dataset Index

```bash
npm run insightpm:dataset-index
```

## Current Metrics

### CI Smoke Test Results

```
[PASS] hard_fail_zero
[PASS] semantic_score_min_85
[PASS] critical_issues_zero
[PASS] evidence_broken_zero
[PASS] consistency_guard_passed
[PASS] dataset_index_generatable
[PASS] evaluation_smoke

Total: 7 checks, 7 passed, 0 failed
Status: PASS
```

### Evaluation Benchmark

- **Heldout Datasets**: 8 (one per scenario type)
- **Training Datasets**: 12
- **Heldout Feedbacks**: 1,160
- **Training Feedbacks**: 1,797

### Evaluation Metrics

| Metric | Description |
|--------|-------------|
| segment_count_accuracy | Segment count matches expected |
| cluster_count_accuracy | Cluster count matches expected |
| evidence_trace_accuracy | Evidence IDs traceable to source |
| report_structure_score | Required sections present |
| priority_quality_score | Priorities follow rules |
| low_evidence_handling_score | Low-evidence clusters marked |
| noise_positive_unknown_handling_score | Non-business segments handled |
| semantic_score | AI quality assessment |

## Directory Structure

```
insightpm-ai/
├── training-data/
│   ├── accepted/           # 12 training datasets
│   ├── manifests/          # 20 original dataset manifests
│   ├── releases/
│   │   └── training-data-v0.1/  # Frozen release snapshot
│   ├── dataset-index.json
│   └── validation-summary.csv
├── evaluation-data/
│   ├── heldout/            # 8 heldout datasets
│   ├── manifests/          # Heldout manifest
│   ├── results/            # Evaluation results
│   └── evaluation-summary.json
├── scripts/
│   ├── run-pipeline.ts     # Main orchestrator
│   ├── create-eval-split.ts
│   ├── evaluate.ts
│   ├── ci-smoke-test.ts
│   └── ...
└── docs/
    └── demo-summary.md
```

## Next Roadmap

1. **Expand Scenario Coverage**: Add more product types (mobile apps, marketplace, SaaS onboarding)
2. **Improve Semantic Validation**: Fine-tune prompts based on evaluation feedback
3. **Add Regression Testing**: Compare new runs against baseline metrics
4. **Build Web UI**: Interactive dashboard for exploring analysis results
5. **API Integration**: REST API for programmatic access
6. **Real-time Analysis**: Stream processing for live feedback ingestion
