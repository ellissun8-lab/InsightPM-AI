import { supabase } from "./supabase.js";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

export interface DownloadResult {
  success: boolean;
  localPath?: string;
  fileSize?: number;
  error?: {
    message: string;
    bucket: string;
    path: string;
    originalName: string;
    supabaseError?: string;
    cause?: string;
    stack?: string;
  };
}

/**
 * 从 Supabase Storage 下载文件
 */
export async function downloadFromStorage(
  bucket: string,
  storagePath: string,
  localDir: string,
  originalName: string
): Promise<DownloadResult> {
  const localPath = path.join(localDir, "input.csv");

  console.log(`[StorageDownloader] bucket: ${bucket}`);
  console.log(`[StorageDownloader] path: ${storagePath}`);
  console.log(`[StorageDownloader] localPath: ${localPath}`);

  // Step 1: 检查文件是否存在
  console.log(`[StorageDownloader] Checking if file exists...`);
  const parentDir = path.dirname(storagePath);
  const fileName = path.basename(storagePath);

  const { data: listData, error: listError } = await supabase.storage
    .from(bucket)
    .list(parentDir);

  if (listError) {
    console.error(`[StorageDownloader] Failed to list directory:`, listError);
    return {
      success: false,
      error: {
        message: "Failed to list Supabase Storage directory",
        bucket,
        path: storagePath,
        originalName,
        supabaseError: listError.message,
      },
    };
  }

  const fileExists = listData?.some((f) => f.name === fileName);
  if (!fileExists) {
    console.error(`[StorageDownloader] File not found: ${storagePath}`);
    return {
      success: false,
      error: {
        message: "Input CSV not found in Supabase Storage",
        bucket,
        path: storagePath,
        originalName,
        supabaseError: `File '${fileName}' not found in '${parentDir}'`,
      },
    };
  }

  console.log(`[StorageDownloader] File exists, attempting download...`);

  // Step 2: 尝试直接下载
  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError) {
      console.error(`[StorageDownloader] Direct download failed:`, downloadError);
      // 继续到 fallback
      throw new Error(downloadError.message);
    }

    if (!fileData) {
      throw new Error("Download returned no data");
    }

    // 保存文件
    fs.mkdirSync(localDir, { recursive: true });
    const buffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(localPath, buffer);

    console.log(`[StorageDownloader] Direct download successful`);
    console.log(`[StorageDownloader] File size: ${buffer.length} bytes`);

    return {
      success: true,
      localPath,
      fileSize: buffer.length,
    };
  } catch (directError: any) {
    console.error(`[StorageDownloader] Direct download failed, trying signed URL fallback...`);
    console.error(`[StorageDownloader] Error:`, directError.message);

    // Step 3: Fallback - 使用 signed URL
    try {
      const { data: urlData, error: urlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, 60);

      if (urlError || !urlData?.signedUrl) {
        throw new Error(urlError?.message || "Failed to create signed URL");
      }

      console.log(`[StorageDownloader] Signed URL created, downloading via https...`);

      // 使用 node:https 下载
      const fileBuffer = await downloadViaHttps(urlData.signedUrl);

      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(localPath, fileBuffer);

      console.log(`[StorageDownloader] Signed URL download successful`);
      console.log(`[StorageDownloader] File size: ${fileBuffer.length} bytes`);

      return {
        success: true,
        localPath,
        fileSize: fileBuffer.length,
      };
    } catch (fallbackError: any) {
      console.error(`[StorageDownloader] Fallback download also failed:`, fallbackError);

      return {
        success: false,
        error: {
          message: `Failed to download CSV: ${directError.message}`,
          bucket,
          path: storagePath,
          originalName,
          supabaseError: directError.message,
          cause: fallbackError.message,
          stack: fallbackError.stack,
        },
      };
    }
  }
}

/**
 * 使用 node:https 下载文件
 */
function downloadViaHttps(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 跟随重定向
        downloadViaHttps(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}
