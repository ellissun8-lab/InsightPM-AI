import { NextRequest, NextResponse } from "next/server";
import { getReportArtifactPath, getZipBuffer } from "@/lib/report-artifacts";

export async function GET(
  req: NextRequest,
  { params }: { params: { caseName: string } }
) {
  try {
    const { caseName } = params;
    const type = req.nextUrl.searchParams.get("type") || "";
    const segmentId = req.nextUrl.searchParams.get("segment") || undefined;

    if (!type) {
      return NextResponse.json(
        { error: "Missing required parameter: type" },
        { status: 400 }
      );
    }

    // Handle ZIP separately (buffer-based)
    if (type === "all-zip") {
      const buffer = getZipBuffer(caseName);
      if (!buffer) {
        return NextResponse.json(
          { error: "Artifact not found", type, caseName },
          { status: 404 }
        );
      }
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${caseName}.artifacts.zip"`,
        },
      });
    }

    const result = getReportArtifactPath({ caseName, type, segmentId });

    if (result.error) {
      return NextResponse.json(
        { error: result.error, type, caseName },
        { status: 404 }
      );
    }

    // Buffer-based response (e.g. generated CSV)
    if (result.buffer) {
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
        },
      });
    }

    // File-based response
    if (result.filePath) {
      const fs = await import("fs");
      if (!fs.existsSync(result.filePath)) {
        return NextResponse.json(
          { error: "Artifact not found", type, caseName },
          { status: 404 }
        );
      }
      const content = fs.readFileSync(result.filePath);
      return new NextResponse(content, {
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Artifact not found", type, caseName },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
