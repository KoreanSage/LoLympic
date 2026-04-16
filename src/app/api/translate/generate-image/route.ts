import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { GoogleGenAI } from "@google/genai";
import { runLamaInpainting } from "@/lib/replicate";
import { generateInpaintingMask } from "@/lib/mask-generator";
import sharp from "sharp";
import crypto from "crypto";
import { isR2Configured, uploadBufferToR2 } from "@/lib/storage";

// Allow longer timeout for image generation (multiple images)
export const maxDuration = 60;

const USE_R2 = isR2Configured();
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

async function readImageAsBuffer(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") || extractMimeType(imageUrl);
    return { buffer, mimeType };
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
  return { buffer: imageBuffer, mimeType: extractMimeType(imagePath) };
}

async function saveGeneratedImage(buffer: Buffer, prefix: string, ext: string): Promise<string> {
  const filename = `uploads/${prefix}_${crypto.randomUUID()}${ext}`;
  const mimeMap: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
  const contentType = mimeMap[ext] || "image/jpeg";

  if (USE_R2) {
    const url = await uploadBufferToR2(buffer, filename, contentType);
    if (!url) throw new Error("R2 upload failed");
    return url;
  }
  // Local dev fallback: write to disk
  const path = await import("path");
  const fs = await import("fs/promises");
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  const filePath = path.join(path.resolve(uploadDir), filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return `/api/uploads/${filename}`;
}

/**
 * Generate a clean image using LaMa inpainting (primary) with Gemini fallback.
 * Uses translation segments from DB to build the inpainting mask.
 */
async function generateCleanImageWithLama(
  imageBuffer: Buffer,
  mimeType: string,
  postId: string,
  imageIndex: number = 0
): Promise<string | null> {
  try {
    // Get translation segments from DB for this post/image to build the mask
    const segments = await prisma.translationSegment.findMany({
      where: {
        translationPayload: { postId },
        imageIndex,
      },
      select: {
        boxX: true,
        boxY: true,
        boxWidth: true,
        boxHeight: true,
        semanticRole: true,
      },
    });

    if (segments.length === 0) {
      console.log(`[LaMa] No segments found for post ${postId} image ${imageIndex}, skipping`);
      return null;
    }

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;
    if (!imgWidth || !imgHeight) {
      console.warn(`[LaMa] Could not determine image dimensions for post ${postId}`);
      return null;
    }

    // Generate inpainting mask from segments
    const maskBuffer = await generateInpaintingMask(segments, imgWidth, imgHeight);

    // Run LaMa inpainting
    const lamaOutputUrl = await runLamaInpainting(imageBuffer, maskBuffer, mimeType);

    // Download the clean image from LaMa output URL
    const cleanRes = await fetch(lamaOutputUrl);
    if (!cleanRes.ok) {
      throw new Error(`Failed to download LaMa output: ${cleanRes.status}`);
    }
    const cleanBuffer = Buffer.from(await cleanRes.arrayBuffer());

    // Upload to storage (R2 or local)
    const cleanUrl = await saveGeneratedImage(cleanBuffer, "clean_lama", ".png");
    console.log(`[LaMa] Clean image generated for post ${postId} image ${imageIndex}: ${cleanUrl}`);
    return cleanUrl;
  } catch (error) {
    console.error(`[LaMa] Inpainting failed for post ${postId} image ${imageIndex}:`, error);
    return null;
  }
}

/**
 * Fallback: Generate clean image using Gemini inpainting
 */
async function generateCleanImageWithGemini(
  imageBase64: string,
  mimeType: string
): Promise<string | null> {
  try {
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
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      }],
      config: { responseModalities: ["TEXT", "IMAGE"] },
    });

    const parts = response?.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        const cleanBuffer = Buffer.from(part.inlineData.data, "base64");
        const ext = part.inlineData.mimeType?.includes("png") ? ".png" : ".jpg";
        return await saveGeneratedImage(cleanBuffer, "clean_gemini", ext);
      }
    }

    return null;
  } catch (err) {
    console.error("[Gemini fallback] Clean image generation failed:", err);
    return null;
  }
}

/**
 * POST /api/translate/generate-image
 * Generates clean images (text removed via inpainting) for ALL post images.
 * Primary: LaMa inpainting (mask-based, higher quality)
 * Fallback: Gemini inpainting (prompt-based)
 * Called automatically after translation or from the frontend.
 * Requires authentication to prevent unauthorized API usage.
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

    const results: Array<{ imageId: string; cleanUrl: string | null; method?: string }> = [];

    for (let i = 0; i < needsClean.length; i++) {
      const img = needsClean[i];
      try {
        const { buffer: imageBuffer, mimeType } = await readImageAsBuffer(img.originalUrl);

        // Primary: Try LaMa inpainting (mask-based)
        let cleanUrl = await generateCleanImageWithLama(imageBuffer, mimeType, postId, img.orderIndex);
        let method = "lama";

        // Fallback: Try Gemini inpainting if LaMa fails
        if (!cleanUrl) {
          console.log(`[Fallback] Trying Gemini inpainting for image ${img.id}...`);
          const base64 = imageBuffer.toString("base64");
          cleanUrl = await generateCleanImageWithGemini(base64, mimeType);
          method = "gemini";
        }

        if (cleanUrl) {
          await prisma.postImage.update({
            where: { id: img.id },
            data: { cleanUrl },
          });
        }

        results.push({ imageId: img.id, cleanUrl, method: cleanUrl ? method : undefined });
        console.log(`Clean image generated for ${img.id}: ${cleanUrl ? `SUCCESS (${method})` : "FAILED"}`);
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
