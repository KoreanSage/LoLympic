import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// ---------------------------------------------------------------------------
// Font family mapping per language
// ---------------------------------------------------------------------------
function getFontFamily(lang: string): string {
  const map: Record<string, string> = {
    ko: "Noto Sans KR",
    ja: "Noto Sans JP",
    zh: "Noto Sans SC",
    ar: "Noto Sans Arabic",
    hi: "Noto Sans Devanagari",
    en: "Impact",
    es: "Inter",
  };
  return map[lang] || "Inter";
}

// Google Fonts CSS URL mapping
function getGoogleFontUrl(family: string, weight: number, text: string): string {
  const encodedFamily = encodeURIComponent(family);
  const encodedText = encodeURIComponent(text);
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weight}&text=${encodedText}&display=swap`;
}

// ---------------------------------------------------------------------------
// Fetch Google Font binary with text subsetting (only glyphs used)
// ---------------------------------------------------------------------------
async function fetchGoogleFont(
  family: string,
  weight: number,
  text: string
): Promise<ArrayBuffer> {
  const url = getGoogleFontUrl(family, weight, text);

  const cssRes = await fetch(url, {
    headers: {
      // Pretend to be a browser so Google returns woff2/truetype
      "User-Agent":
        "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
    },
  });

  if (!cssRes.ok) {
    throw new Error(`Failed to fetch Google Fonts CSS for ${family}: ${cssRes.status}`);
  }

  const css = await cssRes.text();
  // Extract the font URL from the CSS @font-face src
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match?.[1]) {
    throw new Error(`No font URL found in CSS for ${family}`);
  }

  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) {
    throw new Error(`Failed to fetch font binary for ${family}: ${fontRes.status}`);
  }

  return fontRes.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Segment type from DB
// ---------------------------------------------------------------------------
interface ComposeSegment {
  translatedText: string;
  semanticRole: string;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  color?: string;
  strokeColor?: string;
  fontSizePixels?: number;
  fontWeight?: number;
  fontFamily?: string;
  textAlign?: string;
  isUppercase?: boolean;
  rotation?: number;
}

interface ComposeRequest {
  cleanUrl: string;
  segments: ComposeSegment[];
  width: number;
  height: number;
  targetLanguage: string;
}

// ---------------------------------------------------------------------------
// POST /api/translate/compose-image
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ComposeRequest;
    const { cleanUrl, segments: rawSegments, width, height, targetLanguage } = body;

    if (!cleanUrl || !rawSegments || !width || !height) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Filter out WATERMARK segments
    const segments = rawSegments.filter(
      (s) => s.semanticRole !== "WATERMARK"
    );

    if (segments.length === 0) {
      // No segments to render — just proxy the clean image
      const imgRes = await fetch(cleanUrl);
      return new Response(imgRes.body, {
        headers: {
          "Content-Type": imgRes.headers.get("Content-Type") || "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Determine the normalization factor for box coordinates
    // Segments may use 0-1 range or 0-1000 range (Gemini)
    const maxCoord = Math.max(
      ...segments.map((s) =>
        Math.max(s.boxX, s.boxY, s.boxX + s.boxWidth, s.boxY + s.boxHeight)
      )
    );
    const normFactor = maxCoord > 1.5 ? (maxCoord > 100 ? 1000 : maxCoord) : 1;

    // Collect all translated text to determine which glyphs we need
    const allText = segments.map((s) => s.translatedText).join("");
    const fontFamily = getFontFamily(targetLanguage);
    const defaultWeight = 700;

    // Fetch fonts — we need unique weight variants
    const weightSet = new Set<number>();
    weightSet.add(defaultWeight);
    for (const seg of segments) {
      if (seg.fontWeight) weightSet.add(seg.fontWeight);
    }

    const fontDataArr: { name: string; data: ArrayBuffer; weight: number; style: string }[] = [];

    // Fetch fonts in parallel
    const fontPromises = Array.from(weightSet).map(async (w) => {
      try {
        const data = await fetchGoogleFont(fontFamily, w, allText);
        fontDataArr.push({
          name: fontFamily,
          data,
          weight: w as any,
          style: "normal" as any,
        });
      } catch (err) {
        console.warn(`Font fetch failed for ${fontFamily}@${w}:`, err);
        // Try Inter as fallback
        if (fontFamily !== "Inter") {
          try {
            const data = await fetchGoogleFont("Inter", w, allText);
            fontDataArr.push({
              name: fontFamily, // Keep same name so Satori uses it
              data,
              weight: w as any,
              style: "normal" as any,
            });
          } catch {
            // Skip
          }
        }
      }
    });

    await Promise.all(fontPromises);

    // Build JSX for Satori
    const jsx = (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Background: clean image */}
        <img
          src={cleanUrl}
          width={width}
          height={height}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${height}px`,
            objectFit: "cover",
          }}
        />

        {/* Overlay: translated text segments */}
        {segments.map((seg, i) => {
          const text = seg.isUppercase
            ? seg.translatedText.toUpperCase()
            : seg.translatedText;

          // Normalize coordinates to pixel values
          const bx = (seg.boxX / normFactor) * width;
          const by = (seg.boxY / normFactor) * height;
          const bw = (seg.boxWidth / normFactor) * width;
          const bh = (seg.boxHeight / normFactor) * height;

          // Font size: use provided or auto-scale to fit box
          const fontSize = seg.fontSizePixels
            ? Math.min(seg.fontSizePixels, bh * 0.9)
            : Math.max(10, Math.min(bh * 0.65, bw / Math.max(text.length * 0.6, 1)));

          const weight = seg.fontWeight || defaultWeight;
          const color = seg.color || "#FFFFFF";
          const strokeColor = seg.strokeColor || "rgba(0,0,0,0.8)";
          const align = (seg.textAlign || "CENTER").toLowerCase() as
            | "left"
            | "center"
            | "right";

          return (
            <div
              key={i}
              style={{
                display: "flex",
                position: "absolute",
                left: `${bx}px`,
                top: `${by}px`,
                width: `${bw}px`,
                height: `${bh}px`,
                alignItems: "center",
                justifyContent:
                  align === "left"
                    ? "flex-start"
                    : align === "right"
                    ? "flex-end"
                    : "center",
                padding: "2px 4px",
                overflow: "hidden",
                ...(seg.rotation
                  ? { transform: `rotate(${seg.rotation}deg)` }
                  : {}),
              }}
            >
              <span
                style={{
                  fontFamily: `"${fontFamily}", sans-serif`,
                  fontSize: `${fontSize}px`,
                  fontWeight: weight,
                  color,
                  textAlign: align,
                  lineHeight: 1.2,
                  textShadow: `1px 1px 2px ${strokeColor}, -1px -1px 2px ${strokeColor}, 1px -1px 2px ${strokeColor}, -1px 1px 2px ${strokeColor}`,
                  wordBreak: "break-word" as const,
                  overflowWrap: "break-word" as const,
                  maxWidth: "100%",
                }}
              >
                {text}
              </span>
            </div>
          );
        })}
      </div>
    );

    // Render via Satori -> PNG
    const imageResponse = new ImageResponse(jsx, {
      width,
      height,
      fonts: fontDataArr.length > 0 ? fontDataArr as any : undefined,
    });

    return imageResponse;
  } catch (err) {
    console.error("compose-image error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to compose image", details: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
