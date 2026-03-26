import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

// Allow longer timeout for image generation (multiple images)
export const maxDuration = 60;

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;
const genAI2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

function extractMimeType(filePathOrUrl: string): string {
  const ext = filePathOrUrl.split(".").pop()?.toLowerCase().split("?")[0] || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] || "image/jpeg";
}

async function readImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") || extractMimeType(imageUrl);
    return { base64: buffer.toString("base64"), mimeType };
  }
  const path = await import("path");
  const fs = await import("fs/promises");
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  const relativePath = imageUrl.replace(/^\/(api\/)?uploads\//, "");
  if (relativePath.includes("..") || relativePath.includes("/") || relativePath.includes("\\")) {
    throw new Error("Invalid image path");
  }
  const absoluteUploadDir = path.resolve(uploadDir);
  const imagePath = path.resolve(uploadDir, relativePath);
  if (!imagePath.startsWith(absoluteUploadDir)) {
    throw new Error("Invalid image path");
  }
  const imageBuffer = await fs.readFile(imagePath);
  return { base64: imageBuffer.toString("base64"), mimeType: extractMimeType(imagePath) };
}

async function saveGeneratedImage(buffer: Buffer, prefix: string, ext: string): Promise<string> {
  const filename = `${prefix}_${crypto.randomUUID()}${ext}`;
  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const mimeMap: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg" };
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      contentType: mimeMap[ext] || "image/jpeg",
    });
    return blob.url;
  } else {
    const path = await import("path");
    const fs = await import("fs/promises");
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    const filePath = path.join(path.resolve(uploadDir), filename);
    await fs.writeFile(filePath, buffer);
    return `/api/uploads/${filename}`;
  }
}

/**
 * POST /api/translate/generate-image
 * Generates clean images (text removed via inpainting) for ALL post images.
 * Called automatically after translation or from the frontend.
 * Requires authentication to prevent unauthorized Gemini API usage.
 * Body: { postId }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit - expensive AI image generation
    const rlKey = getRateLimitKey(request.headers, "generate-image");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { postId } = body as { postId: string };

    if (!postId) {
      return NextResponse.json({ error: "Missing postId" }, { status: 400 });
    }

    // Get ALL post images
    const images = await prisma.postImage.findMany({
      where: { postId },
      orderBy: { orderIndex: "asc" },
    });

    if (images.length === 0) {
      return NextResponse.json({ error: "No images found" }, { status: 404 });
    }

    // Check if all images already have clean versions
    const needsClean = images.filter((img) => !img.cleanUrl);
    if (needsClean.length === 0) {
      return NextResponse.json({
        postId,
        images: images.map((img) => ({ imageId: img.id, cleanUrl: img.cleanUrl })),
        skipped: true,
      });
    }

    const results: Array<{ imageId: string; cleanUrl: string | null }> = [];

    for (const img of needsClean) {
      try {
        const { base64, mimeType } = await readImageAsBase64(img.originalUrl);

        const response = await genAI2.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{
            role: "user",
            parts: [
              {
                text: `Remove ALL readable text content from this image using context-aware inpainting.

What to remove:
- All text that conveys meaning (captions, post content, comments, dialogue, labels)
- Both overlay text (bold meme captions) AND embedded text (forum posts, chat messages, tweets)
- Any watermark text

What to KEEP (do NOT remove):
- Profile pictures, avatars, icons
- UI chrome (buttons, borders, layout frames)
- Timestamps, numerical stats
- Usernames and handles
- Background images and photos
- Logos (like team logos, brand logos on clothing)

Replace each removed text area with the background that would naturally be behind it.
Keep the overall layout structure intact.
Output only the modified image.`,
              },
              { inlineData: { mimeType, data: base64 } },
            ],
          }],
          config: { responseModalities: ["TEXT", "IMAGE"] },
        });

        const parts = response?.candidates?.[0]?.content?.parts;
        let cleanUrl: string | null = null;

        if (parts) {
          for (const part of parts) {
            if (part.inlineData?.data) {
              const cleanBuffer = Buffer.from(part.inlineData.data, "base64");
              const ext = part.inlineData.mimeType?.includes("png") ? ".png" : ".jpg";
              cleanUrl = await saveGeneratedImage(cleanBuffer, "clean", ext);
              break;
            }
          }
        }

        if (cleanUrl) {
          await prisma.postImage.update({
            where: { id: img.id },
            data: { cleanUrl },
          });
        }

        results.push({ imageId: img.id, cleanUrl });
        console.log(`Clean image generated for ${img.id}: ${cleanUrl ? "SUCCESS" : "FAILED"}`);
      } catch (err) {
        console.error(`Clean image failed for image ${img.id}:`, err);
        results.push({ imageId: img.id, cleanUrl: null });
      }
    }

    return NextResponse.json({ postId, images: results });
  } catch (error) {
    console.error("Generate image error:", error);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
