"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({
  onFileSelect,
  disabled,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [disabled, onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => {
        if (!disabled) document.getElementById("file-input")?.click();
      }}
    >
      <input
        id="file-input"
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />
      <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
      <p className="text-sm font-medium">
        拖拽文件到此处，或点击选择文件
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        支持 CSV 和 TXT 格式，最多 500 条反馈
      </p>
    </div>
  );
}
