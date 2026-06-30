import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "30d";
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));

    const supabase = createAdminClient();

    // Time filter
    let since: string | null = null;
    if (range !== "all") {
      const now = new Date();
      let sinceDate: Date;
      switch (range) {
        case "7d":
          sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
        default:
          sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      since = sinceDate.toISOString();
    }

    // Build query
    let query = supabase
      .from("runs")
      .select("case_name, status, hard_score, semantic_score, feedback_count, created_at, updated_at, completed_at, failed_at, retry_count, max_retry, metadata");

    if (since) {
      query = query.gte("created_at", since);
    }

    query = query.order("created_at", { ascending: false }).limit(500);

    const { data: runs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allRuns = runs || [];

    // Status counts
    const statusCounts = { pending: 0, running: 0, completed: 0, failed: 0 };
    for (const r of allRuns) {
      const s = r.status;
      if (s in statusCounts) statusCounts[s as keyof typeof statusCounts]++;
    }

    const completedCount = statusCounts.completed;
    const failedCount = statusCounts.failed;
    const successRate = completedCount + failedCount > 0
      ? Math.round((completedCount / (completedCount + failedCount)) * 100) / 100
      : null;

    // Scores
    const runsWithHard = allRuns.filter((r) => r.hard_score != null);
    const runsWithSemantic = allRuns.filter((r) => r.semantic_score != null);
    const averageHardScore = runsWithHard.length > 0
      ? Math.round(runsWithHard.reduce((sum, r) => sum + r.hard_score, 0) / runsWithHard.length)
      : null;
    const averageSemanticScore = runsWithSemantic.length > 0
      ? Math.round(runsWithSemantic.reduce((sum, r) => sum + r.semantic_score, 0) / runsWithSemantic.length)
      : null;

    // Duration
    const completedWithMetrics = allRuns.filter(
      (r) => r.status === "completed" && r.metadata?.metrics?.durationSeconds
    );
    const averageDurationSeconds = completedWithMetrics.length > 0
      ? Math.round(completedWithMetrics.reduce((sum, r) => sum + r.metadata.metrics.durationSeconds, 0) / completedWithMetrics.length)
      : null;

    // Feedback count
    const runsWithFeedback = allRuns.filter((r) => r.feedback_count > 0);
    const averageFeedbackCount = runsWithFeedback.length > 0
      ? Math.round(runsWithFeedback.reduce((sum, r) => sum + r.feedback_count, 0) / runsWithFeedback.length)
      : null;

    // Failure categories
    const categoryMap = new Map<string, number>();
    const failedRuns = allRuns.filter((r) => r.status === "failed");
    for (const r of failedRuns) {
      const cat = r.metadata?.error?.category || r.metadata?.last_error?.category || "unknown";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    }
    const failureCategories = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: failedCount > 0 ? Math.round((count / failedCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Slow steps
    const stepMap = new Map<string, { count: number; totalMs: number }>();
    for (const r of allRuns) {
      const steps = r.metadata?.metrics?.stepDurations || [];
      for (const s of steps) {
        if (s.slowStep || (s.durationMs && s.durationMs > 60000)) {
          const existing = stepMap.get(s.step) || { count: 0, totalMs: 0 };
          existing.count++;
          existing.totalMs += s.durationMs || 0;
          stepMap.set(s.step, existing);
        }
      }
    }
    const slowSteps = Array.from(stepMap.entries())
      .map(([step, data]) => ({
        step,
        count: data.count,
        averageDurationMs: Math.round(data.totalMs / data.count),
      }))
      .sort((a, b) => b.count - a.count);

    // Recent completed
    const recentCompleted = allRuns
      .filter((r) => r.status === "completed")
      .slice(0, limit)
      .map((r) => ({
        caseName: r.case_name,
        hardScore: r.hard_score,
        semanticScore: r.semantic_score,
        durationSeconds: r.metadata?.metrics?.durationSeconds ?? null,
        completedAt: r.completed_at,
      }));

    // Recent failed
    const recentFailed = allRuns
      .filter((r) => r.status === "failed")
      .slice(0, limit)
      .map((r) => ({
        caseName: r.case_name,
        category: r.metadata?.error?.category || r.metadata?.last_error?.category || "unknown",
        retryable: r.metadata?.error?.retryable ?? false,
        message: (r.metadata?.error?.message || "").slice(0, 200),
        failedAt: r.failed_at,
      }));

    // Score trend (group by date)
    const trendMap = new Map<string, { hardScores: number[]; semanticScores: number[]; completed: number; failed: number }>();
    for (const r of allRuns) {
      const date = (r.completed_at || r.failed_at || r.created_at || "").slice(0, 10);
      if (!date) continue;
      if (!trendMap.has(date)) {
        trendMap.set(date, { hardScores: [], semanticScores: [], completed: 0, failed: 0 });
      }
      const entry = trendMap.get(date)!;
      if (r.status === "completed") {
        entry.completed++;
        if (r.hard_score != null) entry.hardScores.push(r.hard_score);
        if (r.semantic_score != null) entry.semanticScores.push(r.semantic_score);
      } else if (r.status === "failed") {
        entry.failed++;
      }
    }
    const scoreTrend = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        averageHardScore: data.hardScores.length > 0
          ? Math.round(data.hardScores.reduce((a, b) => a + b, 0) / data.hardScores.length)
          : null,
        averageSemanticScore: data.semanticScores.length > 0
          ? Math.round(data.semanticScores.reduce((a, b) => a + b, 0) / data.semanticScores.length)
          : null,
        completedCount: data.completed,
        failedCount: data.failed,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      range,
      totalRuns: allRuns.length,
      statusCounts,
      successRate,
      averageHardScore,
      averageSemanticScore,
      averageDurationSeconds,
      averageFeedbackCount,
      failureCategories,
      slowSteps,
      recentCompleted,
      recentFailed,
      scoreTrend,
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err: any) {
    console.error("/api/quality/summary error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
