import { NextResponse } from "next/server";
import { isCloudMode } from "@/lib/data/storage-mode";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Local mode: not implemented
    if (!isCloudMode()) {
      return NextResponse.json({
        ok: false,
        mode: "local",
        message: "Local mode should use /api/upload.",
      });
    }

    // Cloud mode: upload to Supabase Storage
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Supabase storage is not configured." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const workspaceId = formData.get("workspaceId") as string | null;
    const runId = formData.get("runId") as string || `run-${Date.now()}`;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Determine storage path
    const bucket = "uploads";
    const filePath = workspaceId
      ? `${workspaceId}/${runId}/${file.name}`
      : `default/${runId}/${file.name}`;

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading to Supabase Storage:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file." },
        { status: 500 }
      );
    }

    // Get signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour

    if (urlError) {
      console.error("Error creating signed URL:", urlError);
    }

    return NextResponse.json({
      ok: true,
      mode: "cloud",
      bucket,
      path: filePath,
      signedUrl: urlData?.signedUrl || null,
      fileName: file.name,
      sizeBytes: file.size,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
