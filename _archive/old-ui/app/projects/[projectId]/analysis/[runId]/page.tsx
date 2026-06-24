import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { IssueClusterDetail } from "@/components/issue-cluster-detail";
import { ValidationStatus } from "@/components/validation-status";

export default async function AnalysisResultPage({
  params,
}: {
  params: Promise<{ projectId: string; runId: string }>;
}) {
  const { projectId, runId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get analysis run
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("id", runId)
    .eq("owner_id", user.id)
    .single();

  if (!run || run.project_id !== projectId) {
    notFound();
  }

  // Get project
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .single();

  // Get clusters
  const { data: clusters } = await supabase
    .from("issue_clusters")
    .select("*")
    .eq("analysis_run_id", runId)
    .eq("owner_id", user.id)
    .order("opportunity_score", { ascending: false });

  // Get report
  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("analysis_run_id", runId)
    .eq("owner_id", user.id)
    .single();

  // Get validation result
  const { data: validation } = await supabase
    .from("validation_results")
    .select("*")
    .eq("analysis_run_id", runId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const p0Count = clusters?.filter((c) => c.priority === "P0").length || 0;
  const p1Count = clusters?.filter((c) => c.priority === "P1").length || 0;

  return (
    <div className="flex-1 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; 返回项目详情
          </Link>
          <h1 className="text-2xl font-bold mt-2">
            {project?.name} - 分析结果
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(run.created_at).toLocaleString("zh-CN")}
          </p>
        </div>

        {/* Validation Status */}
        {run.status === "completed" && validation && (
          <div className="mb-8">
            <ValidationStatus
              status={validation.status}
              score={validation.score || 0}
              summary={validation.summary}
              failedChecks={validation.failed_checks}
              warnings={validation.warnings}
              recommendations={validation.recommendations}
            />
          </div>
        )}

        {/* Status */}
        {run.status === "running" && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">分析进行中</span>
                  <span className="text-sm text-muted-foreground">
                    {run.progress}%
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${run.progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {run.current_step}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {run.status === "failed" && (
          <Card className="mb-8 border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive font-medium">分析失败</p>
              <p className="text-sm text-muted-foreground mt-1">
                {run.error_message || "发生未知错误"}
              </p>
            </CardContent>
          </Card>
        )}

        {run.status === "pending" && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                分析任务待处理。请稍后刷新页面查看结果。
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        {run.status === "completed" && clusters && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>分析反馈数</CardDescription>
                  <CardTitle className="text-3xl">
                    {run.analyzed_items}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>问题簇数量</CardDescription>
                  <CardTitle className="text-3xl">
                    {clusters.length}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>P0 问题</CardDescription>
                  <CardTitle className="text-3xl text-destructive">
                    {p0Count}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>P1 问题</CardDescription>
                  <CardTitle className="text-3xl">{p1Count}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Separator className="my-8" />

            {/* Issue Clusters Table */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">问题簇列表</h2>
                {report && (
                  <Link
                    href={`/projects/${projectId}/reports/${report.id}`}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                  >
                    查看报告
                  </Link>
                )}
              </div>

              {clusters.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">优先级</TableHead>
                      <TableHead>问题名称</TableHead>
                      <TableHead className="w-20">反馈数</TableHead>
                      <TableHead className="w-24">机会分</TableHead>
                      <TableHead className="w-20">置信度</TableHead>
                      <TableHead>建议动作</TableHead>
                      <TableHead className="w-24">详情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clusters.map((cluster) => {
                      const confidenceLevel = cluster.feedback_count >= 10 && (cluster.evidence_feedback_ids?.length || 0) >= 3
                        ? "high"
                        : cluster.feedback_count >= 5 && (cluster.evidence_feedback_ids?.length || 0) >= 2
                        ? "medium"
                        : "low";
                      const confidenceLabel = confidenceLevel === "high" ? "高" : confidenceLevel === "medium" ? "中" : "低";
                      return (
                      <TableRow key={cluster.id}>
                        <TableCell>
                          <Badge
                            variant={
                              cluster.priority === "P0"
                                ? "destructive"
                                : cluster.priority === "P1"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {cluster.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {cluster.name}
                        </TableCell>
                        <TableCell>{cluster.feedback_count}</TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {cluster.opportunity_score}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              confidenceLevel === "high"
                                ? "text-green-600 border-green-600"
                                : confidenceLevel === "medium"
                                ? "text-yellow-600 border-yellow-600"
                                : "text-red-600 border-red-600"
                            }
                          >
                            {confidenceLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {cluster.suggested_action === "fix_now"
                              ? "立即修复"
                              : cluster.suggested_action === "improve_experience"
                              ? "改善体验"
                              : cluster.suggested_action === "add_to_backlog"
                              ? "加入待办"
                              : cluster.suggested_action ===
                                "validate_with_interviews"
                              ? "用户访谈验证"
                              : cluster.suggested_action === "validate_with_data"
                              ? "数据验证"
                              : cluster.suggested_action === "ignore_for_now"
                              ? "暂时忽略"
                              : cluster.suggested_action === "build_mvp"
                              ? "构建 MVP"
                              : cluster.suggested_action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <IssueClusterDetail cluster={cluster} />
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  未生成问题簇。
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
