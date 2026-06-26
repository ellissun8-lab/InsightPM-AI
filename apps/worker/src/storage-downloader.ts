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
    listError?: string;
    downloadError?: string;
    signedUrlError?: string;
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

  const parentDir = path.dirname(storagePath);
  const fileName = path.basename(storagePath);

  // Step 1: Best-effort 检查文件是否存在
  // list 失败只是 warning，不阻止下载
  let listError: string | undefined;
  console.log(`[StorageDownloader] Checking if file exists (best-effort)...`);
  try {
    const { data: listData, error: le } = await supabase.storage
      .from(bucket)
      .list(parentDir);

    if (le) {
      console.warn(`[StorageDownloader] list failed (non-fatal):`, le.message);
      listError = le.message;
    } else {
      const fileExists = listData?.some((f) => f.name === fileName);
      if (!fileExists) {
        console.error(`[StorageDownloader] File not found in list: ${storagePath}`);
        return {
          success: false,
          error: {
            message: "Input CSV not found in Supabase Storage",
            bucket,
            path: storagePath,
            originalName,
            listError: `File '${fileName}' not found in '${parentDir}'`,
          },
        };
      }
      console.log(`[StorageDownloader] File exists in list`);
    }
  } catch (listErr: any) {
    console.warn(`[StorageDownloader] list threw exception (non-fatal):`, listErr.message);
    listError = listErr.message;
  }

  // Step 2: 尝试直接下载
  let downloadError: string | undefined;
  try {
    console.log(`[StorageDownloader] Attempting direct download...`);
    const { data: fileData, error: dlError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (dlError) {
      downloadError = dlError.message;
      console.error(`[StorageDownloader] Direct download failed:`, downloadError);
      throw new Error(downloadError);
    }

    if (!fileData) {
      downloadError = "Download returned no data";
      throw new Error(downloadError);
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
    console.error(`[StorageDownloader] Direct download error:`, directError.message);
    if (!downloadError) downloadError = directError.message;
  }

  // Step 3: Fallback - 使用 signed URL
  let signedUrlError: string | undefined;
  try {
    console.log(`[StorageDownloader] Trying signed URL fallback...`);
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);

    if (urlError || !urlData?.signedUrl) {
      signedUrlError = urlError?.message || "Failed to create signed URL";
      console.error(`[StorageDownloader] Failed to create signed URL:`, signedUrlError);
      throw new Error(signedUrlError);
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
    console.error(`[StorageDownloader] Signed URL download failed:`, fallbackError.message);
    if (!signedUrlError) signedUrlError = fallbackError.message;
  }

  // 所有方法都失败
  console.error(`[StorageDownloader] All download methods failed`);
  return {
    success: false,
    error: {
      message: `Failed to download CSV after all attempts`,
      bucket,
      path: storagePath,
      originalName,
      listError,
      downloadError,
      signedUrlError,
    },
  };
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
