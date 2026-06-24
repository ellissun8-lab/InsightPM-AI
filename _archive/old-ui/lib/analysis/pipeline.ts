import { createClient } from "@/lib/supabase/server";
import { classifyFeedbackBatch } from "./classify-feedback";
import { clusterIssues } from "./cluster-issues";
import { scoreOpportunities } from "./score-opportunities";
import { generateReport } from "./generate-report";
import { validateAnalysisResult, saveValidationResult } from "@/lib/validation";
import type { ProjectInfo, ClassifiedFeedback } from "@/lib/ai/types";
import type { ValidationResultInput } from "@/lib/validation/types";

const MAX_ITEMS = 500;

type AnalysisProgress = {
  status: "running" | "completed" | "failed";
  progress: number;
  currentStep: string;
  errorMessage?: string;
};

export async function runAnalysisPipeline(
  runId: string,
  projectId: string,
  batchId: string | null,
  userId: string,
  onProgress?: (progress: AnalysisProgress) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const updateProgress = async (
    status: "running" | "completed" | "failed",
    progress: number,
    currentStep: string,
    errorMessage?: string
  ) => {
    await supabase
      .from("analysis_runs")
      .update({
        status,
        progress,
        current_step: currentStep,
        error_message: errorMessage || null,
        ...(status === "running" ? { started_at: new Date().toISOString() } : {}),
        ...(status === "completed" || status === "failed"
          ? { finished_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", runId)
      .eq("owner_id", userId);

    if (onProgress) {
      await onProgress({ status, progress, currentStep, errorMessage });
    }
  };

  try {
    // Step 1: Load project info
    await updateProgress("running", 5, "正在加载项目信息");

    const { data: project } = await supabase
      .from("projects")
      .select("name, product_type, business_goal, target_user, key_metric")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .single();

    if (!project) {
      throw new Error("项目不存在或无权限");
    }

    const projectInfo: ProjectInfo = {
      name: project.name,
      product_type: project.product_type,
      business_goal: project.business_goal,
      target_user: project.target_user,
      key_metric: project.key_metric,
    };

    // Step 2: Load feedback items
    await updateProgress("running", 10, "正在加载反馈数据");

    let query = supabase
      .from("feedback_items")
      .select("id, raw_content, user_type, source")
      .eq("project_id", projectId)
      .eq("owner_id", userId);

    if (batchId) {
      query = query.eq("batch_id", batchId);
    }

    const { data: feedbackItems } = await query.limit(MAX_ITEMS);

    if (!feedbackItems || feedbackItems.length === 0) {
      throw new Error("没有找到反馈数据");
    }

    // Update total_items
    await supabase
      .from("analysis_runs")
      .update({ total_items: feedbackItems.length })
      .eq("id", runId);

    // Step 3: Classify feedback
    console.log(`[Pipeline] Starting classification of ${feedbackItems.length} items...`);
    await updateProgress("running", 20, "正在分类反馈");

    const classifiedFeedback = await classifyFeedbackBatch(
      projectInfo,
      feedbackItems,
      async (processed, total) => {
        const progress = 20 + Math.round((processed / total) * 40);
        console.log(`[Pipeline] Classification progress: ${processed}/${total} (${progress}%)`);
        await updateProgress(
          "running",
          progress,
          `AI 分类反馈中 (${processed}/${total})`
        );
      }
    );
    console.log(`[Pipeline] Classification complete. ${classifiedFeedback.length} items classified.`);

    // Step 4: Update feedback_items with classification results
    await updateProgress("running", 65, "正在保存分类结果");

    for (const item of classifiedFeedback) {
      await supabase
        .from("feedback_items")
        .update({
          cleaned_content: item.classification.cleaned_content,
          is_valid: item.classification.is_valid,
          invalid_reason: item.classification.invalid_reason,
          feedback_type: item.classification.feedback_type,
          product_module: item.classification.product_module,
          sentiment: item.classification.sentiment,
          sentiment_strength: item.classification.sentiment_strength,
          user_intent: item.classification.user_intent,
          possible_metrics: item.classification.possible_metrics,
          ai_summary: item.classification.ai_summary,
          ai_labels: { labels: item.classification.labels },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("owner_id", userId);
    }

    // Update analyzed_items
    await supabase
      .from("analysis_runs")
      .update({ analyzed_items: classifiedFeedback.length })
      .eq("id", runId);

    // Step 5: Cluster issues
    await updateProgress("running", 70, "正在聚类问题");

    const validFeedback = classifiedFeedback.filter(
      (f) => f.classification.is_valid
    );

    const clusters = await clusterIssues(projectInfo, validFeedback);

    // Step 6: Score opportunities
    await updateProgress("running", 85, "正在计算机会分");

    const scores = await scoreOpportunities(projectInfo, clusters);

    // Step 7: Save clusters to database
    await updateProgress("running", 90, "正在保存分析结果");

    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      const score = scores.find((s) => s.cluster_name === cluster.name);

      await supabase.from("issue_clusters").insert({
        project_id: projectId,
        analysis_run_id: runId,
        owner_id: userId,
        name: cluster.name,
        summary: cluster.summary,
        feedback_count: cluster.feedback_count,
        sentiment_score: score?.sentiment_score,
        frequency_score: score?.frequency_score,
        user_value_score: score?.user_value_score,
        business_value_score: score?.business_value_score,
        strategic_fit_score: score?.strategic_fit_score,
        complexity_score: score?.complexity_score,
        evidence_score: score?.evidence_score,
        opportunity_score: score?.opportunity_score,
        priority: score?.priority,
        recommendation: score?.recommendation,
        suggested_action: score?.suggested_action,
        possible_metrics: cluster.possible_metrics,
        evidence_feedback_ids: cluster.representative_feedback_ids,
        risk_notes: score?.risk_notes,
        missing_evidence: score?.missing_evidence,
      });
    }

    // Step 8: Generate report
    await updateProgress("running", 92, "正在生成报告");

    // Prepare clusters data for report
    const clustersForReport = clusters.map((cluster) => {
      const score = scores.find((s) => s.cluster_name === cluster.name);
      return {
        id: cluster.representative_feedback_ids[0] || "",
        name: cluster.name,
        summary: cluster.summary,
        feedback_count: cluster.feedback_count,
        opportunity_score: score?.opportunity_score || 0,
        priority: score?.priority || "P3",
        sentiment_score: score?.sentiment_score ?? null,
        recommendation: score?.recommendation || null,
        suggested_action: score?.suggested_action || null,
        risk_notes: score?.risk_notes || null,
        missing_evidence: score?.missing_evidence || null,
        evidence_feedback_ids: cluster.representative_feedback_ids,
      };
    });

    // Prepare feedback items for report
    const feedbackItemsForReport = classifiedFeedback.map((f) => ({
      id: f.id,
      raw_content: f.raw_content,
      ai_summary: f.classification.ai_summary,
      sentiment: f.classification.sentiment,
      feedback_type: f.classification.feedback_type,
    }));

    // Prepare feedback map for evidence lookup
    const feedbackMapForReport = new Map<string, { id: string; raw_content: string; ai_summary: string | null; sentiment: string | null; feedback_type: string | null }>();
    for (const f of classifiedFeedback) {
      feedbackMapForReport.set(f.id, {
        id: f.id,
        raw_content: f.raw_content,
        ai_summary: f.classification.ai_summary,
        sentiment: f.classification.sentiment,
        feedback_type: f.classification.feedback_type,
      });
    }

    try {
      const report = await generateReport(
        projectInfo,
        clustersForReport,
        feedbackItemsForReport,
        feedbackMapForReport
      );

      // Save report to database
      const { data: savedReport } = await supabase.from("reports").insert({
        project_id: projectId,
        analysis_run_id: runId,
        owner_id: userId,
        title: report.title,
        summary: report.summary,
        content_markdown: report.content,
        report_json: {
          clusters: clustersForReport,
          total_feedback: classifiedFeedback.length,
        },
      }).select().single();

      // Step 9: Validate analysis result
      const enableAutoValidation = process.env.ENABLE_AUTO_VALIDATION !== "false";
      if (enableAutoValidation && savedReport) {
        try {
          await updateProgress("running", 95, "正在验证报告");

          const validationInput: ValidationResultInput = {
            projectId,
            analysisRunId: runId,
            reportId: savedReport.id,
            userId,
            project: projectInfo,
            report: {
              title: report.title,
              content_markdown: report.content,
            },
            clusters: clusters.map((cluster, i) => {
              const score = scores.find((s) => s.cluster_name === cluster.name);
              return {
                id: cluster.representative_feedback_ids[0] || `cluster-${i}`,
                name: cluster.name,
                summary: cluster.summary,
                feedback_count: cluster.feedback_count,
                opportunity_score: score?.opportunity_score || 0,
                priority: score?.priority || "P3",
                evidence_feedback_ids: cluster.representative_feedback_ids,
              };
            }),
            feedbackItems: classifiedFeedback.map((f) => ({
              id: f.id,
              raw_content: f.raw_content,
            })),
          };

          const validationResult = await validateAnalysisResult(validationInput);
          await saveValidationResult(validationInput, validationResult);

          console.log(`[Pipeline] Validation completed: ${validationResult.status} (score: ${validationResult.score})`);
        } catch (validationError) {
          console.error("[Pipeline] Validation error:", validationError);
          // Don't fail the pipeline if validation fails
        }
      }
    } catch (error) {
      console.error("Report generation error:", error);
      // Don't fail the whole pipeline if report generation fails
    }

    // Step 10: Mark as completed
    await updateProgress("completed", 100, "分析完成");

    // Update batch status
    if (batchId) {
      await supabase
        .from("feedback_batches")
        .update({ status: "analyzed" })
        .eq("id", batchId)
        .eq("owner_id", userId);
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "分析过程中发生未知错误";
    console.error("Analysis pipeline error:", error);

    await updateProgress("failed", 0, "分析失败", errorMessage);

    return { success: false, error: errorMessage };
  }
}
