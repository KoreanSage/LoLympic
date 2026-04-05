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

    // Add "mimzy.gg" watermark bar at bottom using logo image
    const barHeight = Math.min(56, Math.max(28, Math.round(imgHeight * 0.05)));
    let result: Buffer;
    try {
      // Load watermark logo
      const logoPath = path.join(process.cwd(), "public", "watermark-logo.png");
      const logoBuf = await fs.readFile(logoPath);

      // Resize logo to fit bar (50% of bar height)
      const logoTargetH = Math.max(10, Math.round(barHeight * 0.5));
      const resizedLogo = await sharp(logoBuf)
        .resize({ height: logoTargetH, fit: "inside" })
        .png()
        .toBuffer();
      const logoMeta = await sharp(resizedLogo).metadata();
      const logoW = logoMeta.width || 100;
      const logoH = logoMeta.height || logoTargetH;

      // Separator + logo composited onto black bar
      const sepH = Math.max(1, Math.round(barHeight * 0.03));
      const sepSvg = `<svg width="${imgWidth}" height="${sepH}" xmlns="http://www.w3.org/2000/svg"><rect width="${imgWidth}" height="${sepH}" fill="#333"/></svg>`;

      const barBuffer = await sharp({
        create: { width: imgWidth, height: barHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
      })
        .composite([
          { input: Buffer.from(sepSvg), top: 0, left: 0 },
          { input: resizedLogo, top: Math.round((barHeight - logoH) / 2), left: Math.round((imgWidth - logoW) / 2) },
        ])
        .png()
        .toBuffer();

      result = await sharp(imageBuffer)
        .extend({ bottom: barHeight, background: { r: 0, g: 0, b: 0, alpha: 1 } })
        .composite([{ input: barBuffer, gravity: "south" }])
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
