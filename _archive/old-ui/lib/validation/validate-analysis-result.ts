/**
 * 分析结果验证主模块
 */

import { createClient } from "@/lib/supabase/server";
import { validateClusters } from "./validate-clusters";
import { validateMetrics } from "./validate-metrics";
import { validateReport } from "./validate-report";
import { validateHallucinations } from "./validate-hallucinations";
import { validateSemantic } from "./validate-semantic";
import { calculateValidationScore } from "./calculate-validation-score";
import { saveValidationReport } from "./save-validation-report";
import type { ValidationResultInput, ValidationResult, ValidationCheck } from "./types";

/**
 * 验证分析结果
 */
export async function validateAnalysisResult(
  input: ValidationResultInput
): Promise<ValidationResult> {
  const allFeedbackIds = input.feedbackItems.map((f) => f.id);
  const productType = input.project.product_type ?? null;

  // Run all code-based validations
  const clusterCheck = validateClusters(
    input.clusters,
    allFeedbackIds,
    2 // minEvidencePerCluster
  );

  const metricCheck = validateMetrics(
    input.report.content_markdown,
    productType
  );

  // Prepare cluster data for report validation
  const clusterNames = input.clusters.map((c) => c.name);
  const clusterScores = new Map(
    input.clusters.map((c) => [c.name, c.opportunity_score || 0])
  );
  const clusterPriorities = new Map(
    input.clusters.map((c) => [c.name, c.priority || "P3"])
  );

  const reportCheck = validateReport(input.report.content_markdown, {
    productName: input.project.name,
    productType: productType || "",
    feedbackCount: input.feedbackItems.length,
    clusterNames,
    clusterScores,
    clusterPriorities,
  });

  const hallucinationCheck = validateHallucinations(
    input.report.content_markdown,
    input.project.name,
    clusterNames,
    productType,
    metricCheck.allowed_count > 0
      ? Array.from(new Set([...metricCheck.forbidden_found, ...metricCheck.hallucinated_found]))
      : []
  );

  // Run semantic validation with DeepSeek
  let semanticReview;
  let validationProvider = "code";
  let validationModel = "code";
  let modelFallback = false;

  const enableSemanticValidation = process.env.ENABLE_AUTO_VALIDATION !== "false";
  if (enableSemanticValidation) {
    try {
      const semanticResult = await validateSemantic(
        input.report.content_markdown,
        input.project,
        input.clusters.map((c) => ({
          name: c.name,
          summary: c.summary,
          feedback_count: c.feedback_count,
          opportunity_score: c.opportunity_score,
          priority: c.priority,
        }))
      );

      semanticReview = semanticResult.result;
      validationProvider = semanticResult.provider;
      validationModel = semanticResult.model;
      modelFallback = semanticResult.fallback;
    } catch (error) {
      console.error("Semantic validation failed:", error);
      // Don't fail the whole validation if semantic validation fails
      modelFallback = true;
    }
  }

  // Collect all checks
  const allChecks: ValidationCheck[] = [
    ...clusterCheck.checks,
    ...metricCheck.checks,
    ...reportCheck.checks,
    ...hallucinationCheck.checks,
  ];

  // Add semantic review issues as checks
  if (semanticReview && semanticReview.has_issues) {
    for (const issue of semanticReview.issues) {
      allChecks.push({
        name: `semantic_${issue.type}`,
        passed: false,
        message: issue.description,
        severity: issue.severity,
        details: { location: issue.location },
      });
    }
  }

  const failedChecks = allChecks.filter((c) => !c.passed && c.severity === "error");
  const warnings = allChecks.filter((c) => !c.passed && c.severity === "warning");

  // Generate recommendations
  const recommendations: string[] = [];
  if (clusterCheck.invalid_evidence_ids > 0) {
    recommendations.push("修复无效的 evidence_feedback_ids");
  }
  if (clusterCheck.missing_evidence > 0) {
    recommendations.push("为缺少证据的问题簇添加证据");
  }
  if (metricCheck.forbidden_found.length > 0) {
    recommendations.push(`移除报告中禁止出现的指标: ${metricCheck.forbidden_found.join(", ")}`);
  }
  if (hallucinationCheck.undefined_product_names.length > 0) {
    recommendations.push("移除报告中未定义的产品名");
  }
  if (hallucinationCheck.undefined_cluster_names.length > 0) {
    recommendations.push("确保报告中的问题名称来自聚类结果");
  }
  if (semanticReview && semanticReview.has_issues) {
    for (const issue of semanticReview.issues) {
      if (issue.severity === "error") {
        recommendations.push(`修复语义问题: ${issue.description}`);
      }
    }
  }
  if (modelFallback) {
    recommendations.push("语义验证模型降级，建议检查 DeepSeek 配置");
  }

  // Calculate score and status
  const partialResult = {
    feedback_count_check: {
      expected_count: input.feedbackItems.length,
      actual_count: input.feedbackItems.length,
      match: true,
    },
    cluster_check: clusterCheck,
    metric_check: metricCheck,
    report_check: reportCheck,
    hallucination_check: hallucinationCheck,
    semantic_review: semanticReview,
    validation_provider: validationProvider,
    validation_model: validationModel,
    model_fallback: modelFallback,
    failed_checks: failedChecks,
    warnings,
    recommendations,
    summary: {
      total_checks: allChecks.length,
      passed_checks: allChecks.filter((c) => c.passed).length,
      failed_checks: failedChecks.length,
      warning_checks: warnings.length,
    },
  };

  const { score, status } = calculateValidationScore(partialResult);

  return {
    ...partialResult,
    score,
    status,
  };
}

/**
 * 保存验证结果到数据库和文件
 */
export async function saveValidationResult(
  input: ValidationResultInput,
  result: ValidationResult
): Promise<{ dbId: string; jsonPath: string | null; mdPath: string | null }> {
  const supabase = await createClient();

  // Delete existing validation for this run
  await supabase
    .from("validation_results")
    .delete()
    .eq("analysis_run_id", input.analysisRunId)
    .eq("owner_id", input.userId);

  // Insert new validation result
  const { data, error } = await supabase
    .from("validation_results")
    .insert({
      project_id: input.projectId,
      analysis_run_id: input.analysisRunId,
      report_id: input.reportId,
      owner_id: input.userId,
      status: result.status,
      score: result.score,
      feedback_count_check: result.feedback_count_check,
      cluster_check: result.cluster_check,
      metric_check: result.metric_check,
      report_check: result.report_check,
      hallucination_check: result.hallucination_check,
      semantic_review: result.semantic_review || null,
      validation_provider: result.validation_provider || null,
      validation_model: result.validation_model || null,
      model_fallback: result.model_fallback || false,
      failed_checks: result.failed_checks,
      warnings: result.warnings,
      recommendations: result.recommendations,
      summary: result.summary,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`保存验证结果失败: ${error.message}`);
  }

  // Save validation report to file system
  const fileResult = saveValidationReport({
    projectId: input.projectId,
    analysisRunId: input.analysisRunId,
    projectName: input.project.name,
    validationResult: result,
  });

  if (fileResult.error) {
    console.error("Failed to save validation report file:", fileResult.error);
    // Don't throw, just log - database save is the primary concern
  }

  return {
    dbId: data.id,
    jsonPath: fileResult.jsonPath,
    mdPath: fileResult.mdPath,
  };
}

/**
 * 获取分析任务的验证结果
 */
export async function getValidationResult(
  runId: string,
  userId: string
): Promise<ValidationResult | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("validation_results")
    .select("*")
    .eq("analysis_run_id", runId)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    status: data.status,
    score: data.score,
    feedback_count_check: data.feedback_count_check,
    cluster_check: data.cluster_check,
    metric_check: data.metric_check,
    report_check: data.report_check,
    hallucination_check: data.hallucination_check,
    semantic_review: data.semantic_review,
    validation_provider: data.validation_provider,
    validation_model: data.validation_model,
    model_fallback: data.model_fallback,
    failed_checks: data.failed_checks,
    warnings: data.warnings,
    recommendations: data.recommendations,
    summary: data.summary,
  };
}
