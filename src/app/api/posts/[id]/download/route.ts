import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";

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
      const uploadDir = process.env.UPLOAD_DIR || "./uploads";
      const relativePath = imageUrl.replace(/^\/(api\/)?uploads\//, "");
      imageBuffer = await fs.readFile(path.join(path.resolve(uploadDir), relativePath));
    }

    // Get dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 800;

    // Add "mimzy.gg" watermark bar at bottom
    const barHeight = Math.max(32, Math.round(imgHeight * 0.05));
    let result: Buffer;
    try {
      // Create dark bar with centered gold dot pattern as brand mark
      const dotR = Math.max(2, Math.round(barHeight * 0.12));
      const gap = Math.round(dotR * 3.5);
      const cx = Math.round(imgWidth / 2);
      const cy = Math.round(barHeight / 2);
      // 8 gold dots in a line (simple, no font dependency)
      const dots = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]
        .map(i => `<circle cx="${cx + i * gap}" cy="${cy}" r="${dotR}" fill="#C9A84C"/>`)
        .join("");
      const barSvg = `<svg width="${imgWidth}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="${imgWidth}" height="${barHeight}" fill="#0D0D0D"/>${dots}</svg>`;

      result = await sharp(imageBuffer)
        .extend({ bottom: barHeight, background: { r: 13, g: 13, b: 13, alpha: 1 } })
        .composite([{ input: Buffer.from(barSvg), gravity: "south" }])
        .webp({ quality: 85 })
        .toBuffer();
    } catch (wmErr) {
      console.error("Watermark failed, returning without watermark:", wmErr);
      result = await sharp(imageBuffer).webp({ quality: 85 }).toBuffer();
    }

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
