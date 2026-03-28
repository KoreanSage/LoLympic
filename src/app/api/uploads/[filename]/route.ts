import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/**
 * GET /api/uploads/[filename]
 * Serves static files from the uploads directory.
 * Only allows image/video files with safe filenames.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Security: only allow safe filenames (no path traversal)
    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeType = MIME_TYPES[ext];

    if (!mimeType) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    const absoluteUploadDir = path.resolve(uploadDir);
    const filePath = path.resolve(uploadDir, filename);

    // Security: ensure resolved path is within uploads directory
    if (!filePath.startsWith(absoluteUploadDir)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("Upload serve error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
