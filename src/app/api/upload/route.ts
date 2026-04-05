import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Set R2 bucket CORS once per cold start so images load via canvas (crossOrigin = "anonymous")
let r2CorsConfigured = false;
async function ensureR2Cors() {
  if (r2CorsConfigured) return;
  try {
    const { S3Client, PutBucketCorsCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await s3.send(new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: ["https://mimzy.gg", "https://www.mimzy.gg", "http://localhost:3000"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedHeaders: ["Content-Type"],
          MaxAgeSeconds: 86400,
        }],
      },
    }));
    r2CorsConfigured = true;
    console.log("[R2] CORS configured successfully");
  } catch (err) {
    console.warn("[R2] Could not configure CORS (non-fatal):", err);
    r2CorsConfigured = true; // Don't retry on every upload
  }
}
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

    let buffer = Buffer.from(await file.arrayBuffer());

    // Optimize image with sharp: resize large images + compress
    let width: number | null = null;
    let height: number | null = null;
    let optimizedMime = file.type;

    try {
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(buffer).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;

      // Skip optimization for GIFs (animated) and small images
      const isGif = file.type === "image/gif";
      const isSmall = buffer.length < 200 * 1024; // < 200KB already small

      if (!isGif && !isSmall && width && height) {
        // Cap dimensions to 2048px (preserving aspect ratio)
        const MAX_DIM = 2048;
        let pipeline = sharp(buffer);

        if (width > MAX_DIM || height > MAX_DIM) {
          pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true });
        }

        // Convert to WebP for best compression (80% quality ≈ JPEG 90% visual quality)
        const optimized = await pipeline.webp({ quality: 80 }).toBuffer();

        // Only use optimized if it's actually smaller
        if (optimized.length < buffer.length) {
          buffer = Buffer.from(optimized);
          optimizedMime = "image/webp";
          // Update dimensions after resize
          const newMeta = await sharp(buffer).metadata();
          width = newMeta.width ?? width;
          height = newMeta.height ?? height;
        }
      }
    } catch {
      console.warn("Could not optimize image with sharp, uploading original");
    }

    // Generate unique filename
    const hash = crypto.randomBytes(16).toString("hex");
    const ext = optimizedMime === "image/webp" ? ".webp" : mimeToExt(file.type);
    const baseName = `${Date.now()}-${hash}${ext}`;
    const filename = `uploads/${baseName}`; // R2/Blob key

    let url: string;

    if (USE_R2) {
      // Ensure CORS is configured on the bucket (idempotent, runs once per cold start)
      await ensureR2Cors();

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
          ContentType: optimizedMime,
          CacheControl: "public, max-age=31536000, immutable",
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
        contentType: optimizedMime,
        cacheControlMaxAge: 31536000,
      });
      url = blob.url;
    } else {
      // Development: Save to local filesystem
      const path = await import("path");
      const fs = await import("fs/promises");
      const uploadDir = process.env.UPLOAD_DIR || "./uploads";
      const absolutePath = path.resolve(uploadDir);
      await fs.mkdir(absolutePath, { recursive: true });
      const filepath = path.join(absolutePath, baseName);
      await fs.writeFile(filepath, buffer);
      url = `/api/uploads/${baseName}`;
    }

    return NextResponse.json({
      url,
      cleanUrl: null,
      filename,
      width,
      height,
      mimeType: optimizedMime,
      fileSizeBytes: buffer.length,
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
