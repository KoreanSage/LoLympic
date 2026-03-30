import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Storage backend detection
const USE_R2 = !!(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_ENDPOINT &&
  process.env.R2_BUCKET_NAME
);
const USE_BLOB = !USE_R2 && !!process.env.BLOB_READ_WRITE_TOKEN;

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

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Get image dimensions using sharp
    let width: number | null = null;
    let height: number | null = null;

    try {
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(buffer).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;
    } catch {
      console.warn("Could not read image metadata with sharp");
    }

    // Generate unique filename
    const hash = crypto.randomBytes(16).toString("hex");
    const ext = mimeToExt(file.type);
    const filename = `uploads/${Date.now()}-${hash}${ext}`;

    let url: string;

    if (USE_R2) {
      // Production: Upload to Cloudflare R2
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

      const s3 = new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT!,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: filename,
          Body: buffer,
          ContentType: file.type,
        })
      );

      const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
      if (!publicUrl) {
        console.error("R2_PUBLIC_URL is not configured");
        return NextResponse.json(
          { error: "Storage misconfiguration: R2_PUBLIC_URL is not set" },
          { status: 500 }
        );
      }
      url = `${publicUrl}/${filename}`;
    } else if (USE_BLOB) {
      // Fallback: Upload to Vercel Blob
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buffer, {
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
  };
  const ext = map[mime];
  if (!ext) throw new Error(`Unsupported MIME type: ${mime}`);
  return ext;
}
