import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

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
 * Generates translated/clean images in a separate request to avoid timeout.
 * Called by the frontend after translation text is complete.
 * Body: { postId, payloadId?, type: "translated" | "clean" }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { postId, payloadId, type } = body as {
      postId: string;
      payloadId?: string;
      type: "translated" | "clean";
    };

    if (!postId || !type) {
      return NextResponse.json({ error: "Missing postId or type" }, { status: 400 });
    }

    // Get the post image
    const postImage = await prisma.postImage.findFirst({
      where: { postId },
      orderBy: { orderIndex: "asc" },
    });
    if (!postImage) {
      return NextResponse.json({ error: "Post image not found" }, { status: 404 });
    }

    const { base64: imageBase64, mimeType } = await readImageAsBase64(postImage.originalUrl);

    if (type === "clean") {
      // Generate clean image (text removed)
      if (postImage.cleanUrl) {
        return NextResponse.json({ url: postImage.cleanUrl });
      }

      const response = await genAI2.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{
          role: "user",
          parts: [
            {
              text: `Remove ALL readable text content from this image using context-aware inpainting. Replace each removed text area with the background that would naturally be behind it. Keep the overall layout structure intact. Output only the modified image.`,
            },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });

      const parts = response?.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const buffer = Buffer.from(part.inlineData.data, "base64");
            const ext = part.inlineData.mimeType?.includes("png") ? ".png" : ".jpg";
            const url = await saveGeneratedImage(buffer, "clean", ext);
            await prisma.postImage.update({
              where: { id: postImage.id },
              data: { cleanUrl: url },
            });
            return NextResponse.json({ url });
          }
        }
      }
      return NextResponse.json({ url: null });
    }

    if (type === "translated" && payloadId) {
      // Generate translated image
      const payload = await prisma.translationPayload.findUnique({
        where: { id: payloadId },
        include: { segments: true },
      });
      if (!payload || payload.segments.length === 0) {
        return NextResponse.json({ url: null });
      }
      if (payload.translatedImageUrl) {
        return NextResponse.json({ url: payload.translatedImageUrl });
      }

      const replacements = payload.segments
        .map((s, i) => `${i + 1}. "${s.sourceText}" → "${s.translatedText}"`)
        .join("\n");

      const response = await genAI2.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{
          role: "user",
          parts: [
            {
              text: `Replace ALL the specified text in this image with the translated versions below. Keep the image layout, colors, fonts, and style exactly the same.\n\nText replacements:\n${replacements}\n\nOutput only the modified image.`,
            },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });

      const parts = response?.candidates?.[0]?.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const buffer = Buffer.from(part.inlineData.data, "base64");
            const ext = part.inlineData.mimeType?.includes("png") ? ".png" : ".jpg";
            const url = await saveGeneratedImage(buffer, `translated_${payload.targetLanguage}`, ext);
            await prisma.translationPayload.update({
              where: { id: payload.id },
              data: { translatedImageUrl: url },
            });
            return NextResponse.json({ url });
          }
        }
      }
      return NextResponse.json({ url: null });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Generate image error:", error);
    return NextResponse.json({ error: "Image generation failed" }, { status: 500 });
  }
}
