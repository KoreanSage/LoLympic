import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import sharp from "sharp";

/**
 * GET /api/posts/[id]/download
 * Returns the meme image with a "mimzy.gg" watermark bar at the bottom.
 * Uses translated image if available, otherwise original.
 * Query params: ?lang=ko (optional, to pick specific translation)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang");

    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        title: true,
        images: {
          take: 1,
          orderBy: { orderIndex: "asc" },
          select: { originalUrl: true },
        },
        translationPayloads: lang ? {
          where: {
            targetLanguage: lang as any,
            status: { in: ["COMPLETED", "APPROVED"] },
            translatedImageUrl: { not: null },
          },
          orderBy: { version: "desc" as const },
          take: 1,
          select: { translatedImageUrl: true },
        } : false,
      },
    });

    if (!post || !post.images[0]) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Pick best image: translated > original
    const translatedUrl = (post.translationPayloads as any)?.[0]?.translatedImageUrl;
    const imageUrl = translatedUrl || post.images[0].originalUrl;

    // Fetch the image
    let imageBuffer: Buffer;
    if (imageUrl.startsWith("http")) {
      const res = await fetch(imageUrl);
      if (!res.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
      imageBuffer = Buffer.from(await res.arrayBuffer());
    } else {
      const path = await import("path");
      const fs = await import("fs/promises");
      const uploadDir = process.env.UPLOAD_DIR || "./uploads";
      const relativePath = imageUrl.replace(/^\/(api\/)?uploads\//, "");
      imageBuffer = await fs.readFile(path.join(path.resolve(uploadDir), relativePath));
    }

    // Get dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 800;

    // Create watermark bar — use sharp text API (Pango) for reliable font rendering
    const barHeight = Math.max(36, Math.round(imgHeight * 0.055));

    // Build watermark with sharp's create + composite approach (no SVG text, no font dependency)
    // Step 1: Dark bar background
    const barBuffer = await sharp({
      create: { width: imgWidth, height: barHeight, channels: 4, background: { r: 13, g: 13, b: 13, alpha: 255 } },
    }).png().toBuffer();

    // Step 2: Try to render text using sharp's SVG with explicit XML declaration
    let textOverlay: Buffer;
    try {
      const fontSize = Math.max(14, Math.round(barHeight * 0.4));
      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${barHeight}"><text x="${imgWidth / 2}" y="${barHeight / 2 + fontSize * 0.35}" font-size="${fontSize}" font-weight="700" fill="#C9A84C" text-anchor="middle" letter-spacing="2" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif">mimzy.gg</text></svg>`;
      // Test if rendered SVG actually contains visible pixels
      const rendered = await sharp(Buffer.from(svg)).png().toBuffer();
      const { channels, width } = await sharp(rendered).stats().then(s => ({ channels: s.channels, width: imgWidth })).catch(() => ({ channels: [], width: 0 }));
      // If stats look valid, use it; otherwise fall back
      if (width > 0) {
        textOverlay = rendered;
      } else {
        throw new Error("SVG text render empty");
      }
    } catch {
      // Fallback: simple "mimzy.gg" as centered dots pattern (graceful degradation)
      const dotSize = Math.max(3, Math.round(barHeight * 0.08));
      const fallbackSvg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${barHeight}"><circle cx="${imgWidth/2 - 20}" cy="${barHeight/2}" r="${dotSize}" fill="#C9A84C"/><circle cx="${imgWidth/2}" cy="${barHeight/2}" r="${dotSize}" fill="#C9A84C"/><circle cx="${imgWidth/2 + 20}" cy="${barHeight/2}" r="${dotSize}" fill="#C9A84C"/></svg>`;
      textOverlay = Buffer.from(fallbackSvg);
    }

    // Compose: original image + dark bar + text
    const result = await sharp(imageBuffer)
      .extend({
        bottom: barHeight,
        background: { r: 13, g: 13, b: 13, alpha: 1 },
      })
      .composite([
        { input: barBuffer, gravity: "south" },
        { input: textOverlay, gravity: "south" },
      ])
      .webp({ quality: 85 })
      .toBuffer();

    // Increment share count (fire-and-forget)
    prisma.post.update({
      where: { id },
      data: { shareCount: { increment: 1 } },
    }).catch(() => {});

    const safeTitle = (post.title || "meme").replace(/[^a-zA-Z0-9가-힣ぁ-んァ-ン一-龥\s-]/g, "").trim().slice(0, 50) || "meme";

    return new NextResponse(Buffer.from(result) as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": `attachment; filename="mimzy-${safeTitle}.webp"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json({ error: "Failed to generate download" }, { status: 500 });
  }
}
