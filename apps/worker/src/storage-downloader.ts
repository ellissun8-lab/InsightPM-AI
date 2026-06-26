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
    sdkDownloadError?: string;
    restDownloadError?: string;
    signedUrlError?: string;
    nodeVersion?: string;
  };
}

/**
 * 从 Supabase Storage 下载文件
 * 优先使用 REST API + node:https（最稳定）
 * SDK 作为备用
 */
export async function downloadFromStorage(
  bucket: string,
  storagePath: string,
  localDir: string,
  originalName: string
): Promise<DownloadResult> {
  const localPath = path.join(localDir, "input.csv");
  const nodeVersion = process.version;

  console.log(`[StorageDownloader] bucket: ${bucket}`);
  console.log(`[StorageDownloader] path: ${storagePath}`);
  console.log(`[StorageDownloader] localPath: ${localPath}`);
  console.log(`[StorageDownloader] nodeVersion: ${nodeVersion}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let listError: string | undefined;
  let sdkDownloadError: string | undefined;
  let restDownloadError: string | undefined;
  let signedUrlError: string | undefined;

  // Step 1: REST API + node:https 直接下载（最稳定）
  if (supabaseUrl && serviceRoleKey) {
    try {
      console.log(`[StorageDownloader] Attempting REST API download...`);
      const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
      const restUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;

      console.log(`[StorageDownloader] REST URL: ${restUrl}`);

      const fileBuffer = await downloadViaHttps(restUrl, {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      });

      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(localPath, fileBuffer);

      console.log(`[StorageDownloader] REST download successful, size: ${fileBuffer.length}`);
      return { success: true, localPath, fileSize: fileBuffer.length };
    } catch (restErr: any) {
      restDownloadError = restErr.message;
      console.error(`[StorageDownloader] REST download failed:`, restDownloadError);
    }
  } else {
    restDownloadError = "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY";
    console.warn(`[StorageDownloader] Skipping REST download: ${restDownloadError}`);
  }

  // Step 2: SDK 下载（备用）
  try {
    console.log(`[StorageDownloader] Attempting SDK download...`);

    // Best-effort list
    const parentDir = path.dirname(storagePath);
    const fileName = path.basename(storagePath);
    try {
      const { data: listData, error: le } = await supabase.storage
        .from(bucket)
        .list(parentDir);

      if (le) {
        console.warn(`[StorageDownloader] SDK list failed (non-fatal):`, le.message);
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
              listError: `File '${fileName}' not found`,
              nodeVersion,
            },
          };
        }
      }
    } catch (listErr: any) {
      console.warn(`[StorageDownloader] SDK list exception (non-fatal):`, listErr.message);
      listError = listErr.message;
    }

    const { data: fileData, error: dlError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (!dlError && fileData) {
      fs.mkdirSync(localDir, { recursive: true });
      const buffer = Buffer.from(await fileData.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      console.log(`[StorageDownloader] SDK download successful, size: ${buffer.length}`);
      return { success: true, localPath, fileSize: buffer.length };
    }

    sdkDownloadError = dlError?.message || "SDK download returned no data";
    console.error(`[StorageDownloader] SDK download failed:`, sdkDownloadError);
  } catch (sdkErr: any) {
    sdkDownloadError = sdkErr.message;
    console.error(`[StorageDownloader] SDK download exception:`, sdkDownloadError);
  }

  // Step 3: Signed URL fallback
  try {
    console.log(`[StorageDownloader] Attempting signed URL fallback...`);
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);

    if (urlError || !urlData?.signedUrl) {
      signedUrlError = urlError?.message || "Failed to create signed URL";
      console.error(`[StorageDownloader] Failed to create signed URL:`, signedUrlError);
    } else {
      console.log(`[StorageDownloader] Signed URL created, downloading...`);
      const fileBuffer = await downloadViaHttps(urlData.signedUrl, {});

      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(localPath, fileBuffer);

      console.log(`[StorageDownloader] Signed URL download successful, size: ${fileBuffer.length}`);
      return { success: true, localPath, fileSize: fileBuffer.length };
    }
  } catch (suErr: any) {
    signedUrlError = suErr.message;
    console.error(`[StorageDownloader] Signed URL download failed:`, signedUrlError);
  }

  // 所有方法都失败
  console.error(`[StorageDownloader] All download methods failed`);
  return {
    success: false,
    error: {
      message: "Failed to download CSV after all attempts",
      bucket,
      path: storagePath,
      originalName,
      listError,
      sdkDownloadError,
      restDownloadError,
      signedUrlError,
      nodeVersion,
    },
  };
}

/**
 * 使用 node:https 下载文件
 */
function downloadViaHttps(
  url: string,
  headers: Record<string, string>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const timeout = 30000;

    const req = protocol.get(url, { headers, timeout }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadViaHttps(res.headers.location, headers).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8").slice(0, 500);
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        });
        return;
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}
