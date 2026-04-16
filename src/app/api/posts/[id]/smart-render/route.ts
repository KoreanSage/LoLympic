import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import sharp from "sharp";
import crypto from "crypto";
import { uploadBufferToR2, deleteFromR2 } from "@/lib/storage";
import { calculateFontSize } from "@/lib/font-size";

export const maxDuration = 60;

// Per-request font fetch timeout — Google Fonts CDN can hang otherwise.
const FONT_FETCH_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = FONT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/posts/:id/smart-render
 *
 * Admin-only: Re-renders translated images for a post using the ORIGINAL image
 * (no LaMa inpainting) with opaque background rects over text areas.
 *
 * Use when LaMa distorts the photo (e.g., caption bar memes where text
 * is in a separate area from the image content).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: postId } = await params;

    // Get post image
    const postImage = await prisma.postImage.findFirst({
      where: { postId },
      orderBy: { orderIndex: "asc" },
      select: { originalUrl: true },
    });

    if (!postImage?.originalUrl) {
      return NextResponse.json({ error: "No image found" }, { status: 404 });
    }

    // Get all translation payloads with segments. Cap at 7 (one per
    // supported target language) so a post with historical versions
    // doesn't multiply memory usage — each payload holds a decoded image
    // buffer during composition.
    const payloads = await prisma.translationPayload.findMany({
      where: { postId, status: { in: ["COMPLETED", "APPROVED"] } },
      include: { segments: true },
      orderBy: { version: "desc" },
      take: 7,
    });

    if (payloads.length === 0) {
      return NextResponse.json({ error: "No translations found" }, { status: 404 });
    }

    // Fetch original image
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || (process.env.NEXTAUTH_URL)
      || "http://localhost:3000";

    const originalUrl = postImage.originalUrl.startsWith("http")
      ? postImage.originalUrl
      : `${appUrl}${postImage.originalUrl}`;

    const imgRes = await fetch(originalUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: "Failed to fetch original image" }, { status: 500 });
    }
    const originalBuffer = Buffer.from(await imgRes.arrayBuffer());
    const metadata = await sharp(originalBuffer).metadata();
    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 800;

    // Storage setup — R2 is the sole production backend.
    const saveImage = async (buffer: Buffer, prefix: string): Promise<string> => {
      const filename = `${prefix}_${crypto.randomUUID()}.webp`;
      const url = await uploadBufferToR2(buffer, `uploads/${filename}`, "image/webp");
      if (!url) throw new Error("R2 not configured");
      return url;
    };

    // Pre-compute the Satori-compatible data URI once (shared across all languages).
    // Satori only supports PNG/JPEG, so decode WebP → PNG if needed.
    const satoriBuffer = metadata.format === "webp"
      ? Buffer.from(await sharp(originalBuffer).png().toBuffer())
      : originalBuffer;
    const cachedBase64 = satoriBuffer.toString("base64");
    const cachedMime = metadata.format === "jpeg" ? "image/jpeg" : "image/png";
    const cachedDataUri = `data:${cachedMime};base64,${cachedBase64}`;

    // Re-render each language using ORIGINAL image + opaque rects.
    // Large intermediate buffers (`composedBuffer`, `pngBuffer`, `webpBuffer`)
    // are declared inside the loop and explicitly cleared at the end of each
    // iteration so GC can reclaim memory between renders — important when a
    // post has 7+ languages with multi-MB source images.
    let rendered = 0;
    let failed = 0;

    for (const payload of payloads) {
      if (!payload.segments || payload.segments.length === 0) continue;

      let composedBuffer: Buffer | null = null;
      let pngBuffer: Buffer | null = null;
      let webpBuffer: Buffer | null = null;
      let satoriPngBase64: string | null = null;

      try {
        const visibleSegments = payload.segments.filter(
          (s) => s.semanticRole !== "WATERMARK" && s.translatedText?.trim()
        );
        if (visibleSegments.length === 0) continue;

        // For Arabic: use Sharp-based image-composer
        if (payload.targetLanguage === "ar") {
          const { composeTranslatedImage } = await import("@/lib/image-composer");
          const composerSegments = visibleSegments.map(s => ({
            translatedText: s.translatedText || "",
            boxX: s.boxX ?? 0,
            boxY: s.boxY ?? 0,
            boxWidth: s.boxWidth ?? 0,
            boxHeight: s.boxHeight ?? 0,
            fontFamily: s.fontFamily || undefined,
            fontWeight: s.fontWeight || undefined,
            fontSizePixels: s.fontSizePixels || undefined,
            color: s.color || undefined,
            textAlign: s.textAlign || undefined,
            strokeColor: s.strokeColor || undefined,
            strokeWidth: s.strokeWidth || undefined,
            semanticRole: s.semanticRole || undefined,
          }));
          const composedRaw = await composeTranslatedImage(originalBuffer, composerSegments, { watermark: false });
          const sharpMod = (await import("sharp")).default;
          composedBuffer = await sharpMod(composedRaw).webp({ quality: 70 }).toBuffer();
          // Delete old image from R2 before saving new one
          if (payload.translatedImageUrl && payload.translatedImageUrl !== "SKIPPED") {
            deleteFromR2(payload.translatedImageUrl).catch(() => {});
          }
          const url = await saveImage(composedBuffer, `smart_ar`);
          await prisma.translationPayload.update({ where: { id: payload.id }, data: { translatedImageUrl: url } });
          rendered++;
          continue;
        }

        // For other languages: Satori rendering with ORIGINAL image + opaque rects
        const fullText = visibleSegments.map(s => s.translatedText).join("");

        // Fetch font (each network call bounded by FONT_FETCH_TIMEOUT_MS)
        const getFontFamily = (lang: string) => {
          switch (lang) {
            case "ko": return "Noto+Sans+KR";
            case "ja": return "Noto+Sans+JP";
            case "zh": return "Noto+Sans+SC";
            default: return "Noto+Sans";
          }
        };
        const fontFamily = getFontFamily(payload.targetLanguage);
        const weights = [900, 700, 400];
        let fontBuffer: ArrayBuffer | null = null;
        for (const w of weights) {
          try {
            const cssUrl = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${w}`;
            const cssRes = await fetchWithTimeout(cssUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1" },
            });
            if (!cssRes.ok) continue;
            const css = await cssRes.text();
            const match = css.match(/src: url\((.+)\) format\('(woff|woff2|truetype)'\)/);
            if (!match?.[1]) continue;
            const fontRes = await fetchWithTimeout(match[1]);
            if (!fontRes.ok) continue;
            fontBuffer = await fontRes.arrayBuffer();
            break;
          } catch (fontErr) {
            console.warn(`[smart-render] font weight ${w} failed:`, fontErr);
            continue;
          }
        }
        if (!fontBuffer) { failed++; continue; }

        // Coordinate normalization — Gemini returns box coords in one of:
        //   (a) fractional 0..1 (relative to image),
        //   (b) the Gemini 1000-scale that exceeds the natural image dims,
        //   (c) raw pixels within the natural image dims.
        // Pick `norm` so `box / norm` lands in 0..1.
        const maxCoord = visibleSegments.reduce((acc, s) => {
          const x2 = (s.boxX ?? 0) + (s.boxWidth ?? 0);
          const y2 = (s.boxY ?? 0) + (s.boxHeight ?? 0);
          return Math.max(acc, x2, y2);
        }, 0);
        let norm: number;
        if (maxCoord <= 1.05) {
          norm = 1; // already fractional
        } else if (maxCoord > imgWidth || maxCoord > imgHeight) {
          // Exceeds natural dims → treat as 1000-scale (Gemini default)
          norm = 1000;
        } else {
          // Within natural dims → raw pixels
          norm = Math.max(imgWidth, imgHeight);
        }
        const safeW = Math.min(imgWidth, 2048);
        const safeH = Math.min(imgHeight, 2048);

        // Use pre-computed data URI (converted once outside the loop)
        const dataUri = cachedDataUri;

        // Build Satori element tree with OPAQUE background rects
        const element = {
          type: "div",
          props: {
            style: { display: "flex", width: "100%", height: "100%", position: "relative" as const },
            children: [
              {
                type: "img",
                props: {
                  src: dataUri,
                  style: { position: "absolute" as const, top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" as const },
                },
              },
              ...visibleSegments.map((seg) => {
                const x = (seg.boxX ?? 0) / norm;
                const y = (seg.boxY ?? 0) / norm;
                const w = (seg.boxWidth ?? 0) / norm;
                const h = (seg.boxHeight ?? 0) / norm;

                const fontSize = calculateFontSize({
                  text: seg.translatedText || "",
                  boxWidthPx: w * safeW,
                  boxHeightPx: h * safeH,
                  originalSizePx: seg.fontSizePixels ?? undefined,
                });

                const textColor = seg.color || "#FFFFFF";
                const isLight = textColor.toLowerCase().includes("fff") || textColor === "white";
                const strokeShadow = isLight
                  ? "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000"
                  : "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff";

                // OPAQUE background to cover original text
                const rawBg = (seg.backgroundColor || "").toLowerCase();
                const bgColor = rawBg && rawBg !== "transparent"
                  ? rawBg
                  : isLight ? "#000000" : "#FFFFFF";

                return {
                  type: "div",
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
                      textAlign: "center" as const,
                      fontFamily: "Noto Sans",
                      fontSize: `${fontSize}px`,
                      fontWeight: 900,
                      color: textColor,
                      backgroundColor: bgColor,
                      textShadow: strokeShadow,
                      lineHeight: 1.2,
                      padding: "2px 6px",
                      wordBreak: "keep-all" as const,
                      overflowWrap: "break-word" as const,
                    },
                    children: seg.translatedText,
                  },
                };
              }),
            ],
          },
        };

        const { default: satori } = await import("satori");
        // `element` is a hand-built Satori node tree. Satori's public type
        // (`ReactNode`) is stricter than what we build, so we cast through
        // `unknown` to document that the tree is intentionally non-React.
        const svg = await satori(element as unknown as Parameters<typeof satori>[0], {
          width: safeW,
          height: safeH,
          fonts: [{ name: "Noto Sans", data: Buffer.from(fontBuffer), style: "normal" as const, weight: 900 }],
        });

        const { Resvg } = await import("@resvg/resvg-js");
        const resvg = new Resvg(svg, { fitTo: { mode: "width" as const, value: safeW } });
        pngBuffer = Buffer.from(resvg.render().asPng());
        const sharpMod = (await import("sharp")).default;
        webpBuffer = await sharpMod(pngBuffer).webp({ quality: 70 }).toBuffer();
        // Release the intermediate PNG before we upload — it's typically
        // 2-3x larger than the webp, and we don't need it anymore.
        pngBuffer = null;
        satoriPngBase64 = null;
        // Delete old image from R2 before saving new one
        if (payload.translatedImageUrl && payload.translatedImageUrl !== "SKIPPED") {
          deleteFromR2(payload.translatedImageUrl).catch(() => {});
        }
        const url = await saveImage(webpBuffer, `smart_${payload.targetLanguage}`);
        await prisma.translationPayload.update({ where: { id: payload.id }, data: { translatedImageUrl: url } });
        rendered++;
      } catch (err) {
        console.error(`Smart render failed for ${payload.targetLanguage}:`, err);
        failed++;
      } finally {
        // Drop references so GC can reclaim large buffers before the next
        // iteration allocates more. Node's V8 heap would otherwise grow
        // linearly with payload count.
        composedBuffer = null;
        pngBuffer = null;
        webpBuffer = null;
        satoriPngBase64 = null;
      }
    }

    return NextResponse.json({
      success: true,
      rendered,
      failed,
      total: payloads.length,
    });
  } catch (err) {
    console.error("Smart render error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
