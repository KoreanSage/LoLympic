import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { getR2Client, isR2Configured, uploadBufferToR2 } from "@/lib/storage";
import { MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from "@/lib/constants";
import crypto from "crypto";

// Set R2 bucket CORS once per cold start so images load via canvas (crossOrigin = "anonymous")
let r2CorsConfigured = false;
async function ensureR2Cors() {
  if (r2CorsConfigured) return;
  try {
    const s3 = await getR2Client();
    if (!s3) {
      r2CorsConfigured = true;
      return;
    }
    const { PutBucketCorsCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new PutBucketCorsCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: ["*"],
          AllowedMethods: ["GET", "HEAD"],
          AllowedHeaders: ["*"],
          MaxAgeSeconds: 86400,
        }],
      },
    }));
    r2CorsConfigured = true;
    console.log("[R2] CORS configured successfully");
  } catch (err) {
    // Surface loudly — silent failure here causes canvas crossOrigin loads to
    // break site-wide. Fix: run `npx tsx scripts/check-r2-cors.ts --fix`.
    console.error("[R2] Could not configure CORS:", err);
    r2CorsConfigured = true; // Don't retry on every upload
  }
}

const USE_R2 = isR2Configured();

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

    if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Allowed: ${SUPPORTED_IMAGE_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.` },
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
      const uploaded = await uploadBufferToR2(buffer, filename, optimizedMime);
      if (!uploaded) {
        return NextResponse.json(
          { error: "Storage misconfiguration" },
          { status: 500 }
        );
      }
      url = uploaded;
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
