"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { UploadDropzone } from "@/components/upload-dropzone";
import { FeedbackPreviewTable } from "@/components/feedback-preview-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

interface UploadResult {
  batch_id: string;
  total_count: number;
  preview: { id: string; raw_content: string }[];
}

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "csv" && ext !== "txt") {
        toast.error("请上传 CSV 或 TXT 文件");
        return;
      }

      setSelectedFile(file);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("project_id", projectId);
        formData.append("file", file);

        const response = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "上传失败");
        }

        const data: UploadResult = await response.json();
        setResult(data);
        toast.success(`成功解析 ${data.total_count} 条反馈`);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "上传失败，请重试";
        toast.error(message);
        setSelectedFile(null);
      } finally {
        setUploading(false);
      }
    },
    [projectId]
  );

  return (
    <div className="flex-1 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/projects/${projectId}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; 返回项目详情
          </Link>
          <h1 className="text-2xl font-bold mt-2">上传用户反馈</h1>
          <p className="text-sm text-muted-foreground mt-1">
            上传 CSV 或 TXT 文件，系统将自动解析反馈内容
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>选择文件</CardTitle>
              <CardDescription>
                CSV 文件需包含 content 列（或类似列名如 feedback、message、评论等）。
                TXT 文件每行作为一条反馈。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadDropzone
                onFileSelect={handleFileSelect}
                disabled={uploading}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-4">
                  已选择：{selectedFile.name}
                  {uploading && " (上传中...)"}
                </p>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>解析结果</CardTitle>
                <CardDescription>
                  共解析 {result.total_count} 条反馈
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FeedbackPreviewTable
                  items={result.preview}
                  totalCount={result.total_count}
                />
                <div className="flex gap-4 mt-6">
                  <Link
                    href={`/projects/${projectId}`}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
                  >
                    返回项目详情
                  </Link>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResult(null);
                      setSelectedFile(null);
                    }}
                  >
                    继续上传
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
