import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import crypto from "crypto";

export const maxDuration = 60;

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

// ─── Auth ─────────────────────────────────────────────────────────────────────
function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return auth === `Bearer ${cronSecret}`;
}

// ─── Font ─────────────────────────────────────────────────────────────────────
function getFontFamily(_lang: string): string {
  // Use Inter for all languages — Satori has issues with Noto Sans CJK substFormat
  return "Inter";
}

async function fetchFont(_family: string, _text: string): Promise<ArrayBuffer> {
  // Use Roboto TTF from Google Fonts static CDN (reliable, no substFormat issues)
  const fontUrl = "https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf";
  const fontRes = await fetch(fontUrl);
  if (!fontRes.ok) throw new Error(`Font fetch failed: ${fontRes.status}`);
  return fontRes.arrayBuffer();
}

// ─── Save image ───────────────────────────────────────────────────────────────
async function saveImage(buffer: Buffer, prefix: string): Promise<string> {
  const filename = `${prefix}_${crypto.randomUUID()}.png`;
  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, buffer, { access: "public", contentType: "image/png" });
    return blob.url;
  }
  return `/api/uploads/${filename}`;
}

// ─── Main: compose translated image ──────────────────────────────────────────
async function composeImage(
  payloadId: string,
  imageUrl: string,
  segments: Array<{ translatedText: string; boxX: number; boxY: number; boxWidth: number; boxHeight: number; fontWeight?: number; color?: string; textAlign?: string; semanticRole: string }>,
  targetLanguage: string,
): Promise<string | null> {
  // Fetch original image with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let imgRes;
  try {
    imgRes = await fetch(imageUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!imgRes.ok) return null;
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  // Skip very large images that would cause timeout
  if (imgBuffer.length > 2 * 1024 * 1024) return null; // >2MB skip
  const meta = await sharp(imgBuffer).metadata();
  const imgW = meta.width || 800;
  const imgH = meta.height || 800;

  const visible = segments.filter(s => s.semanticRole !== "WATERMARK" && s.translatedText?.trim());
  if (visible.length === 0) return null;

  // Fetch font
  const allText = visible.map(s => s.translatedText).join("");
  const fontFamily = getFontFamily(targetLanguage);
  const fontBuffer = await fetchFont(fontFamily, allText);

  // Normalize coordinates
  const maxCoord = Math.max(...visible.map(s => Math.max(s.boxX + s.boxWidth, s.boxY + s.boxHeight)));
  const norm = maxCoord > 1.5 ? (maxCoord > 100 ? 1000 : maxCoord) : 1;

  const MAX_DIM = 400;
  let safeW = imgW;
  let safeH = imgH;
  if (safeW > MAX_DIM || safeH > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / safeW, MAX_DIM / safeH);
    safeW = Math.round(safeW * ratio);
    safeH = Math.round(safeH * ratio);
  }

  // Resize image to safe dimensions before embedding
  const resizedBuffer = await sharp(imgBuffer)
    .resize(safeW, safeH, { fit: "inside" })
    .jpeg({ quality: 80 })
    .toBuffer();

  const imgBase64 = resizedBuffer.toString("base64");
  const imgMime = "image/jpeg";

  // Build Satori element tree
  const element = {
    type: "div" as const,
    props: {
      style: { display: "flex", width: "100%", height: "100%", position: "relative" as const },
      children: [
        {
          type: "img" as const,
          props: {
            src: `data:${imgMime};base64,${imgBase64}`,
            style: { position: "absolute" as const, top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" as const },
          },
        },
        ...visible.map(seg => {
          const x = seg.boxX / norm;
          const y = seg.boxY / norm;
          const w = seg.boxWidth / norm;
          const h = seg.boxHeight / norm;
          const boxHPx = h * safeH;
          const fontSize = Math.max(8, Math.min(boxHPx * 0.65, 60));

          return {
            type: "div" as const,
            props: {
              style: {
                position: "absolute" as const,
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${w * 100}%`,
                height: `${h * 100}%`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.85)",
                borderRadius: "6px",
                padding: "4px 8px",
                overflow: "hidden",
              },
              children: {
                type: "span" as const,
                props: {
                  style: {
                    color: seg.color || "#FFFFFF",
                    fontSize: `${fontSize}px`,
                    fontWeight: seg.fontWeight || 700,
                    textAlign: "center" as const,
                    lineHeight: 1.2,
                    wordBreak: "break-word" as const,
                  },
                  children: seg.translatedText,
                },
              },
            },
          };
        }),
      ],
    },
  };

  // Render with Satori → SVG → PNG
  const svg = await satori(element as any, {
    width: safeW,
    height: safeH,
    fonts: [{ name: fontFamily.replace(/\+/g, " "), data: fontBuffer, weight: 400, style: "normal" as const }],
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width" as const, value: safeW } });
  const pngBuffer = Buffer.from(resvg.render().asPng());

  // Save to blob
  const url = await saveImage(pngBuffer, "translated");

  // Update payload
  await prisma.translationPayload.update({
    where: { id: payloadId },
    data: { translatedImageUrl: url },
  });

  return url;
}

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "1"), 5);

  try {
    const payloads = await prisma.translationPayload.findMany({
      where: { translatedImageUrl: null, segments: { some: {} } },
      include: {
        post: { include: { images: { take: 1, orderBy: { orderIndex: "asc" }, select: { originalUrl: true } } } },
        segments: { select: { translatedText: true, boxX: true, boxY: true, boxWidth: true, boxHeight: true, fontWeight: true, color: true, textAlign: true, semanticRole: true } },
      },
      take: limit,
      orderBy: { createdAt: "asc" },
    });

    if (payloads.length === 0) {
      const total = await prisma.translationPayload.count();
      const withImage = await prisma.translationPayload.count({ where: { translatedImageUrl: { not: null } } });
      return NextResponse.json({ message: "All done!", total, withImage });
    }

    const results: Array<{ id: string; ok: boolean; url?: string; error?: string }> = [];

    for (const p of payloads) {
      const imageUrl = p.post.images[0]?.originalUrl;
      if (!imageUrl) { results.push({ id: p.id, ok: false, error: "no image" }); continue; }

      try {
        const url = await composeImage(p.id, imageUrl, p.segments as any, p.targetLanguage);
        if (!url) {
          // Mark as skipped (too large, no visible segments, etc.)
          await prisma.translationPayload.update({
            where: { id: p.id },
            data: { translatedImageUrl: "SKIPPED" },
          }).catch(() => {});
        }
        results.push({ id: p.id, ok: !!url, url: url || undefined });
      } catch (e: any) {
        // Mark as skipped so we don't retry forever
        await prisma.translationPayload.update({
          where: { id: p.id },
          data: { translatedImageUrl: "SKIPPED" },
        }).catch(() => {});
        results.push({ id: p.id, ok: false, error: e.message?.slice(0, 100) });
      }
    }

    const remaining = await prisma.translationPayload.count({
      where: { translatedImageUrl: null, segments: { some: {} } },
    });

    return NextResponse.json({ processed: results.length, results, remaining });
  } catch (error: any) {
    console.error("Generate images error:", error);
    return NextResponse.json({ error: error.message?.slice(0, 200) }, { status: 500 });
  }
}
