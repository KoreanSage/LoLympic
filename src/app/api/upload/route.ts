import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
];

const VIDEO_MIME_TYPES = ["video/mp4", "video/webm"];

// Check if Vercel Blob is available
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "upload");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.upload);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Use field name 'file'." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const isVideo = VIDEO_MIME_TYPES.includes(file.type);
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Get image dimensions using sharp (skip for videos)
    let width: number | null = null;
    let height: number | null = null;

    if (!isVideo) {
      try {
        const sharp = (await import("sharp")).default;
        const metadata = await sharp(buffer).metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;
      } catch {
        console.warn("Could not read image metadata with sharp");
      }
    }

    // Generate unique filename
    const hash = crypto.randomBytes(16).toString("hex");
    const ext = mimeToExt(file.type);
    const filename = `${Date.now()}-${hash}${ext}`;

    let url: string;

    if (USE_BLOB) {
      // Production: Upload to Vercel Blob
      const { put } = await import("@vercel/blob");
      const blob = await put(`uploads/${filename}`, buffer, {
        access: "public",
        contentType: file.type,
      });
      url = blob.url;
    } else {
      // Development: Save to local filesystem
      const path = await import("path");
      const fs = await import("fs/promises");
      const uploadDir = process.env.UPLOAD_DIR || "./uploads";
      const absolutePath = path.resolve(uploadDir);
      await fs.mkdir(absolutePath, { recursive: true });
      const filepath = path.join(absolutePath, filename);
      await fs.writeFile(filepath, buffer);
      url = `/api/uploads/${filename}`;
    }

    return NextResponse.json({
      url,
      cleanUrl: null,
      filename,
      width,
      height,
      mimeType: file.type,
      fileSizeBytes: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error during upload" },
      { status: 500 }
    );
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  };
  return map[mime] || ".bin";
}
