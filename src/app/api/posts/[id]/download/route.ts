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

    // Create watermark bar using sharp's Pango text API (no SVG, no font dependency issues)
    const barHeight = Math.max(36, Math.round(imgHeight * 0.055));
    const fontSize = Math.max(14, Math.round(barHeight * 0.4));

    // Render "mimzy.gg" text using sharp's built-in text support (Pango)
    const textImage = await sharp({
      text: {
        text: `<span foreground="#C9A84C" font_weight="bold" letter_spacing="${1024 * 2}">mimzy.gg</span>`,
        font: "sans",
        dpi: Math.round(fontSize * 7),
        rgba: true,
      },
    }).png().toBuffer();

    // Get text dimensions to center it on the bar
    const textMeta = await sharp(textImage).metadata();
    const textW = textMeta.width || 100;
    const textH = textMeta.height || 20;

    // Compose: image + dark bar + centered text
    const result = await sharp(imageBuffer)
      .extend({
        bottom: barHeight,
        background: { r: 13, g: 13, b: 13, alpha: 1 },
      })
      .composite([{
        input: textImage,
        left: Math.round((imgWidth - textW) / 2),
        top: imgHeight + Math.round((barHeight - textH) / 2),
      }])
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
