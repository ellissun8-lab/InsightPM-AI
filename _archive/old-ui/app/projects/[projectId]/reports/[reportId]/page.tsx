import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CopyButton } from "@/components/copy-button";
import { DownloadButton } from "@/components/download-button";
import { ValidationStatus } from "@/components/validation-status";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get report
  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .eq("owner_id", user.id)
    .single();

  if (!report || report.project_id !== projectId) {
    notFound();
  }

  // Get project name
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .single();

  // Get analysis run info
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("created_at, analyzed_items")
    .eq("id", report.analysis_run_id)
    .eq("owner_id", user.id)
    .single();

  // Get validation result
  const { data: validation } = await supabase
    .from("validation_results")
    .select("*")
    .eq("report_id", reportId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/projects/${projectId}/analysis/${report.analysis_run_id}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; 返回分析结果
          </Link>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{report.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {project?.name} ·{" "}
              {run
                ? new Date(run.created_at).toLocaleString("zh-CN")
                : new Date(report.created_at).toLocaleString("zh-CN")}
              {run && ` · ${run.analyzed_items} 条反馈`}
            </p>
          </div>
          <div className="flex gap-2">
            <CopyButton content={report.content_markdown} />
            <DownloadButton
              reportId={reportId}
              filename={report.title || "report"}
            />
          </div>
        </div>

        {/* Validation Status */}
        {validation && (
          <div className="mb-6">
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

        {report.summary && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>摘要</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{report.summary}</p>
            </CardContent>
          </Card>
        )}

        <Separator className="my-6" />

        <Card>
          <CardContent className="pt-6">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(report.content_markdown),
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Simple markdown to HTML converter
function markdownToHtml(markdown: string): string {
  return markdown
    // Headers
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Lists
    .replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>")
    // Numbered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>")
    // Paragraphs
    .replace(/\n\n/g, "</p><p>")
    // Line breaks
    .replace(/\n/g, "<br/>")
    // Wrap in paragraph
    .replace(/^([\s\S]+)$/, "<p>$1</p>")
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, "")
    .replace(/<p>(<h[1-3]>)/g, "$1")
    .replace(/(<\/h[1-3]>)<\/p>/g, "$1")
    .replace(/<p>(<ul>)/g, "$1")
    .replace(/(<\/ul>)<\/p>/g, "$1");
}
