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
import { Separator } from "@/components/ui/separator";
import { StartAnalysisButton } from "@/components/start-analysis-button";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .single();

  if (!project) {
    notFound();
  }

  // Get feedback count
  const { count: feedbackCount } = await supabase
    .from("feedback_items")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("owner_id", user.id);

  // Get latest batch
  const { data: latestBatch } = await supabase
    .from("feedback_batches")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Get analysis runs
  const { data: analysisRuns } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.product_type && (
              <p className="text-sm text-muted-foreground mt-1">
                {project.product_type}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Link
              href={`/projects/${projectId}/upload`}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              上传反馈
            </Link>
            <StartAnalysisButton
              projectId={projectId}
              batchId={latestBatch?.id || null}
              disabled={!feedbackCount || feedbackCount === 0}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>反馈总数</CardDescription>
              <CardTitle className="text-3xl">
                {feedbackCount ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>业务目标</CardDescription>
              <CardTitle className="text-lg">
                {project.business_goal || "未设置"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>目标用户</CardDescription>
              <CardTitle className="text-lg">
                {project.target_user || "未设置"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>关键指标</CardDescription>
              <CardTitle className="text-lg">
                {project.key_metric || "未设置"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {project.description && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>产品描述</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{project.description}</p>
            </CardContent>
          </Card>
        )}

        <Separator className="my-8" />

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">上传记录</h2>
          {latestBatch ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {latestBatch.filename || "未命名文件"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {latestBatch.total_count} 条反馈 ·{" "}
                      {new Date(latestBatch.created_at).toLocaleDateString(
                        "zh-CN"
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={
                      latestBatch.status === "analyzed"
                        ? "default"
                        : latestBatch.status === "parsed"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {latestBatch.status === "analyzed"
                      ? "已分析"
                      : latestBatch.status === "parsed"
                      ? "已解析"
                      : latestBatch.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              暂无上传记录。上传用户反馈开始分析。
            </p>
          )}
        </div>

        <Separator className="my-8" />

        <div>
          <h2 className="text-lg font-semibold mb-4">分析历史</h2>
          {analysisRuns && analysisRuns.length > 0 ? (
            <div className="space-y-3">
              {analysisRuns.map((run) => (
                <Link
                  key={run.id}
                  href={`/projects/${projectId}/analysis/${run.id}`}
                >
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            分析任务
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(run.created_at).toLocaleString("zh-CN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {run.status === "completed" && (
                            <span className="text-sm text-muted-foreground">
                              {run.analyzed_items} 条反馈
                            </span>
                          )}
                          <Badge
                            variant={
                              run.status === "completed"
                                ? "default"
                                : run.status === "running"
                                ? "secondary"
                                : run.status === "failed"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {run.status === "completed"
                              ? "已完成"
                              : run.status === "running"
                              ? "分析中"
                              : run.status === "failed"
                              ? "失败"
                              : "待处理"}
                          </Badge>
                        </div>
                      </div>
                      {run.status === "running" && (
                        <div className="mt-3">
                          <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${run.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {run.current_step} ({run.progress}%)
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              暂无分析记录。点击"开始分析"启动 AI 分析。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
