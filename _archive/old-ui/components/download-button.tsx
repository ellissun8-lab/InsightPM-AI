"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DownloadButtonProps {
  reportId: string;
  filename: string;
}

export function DownloadButton({ reportId, filename }: DownloadButtonProps) {
  const handleDownload = () => {
    const url = `/api/reports/${reportId}/markdown`;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="h-4 w-4 mr-2" />
      下载 Markdown
    </Button>
  );
}
