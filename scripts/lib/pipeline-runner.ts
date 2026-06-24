/**
 * 验证脚本专用的 Pipeline Runner
 * 独立于 Next.js 运行，直接调用 AI 分析逻辑
 */

import { createValidationClient } from "./supabase";
import { classifyFeedbackBatch } from "../../lib/analysis/classify-feedback";
import { clusterIssues } from "../../lib/analysis/cluster-issues";
import { scoreOpportunities } from "../../lib/analysis/score-opportunities";
import { generateReport } from "../../lib/analysis/generate-report";
import type { ProjectInfo, ClassifiedFeedback } from "../../lib/ai/types";

const MAX_ITEMS = 500;

interface PipelineResult {
  success: boolean;
  error?: string;
  clusters?: any[];
  report?: any;
}

/**
 * 运行完整的分析 pipeline
 */
export async function runPipeline(
  runId: string,
  projectId: string,
  batchId: string | null,
  userId: string,
  onProgress?: (step: string, progress: number) => void
): Promise<PipelineResult> {
  const supabase = createValidationClient();

  try {
    // Step 1: Load project info
    onProgress?.("加载项目信息", 5);

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, product_type, business_goal, target_user, key_metric")
      .eq("id", projectId)
      .eq("owner_id", userId)
      .single();

    if (projectError || !project) {
      return { success: false, error: "项目不存在或无权限" };
    }

    const projectInfo: ProjectInfo = {
      name: project.name,
      product_type: project.product_type,
      business_goal: project.business_goal,
      target_user: project.target_user,
      key_metric: project.key_metric,
    };

    // Step 2: Load feedback items
    onProgress?.("加载反馈数据", 10);

    let query = supabase
      .from("feedback_items")
      .select("id, raw_content, user_type, source")
      .eq("project_id", projectId)
      .eq("owner_id", userId);

    if (batchId) {
      query = query.eq("batch_id", batchId);
    }

    const { data: feedbackItems, error: feedbackError } = await query.limit(MAX_ITEMS);

    if (feedbackError || !feedbackItems || feedbackItems.length === 0) {
      return { success: false, error: "没有找到反馈数据" };
    }

    // Update total_items
    await supabase
      .from("analysis_runs")
      .update({ total_items: feedbackItems.length })
      .eq("id", runId);

    // Step 3: Classify feedback
    onProgress?.("AI 分类反馈中", 20);

    const classifiedFeedback = await classifyFeedbackBatch(
      projectInfo,
      feedbackItems,
      async (processed, total) => {
        const progress = 20 + Math.round((processed / total) * 40);
        onProgress?.(`AI 分类反馈中 (${processed}/${total})`, progress);
      }
    );

    // Step 4: Update feedback_items with classification results
    onProgress?.("保存分类结果", 65);

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
    onProgress?.("AI 聚类问题中", 70);

    const validFeedback = classifiedFeedback.filter(
      (f) => f.classification.is_valid
    );

    const clusters = await clusterIssues(projectInfo, validFeedback);

    // Step 6: Score opportunities
    onProgress?.("AI 评分机会中", 85);

    const scores = await scoreOpportunities(projectInfo, clusters);

    // Step 7: Save clusters to database
    onProgress?.("保存分析结果", 90);

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
    onProgress?.("生成分析报告", 92);

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
    const feedbackMapForReport = new Map<
      string,
      {
        id: string;
        raw_content: string;
        ai_summary: string | null;
        sentiment: string | null;
        feedback_type: string | null;
      }
    >();
    for (const f of classifiedFeedback) {
      feedbackMapForReport.set(f.id, {
        id: f.id,
        raw_content: f.raw_content,
        ai_summary: f.classification.ai_summary,
        sentiment: f.classification.sentiment,
        feedback_type: f.classification.feedback_type,
      });
    }

    const report = await generateReport(
      projectInfo,
      clustersForReport,
      feedbackItemsForReport,
      feedbackMapForReport
    );

    // Save report to database
    await supabase.from("reports").insert({
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
    });

    // Step 9: Mark as completed
    onProgress?.("分析完成", 100);

    await supabase
      .from("analysis_runs")
      .update({
        status: "completed",
        progress: 100,
        current_step: "分析完成",
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

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
    console.error("Pipeline error:", error);

    await supabase
      .from("analysis_runs")
      .update({
        status: "failed",
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return { success: false, error: errorMessage };
  }
}
