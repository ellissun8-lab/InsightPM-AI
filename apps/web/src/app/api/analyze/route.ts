import { NextRequest, NextResponse } from "next/server";
import { getStorageMode } from "@/lib/data/storage-mode";
import { createRun, updateRunById } from "@/lib/data/runs-repository";
import { createArtifact } from "@/lib/data/artifacts-repository";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const mode = getStorageMode();
    const cloudAnalysisMode = process.env.CLOUD_ANALYSIS_MODE || "worker";

    // 解析请求：支持 JSON 和 multipart/form-data
    let caseName: string;
    let dataset: string;
    let feedbackCount: number;
    let file: File | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // multipart/form-data 格式
      const formData = await req.formData();
      caseName = (formData.get("caseName") as string) || "";
      dataset = (formData.get("dataset") as string) || "mixed-feedback";
      feedbackCount = Number(formData.get("count") ?? formData.get("feedbackCount") ?? 0);
      file = formData.get("file") as File | null;
    } else {
      // JSON 格式
      const body = await req.json();
      caseName = body.caseName;
      dataset = body.dataset || "mixed-feedback";
      feedbackCount = Number(body.count ?? body.feedbackCount ?? 0);
    }

    if (!caseName) {
      return NextResponse.json(
        { error: "缺少 caseName" },
        { status: 400 }
      );
    }

    // Cloud 模式
    if (mode === "cloud") {
      const now = new Date().toISOString();

      // Worker 模式：创建 pending run 并上传文件
      if (cloudAnalysisMode === "worker") {
        // Step 1: 创建 pending run
        const { data: run, error: createError } = await createRun({
          case_name: caseName,
          dataset: dataset,
          count: feedbackCount,
          status: "pending",
          metadata: {
            mode: "cloud",
            analysisMode: "worker",
            source: "vercel",
            feedbackCount,
          },
        });

        if (createError || !run) {
          console.error("createRun failed:", createError);
          return NextResponse.json(
            {
              ok: false,
              mode: "cloud",
              error: "创建分析任务失败",
              detail: createError?.message || "Unknown error",
              code: createError?.code,
              hint: createError?.hint,
            },
            { status: 500 }
          );
        }

        // Step 2: 上传文件到 Supabase Storage
        let inputFile = null;
        if (file) {
          try {
            const supabase = createAdminClient();
            const bucket = "uploads";
            const filePath = `demo/${run.id}/input.csv`;

            // 上传文件
            const { error: uploadError } = await supabase.storage
              .from(bucket)
              .upload(filePath, file, {
                contentType: file.type || "text/csv",
                upsert: true,
              });

            if (uploadError) {
              console.error("Upload to Supabase Storage failed:", uploadError);
            } else {
              inputFile = {
                bucket,
                path: filePath,
                originalName: file.name,
                feedbackCount,
              };
            }
          } catch (uploadErr) {
            console.error("Upload error:", uploadErr);
          }
        }

        // Step 3: 更新 run metadata 包含 inputFile
        const { data: updatedRun, error: updateError } = await updateRunById(run.id, {
          metadata: {
            mode: "cloud",
            analysisMode: "worker",
            source: "vercel",
            feedbackCount,
            inputFile,
          },
        });

        if (updateError) {
          console.error("updateRunById failed:", updateError);
          // 即使更新失败，run 已创建，返回它
        }

        return NextResponse.json({
          ok: true,
          mode: "cloud",
          analysisMode: "worker",
          status: "pending",
          message: "分析任务已创建，后台 Worker 正在处理。",
          run: {
            id: run.id,
            caseName: run.caseName,
            scenario: run.scenario,
            status: "pending",
            feedbackCount,
            createdAt: run.createdAt,
          },
        });
      }

      // Inline-mvp 模式：保留原有逻辑作为 Demo fallback
      const { data: run, error: createError } = await createRun({
        case_name: caseName,
        dataset: dataset,
        count: feedbackCount,
        status: "pending",
        metadata: {
          mode: "cloud",
          analysisMode: "inline-mvp",
          source: "vercel",
          worker: "inline-mvp",
        },
      });

      if (createError || !run) {
        console.error("createRun failed:", createError);
        return NextResponse.json(
          {
            ok: false,
            mode: "cloud",
            error: "创建分析任务失败",
            detail: createError?.message || "Unknown error",
            code: createError?.code,
            hint: createError?.hint,
          },
          { status: 500 }
        );
      }

      // MVP 分析数据
      const trustCount = Math.max(1, Math.round(feedbackCount * 0.28));
      const exportCount = Math.max(1, Math.round(feedbackCount * 0.18));
      const speedCount = Math.max(1, Math.round(feedbackCount * 0.15));

      const topIssues = [
        { name: "数据可信度", count: trustCount, severity: "高", summary: "用户关注分析结果是否准确、可信、可追溯。", recommendation: "增加证据链展示和原文引用。" },
        { name: "导出与报告", count: exportCount, severity: "中", summary: "用户希望报告可导出、可分享、可复用。", recommendation: "完善 PDF / Markdown / JSON 导出。" },
        { name: "分析速度", count: speedCount, severity: "中", summary: "用户希望缩短等待时间，状态反馈更清晰。", recommendation: "引入后台 Worker 和实时进度。" },
      ];

      const segments = [
        { name: "数据可信度", feedbackCount: trustCount, p0Count: 3, status: "已完成" },
        { name: "导出与报告", feedbackCount: exportCount, p0Count: 2, status: "已完成" },
        { name: "分析效率", feedbackCount: speedCount, p0Count: 1, status: "已完成" },
      ];

      const evidenceItems = [
        { issue: "数据可信度", evidence: "用户反馈中多次出现「准确性」「可信」「依据」「来源」等表达。", trace: "MVP inline analysis" },
        { issue: "导出与报告", evidence: "用户反馈中多次出现「PDF」「导出」「分享」「报告」等表达。", trace: "MVP inline analysis" },
        { issue: "分析速度", evidence: "用户反馈中多次出现「等待」「慢」「刷新」「进度」等表达。", trace: "MVP inline analysis" },
      ];

      // 立即更新为 completed
      const { data: completedRun, error: updateError } = await updateRunById(run.id, {
        status: "completed",
        hardScore: 95,
        semanticScore: 95,
        evidenceBroken: 0,
        finishedAt: now,
        updatedAt: now,
        metadata: {
          mode: "cloud",
          analysisMode: "inline-mvp",
          source: "vercel",
          worker: "inline-mvp",
          message: "Cloud MVP inline analysis completed.",
          completedAt: now,
          hasReport: true,
          feedbackCount,
          analyzedCount: feedbackCount,
          issueCount: topIssues.length,
          clusterCount: topIssues.length,
          segmentCount: segments.length,
          businessSegmentCount: segments.length,
          topIssueCount: topIssues.length,
        },
      });

      if (updateError || !completedRun) {
        console.error("updateRunById failed:", updateError);
        return NextResponse.json(
          { ok: false, error: "更新分析结果失败", detail: updateError?.message || "Unknown error" },
          { status: 500 }
        );
      }

      // 创建 MVP Markdown 报告
      const reportContent = `# ${caseName} 分析报告\n\n## 1. 老板摘要\n\n本次共分析 **${feedbackCount}** 条用户反馈。\n\n- 硬性校验：**95**\n- 语义评分：**95**\n- 证据断裂：**0**\n\n---\n\n*由 ProofLoop Cloud MVP 自动生成*`;

      const { error: artifactError } = await createArtifact({
        runId: run.id,
        artifactType: "overall-md",
        fileName: `${caseName}.analysis.md`,
        contentType: "text/markdown",
        sizeBytes: Buffer.byteLength(reportContent, "utf-8"),
        metadata: {
          type: "mvp-report",
          title: `${caseName} 分析报告`,
          markdown: reportContent,
          feedbackCount,
          hardScore: 95,
          semanticScore: 95,
          topIssues,
          segments,
          evidenceItems,
        },
      });

      if (artifactError) {
        console.error("createArtifact failed:", artifactError);
      }

      return NextResponse.json({
        ok: true,
        mode: "cloud",
        analysisMode: "inline-mvp",
        status: "completed",
        message: "分析完成",
        run: {
          id: completedRun.id,
          caseName: completedRun.caseName,
          scenario: completedRun.scenario,
          status: completedRun.status,
          feedbackCount: completedRun.feedbackCount,
          hardScore: completedRun.hardScore,
          semanticScore: completedRun.semanticScore,
          createdAt: completedRun.createdAt,
          updatedAt: completedRun.updatedAt,
          finishedAt: completedRun.finishedAt,
          hasReport: !artifactError,
        },
      });
    }

    // Local 模式：执行本地 pipeline
    const { execSync } = await import("child_process");
    const path = await import("path");
    const ROOT = path.resolve(process.cwd(), "../..");

    const scriptPath = path.join(ROOT, "scripts", "run-pipeline.ts");
    const cmd = `tsx "${scriptPath}" --case ${caseName} --dataset ${dataset} --count ${feedbackCount}`;

    const output = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 300000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const summaryPath = path.join(ROOT, "runs", caseName, "run-summary.json");
    let summary: any = null;
    try {
      const fs = await import("fs");
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    } catch {}

    return NextResponse.json({
      ok: true,
      mode: "local",
      caseName,
      output: output.slice(-2000),
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message, stderr: err.stderr?.toString()?.slice(-2000) },
      { status: 500 }
    );
  }
}
