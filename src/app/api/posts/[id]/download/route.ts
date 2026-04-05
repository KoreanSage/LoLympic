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

    // Create watermark bar with "mimzy.gg" text
    const barHeight = Math.max(32, Math.round(imgHeight * 0.05));

    let watermarkOverlay: Buffer | null = null;
    try {
      // Attempt 1: Pango text API (works locally, may fail on Vercel)
      const textBuf = await sharp({
        text: {
          text: `<span foreground="#C9A84C" font_weight="bold" letter_spacing="${1024 * 2}">mimzy.gg</span>`,
          font: "sans",
          dpi: Math.round(barHeight * 3),
          rgba: true,
        },
      }).png().toBuffer();
      const meta = await sharp(textBuf).metadata();
      if (meta.width && meta.width > 10) watermarkOverlay = textBuf;
    } catch {
      // Pango not available
    }

    if (!watermarkOverlay) {
      try {
        // Attempt 2: SVG text (may render garbled on Vercel)
        const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${imgWidth}" height="${barHeight}"><text x="${imgWidth/2}" y="${barHeight/2 + 5}" font-size="14" fill="#C9A84C" text-anchor="middle" font-family="monospace" font-weight="bold">mimzy.gg</text></svg>`;
        const svgBuf = await sharp(Buffer.from(svg)).png().toBuffer();
        watermarkOverlay = svgBuf;
      } catch {
        // SVG also failed
      }
    }

    // Compose: image + dark bar (+ text overlay if available)
    const composites: sharp.OverlayOptions[] = [];
    if (watermarkOverlay) {
      const meta = await sharp(watermarkOverlay).metadata();
      composites.push({
        input: watermarkOverlay,
        left: Math.round((imgWidth - (meta.width || 100)) / 2),
        top: imgHeight + Math.round((barHeight - (meta.height || 16)) / 2),
      });
    }

    const extended = await sharp(imageBuffer)
      .extend({ bottom: barHeight, background: { r: 13, g: 13, b: 13, alpha: 1 } });

    const result = await (composites.length > 0
      ? extended.composite(composites)
      : extended
    ).webp({ quality: 85 }).toBuffer();

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
