import * as fs from "fs";
import * as path from "path";
import { supabase } from "./supabase.js";

export interface ArtifactInfo {
  type: string;
  fileName: string;
  contentType: string;
  localPath: string;
  content: string;
  sizeBytes: number;
  metadata: Record<string, any>;
}

/**
 * 从 outputDir 发现真实产物
 */
export function discoverArtifacts(
  outputDir: string,
  caseName: string
): ArtifactInfo[] {
  const artifacts: ArtifactInfo[] = [];

  console.log(`[Artifacts] Discovering artifacts in: ${outputDir}`);

  // 1. run-summary.json
  const summaryPath = path.join(outputDir, "run-summary.json");
  if (fs.existsSync(summaryPath)) {
    console.log(`[Artifacts] Found run-summary.json`);
    const content = fs.readFileSync(summaryPath, "utf-8");
    artifacts.push({
      type: "summary-json",
      fileName: "run-summary.json",
      contentType: "application/json",
      localPath: summaryPath,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      metadata: {
        summary: JSON.parse(content),
        generatedBy: "cloud-worker",
        source: "real-pipeline",
      },
    });
  }

  // 2. Markdown 报告
  const mdPatterns = [
    "**/*.overall.analysis.md",
    "**/*.analysis.md",
    "**/*.report.md",
    "**/analysis.md",
  ];
  const mdFile = findFileByPatterns(outputDir, mdPatterns);
  if (mdFile) {
    console.log(`[Artifacts] Found markdown report: ${mdFile}`);
    const content = fs.readFileSync(mdFile, "utf-8");
    artifacts.push({
      type: "overall-md",
      fileName: `${caseName}.analysis.md`,
      contentType: "text/markdown",
      localPath: mdFile,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      metadata: {
        title: `${caseName} 分析报告`,
        markdown: content,
        generatedBy: "cloud-worker",
        source: "real-pipeline",
        outputDir,
        originalFileName: path.basename(mdFile),
      },
    });
  }

  // 3. validation JSON
  const valPatterns = [
    "**/validation*.json",
    "**/*validation*.json",
    "**/hard-validation.json",
    "**/semantic-validation.json",
  ];
  const valFile = findFileByPatterns(outputDir, valPatterns);
  if (valFile) {
    console.log(`[Artifacts] Found validation JSON: ${valFile}`);
    const content = fs.readFileSync(valFile, "utf-8");
    artifacts.push({
      type: "validation-json",
      fileName: path.basename(valFile),
      contentType: "application/json",
      localPath: valFile,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      metadata: {
        validation: JSON.parse(content),
        generatedBy: "cloud-worker",
        source: "real-pipeline",
      },
    });
  }

  // 4. segment JSON
  const segPatterns = [
    "**/segment*.json",
    "**/*segment*.json",
    "**/*.segments.json",
  ];
  const segFile = findFileByPatterns(outputDir, segPatterns);
  if (segFile) {
    console.log(`[Artifacts] Found segment JSON: ${segFile}`);
    const content = fs.readFileSync(segFile, "utf-8");
    artifacts.push({
      type: "segment-json",
      fileName: path.basename(segFile),
      contentType: "application/json",
      localPath: segFile,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      metadata: {
        segments: JSON.parse(content),
        generatedBy: "cloud-worker",
        source: "real-pipeline",
      },
    });
  }

  // 5. evidence JSON
  const evPatterns = [
    "**/evidence*.json",
    "**/*evidence*.json",
  ];
  const evFile = findFileByPatterns(outputDir, evPatterns);
  if (evFile) {
    console.log(`[Artifacts] Found evidence JSON: ${evFile}`);
    const content = fs.readFileSync(evFile, "utf-8");
    artifacts.push({
      type: "evidence-json",
      fileName: path.basename(evFile),
      contentType: "application/json",
      localPath: evFile,
      content,
      sizeBytes: Buffer.byteLength(content, "utf-8"),
      metadata: {
        evidence: JSON.parse(content),
        generatedBy: "cloud-worker",
        source: "real-pipeline",
      },
    });
  }

  console.log(`[Artifacts] Discovered ${artifacts.length} artifacts`);
  return artifacts;
}

/**
 * 上传产物到 Supabase Storage 并写入 report_artifacts 表
 */
export async function uploadAndRecordArtifacts(
  runId: string,
  caseName: string,
  artifacts: ArtifactInfo[]
): Promise<{ success: boolean; error?: string; artifactTypes: string[] }> {
  const bucket = "report-artifacts";
  const artifactTypes: string[] = [];

  console.log(`[Artifacts] Uploading ${artifacts.length} artifacts to bucket: ${bucket}`);

  // 检查 bucket 是否存在
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error(`[Artifacts] Failed to list buckets:`, bucketError);
    return { success: false, error: `Failed to list buckets: ${bucketError.message}`, artifactTypes };
  }

  const bucketExists = buckets?.some((b) => b.name === bucket);
  if (!bucketExists) {
    console.error(`[Artifacts] Bucket "${bucket}" does not exist`);
    return { success: false, error: `Storage bucket "${bucket}" does not exist`, artifactTypes };
  }

  // 删除旧的 artifacts
  const { error: deleteError } = await supabase
    .from("report_artifacts")
    .delete()
    .eq("run_id", runId)
    .in("artifact_type", artifacts.map((a) => a.type));

  if (deleteError) {
    console.error(`[Artifacts] failed to delete old artifacts:`, deleteError);
  }

  // 上传并记录每个 artifact
  for (const artifact of artifacts) {
    const storagePath = `${runId}/${artifact.fileName}`;

    console.log(`[Artifacts] Uploading ${bucket}/${storagePath}`);

    // 上传到 Storage
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, artifact.content, {
        contentType: artifact.contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error(`[Artifacts] failed to upload ${storagePath}:`, uploadError);
      // 非核心 artifact 失败不中断
      if (artifact.type === "summary-json" || artifact.type === "overall-md") {
        return { success: false, error: `Failed to upload ${artifact.type}: ${uploadError.message}`, artifactTypes };
      }
      continue;
    }

    // 写入 report_artifacts 表
    const { error: insertError } = await supabase
      .from("report_artifacts")
      .insert({
        run_id: runId,
        artifact_type: artifact.type,
        file_name: artifact.fileName,
        storage_bucket: bucket,
        storage_path: storagePath,
        content_type: artifact.contentType,
        size_bytes: artifact.sizeBytes,
        metadata: artifact.metadata,
      });

    if (insertError) {
      console.error(`[Artifacts] failed to insert artifact record:`, insertError);
      if (artifact.type === "summary-json" || artifact.type === "overall-md") {
        return { success: false, error: `Failed to insert ${artifact.type}: ${insertError.message}`, artifactTypes };
      }
      continue;
    }

    artifactTypes.push(artifact.type);
    console.log(`[Artifacts] Inserted report_artifacts ${artifact.type}`);
  }

  console.log(`[Artifacts] artifacts-written-ok`);
  return { success: true, artifactTypes };
}

/**
 * 根据模式查找文件
 */
function findFileByPatterns(dir: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    const files = findFiles(dir, pattern);
    if (files.length > 0) {
      return files[0];
    }
  }
  return null;
}

/**
 * 简单的 glob 匹配查找
 */
function findFiles(dir: string, pattern: string): string[] {
  const results: string[] = [];
  const regex = globToRegex(pattern);

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        // 将 Windows 反斜杠转换为正斜杠进行匹配
        const relativePath = path.relative(dir, fullPath).replace(/\\/g, "/");
        if (regex.test(relativePath)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * 简单的 glob 转 regex
 */
function globToRegex(glob: string): RegExp {
  const regexStr = glob
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "___DOUBLE_STAR___")
    .replace(/\*/g, "[^/]*")
    .replace(/___DOUBLE_STAR___/g, ".*");
  return new RegExp(`^${regexStr}$`);
}
