import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// ----------------------------------------------------------------------
// Font family mapping per language (Google Fonts URL format)
// ----------------------------------------------------------------------
function getFontFamily(lang: string): string {
  switch (lang) {
    case "ko": return "Noto+Sans+KR";
    case "ja": return "Noto+Sans+JP";
    case "zh": return "Noto+Sans+SC";
    case "ar": return "Noto+Sans+Arabic";
    case "hi": return "Noto+Sans+Devanagari";
    default:   return "Noto+Sans"; // en, es, etc.
  }
}

// ----------------------------------------------------------------------
// Fetch Google Font with text subsetting (only needed glyphs)
// ----------------------------------------------------------------------
async function fetchGoogleFont(
  fontFamily: string,
  textToRender: string
): Promise<ArrayBuffer> {
  // Deduplicate characters for minimal font subset
  const uniqueChars = Array.from(new Set(textToRender.split(""))).join("");

  const url = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@900&text=${encodeURIComponent(uniqueChars)}`;

  // Safari 5 User-Agent to get woff format (most compatible with Satori)
  const css = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
    },
  }).then((res) => res.text());

  // Extract font file URL from CSS
  const resource = css.match(
    /src: url\((.+)\) format\('(woff|woff2|truetype)'\)/
  );
  if (!resource) {
    throw new Error(`Google Font download failed for ${fontFamily}`);
  }

  const fontResponse = await fetch(resource[1]);
  return fontResponse.arrayBuffer();
}

// ----------------------------------------------------------------------
// POST /api/translate/compose-image
// ----------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const { cleanUrl, segments, width, height, targetLanguage } =
      await req.json();

    if (!cleanUrl || !segments || !width || !height) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Filter out WATERMARK segments
    const visibleSegments = (segments as Array<Record<string, unknown>>).filter(
      (s) => s.semanticRole !== "WATERMARK" && (s.translatedText as string)?.trim()
    );

    if (visibleSegments.length === 0) {
      const imgRes = await fetch(cleanUrl);
      return new Response(imgRes.body, {
        headers: {
          "Content-Type": imgRes.headers.get("Content-Type") || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Determine coordinate normalization (0-1 vs 0-1000)
    const maxCoord = Math.max(
      ...visibleSegments.map((s: any) =>
        Math.max(
          s.boxX ?? s.box?.x ?? 0,
          s.boxY ?? s.box?.y ?? 0,
          (s.boxX ?? s.box?.x ?? 0) + (s.boxWidth ?? s.box?.width ?? 0),
          (s.boxY ?? s.box?.y ?? 0) + (s.boxHeight ?? s.box?.height ?? 0)
        )
      )
    );
    const norm = maxCoord > 1.5 ? (maxCoord > 100 ? 1000 : maxCoord) : 1;

    // 1. Collect ALL translated text for font subsetting
    const fullText = visibleSegments
      .map((seg: any) => seg.translatedText)
      .join("");

    // 2. Download optimized font
    const fontFamily = getFontFamily(targetLanguage || "en");
    const fontBuffer = await fetchGoogleFont(fontFamily, fullText);

    // 3. Cap dimensions for Satori memory safety
    const safeW = Math.min(width, 2048);
    const safeH = Math.min(height, 2048);
    const isRTL = targetLanguage === "ar";

    // 4. Compose with Satori
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            position: "relative",
            direction: isRTL ? "rtl" : "ltr",
          }}
        >
          {/* Clean background image (text removed by LaMa) */}
          <img
            src={cleanUrl}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Translated text segments */}
          {visibleSegments.map((seg: any, i: number) => {
            // Support both DB format (boxX) and API format (box.x)
            const x = (seg.boxX ?? seg.box?.x ?? 0) / norm;
            const y = (seg.boxY ?? seg.box?.y ?? 0) / norm;
            const w = (seg.boxWidth ?? seg.box?.width ?? 0) / norm;
            const h = (seg.boxHeight ?? seg.box?.height ?? 0) / norm;

            // Auto-calculate font size: 25% of box height, min 14px
            const fontSize = Math.max(
              14,
              h * safeH * 0.25
            );

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${w * 100}%`,
                  height: `${h * 100}%`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  fontFamily: '"Noto Sans"',
                  fontSize: `${fontSize}px`,
                  color: "#FFFFFF",
                  textShadow:
                    "-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, " +
                    "-2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000, " +
                    "0 0 8px rgba(0,0,0,0.8)",
                  lineHeight: 1.2,
                  wordBreak: "keep-all" as const,
                  overflowWrap: "break-word" as const,
                }}
              >
                {seg.translatedText}
              </div>
            );
          })}
        </div>
      ),
      {
        width: safeW,
        height: safeH,
        fonts: [
          {
            name: "Noto Sans",
            data: fontBuffer,
            style: "normal" as const,
            weight: 900 as const,
          },
        ],
      }
    );
  } catch (e: any) {
    console.error("compose-image error:", e);
    return new Response(
      JSON.stringify({ error: "Image generation failed", details: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
