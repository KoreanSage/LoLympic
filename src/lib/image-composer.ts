/**
 * Image Composer — Generate translated meme images using Sharp.
 *
 * Strategy: Clean Image (text removed) + SVG text overlay = final image
 *
 * This replaces the unreliable Gemini image editing approach with
 * deterministic, pixel-perfect text rendering via Sharp + SVG.
 *
 * Pipeline:
 *   1. Start with the clean image (text removed via Gemini inpainting)
 *   2. Build an SVG overlay with translated text at exact coordinates
 *   3. Composite the SVG onto the clean image using Sharp
 *   4. Output final PNG/JPEG
 */

import sharp from "sharp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextSegment {
  translatedText: string;
  /** Bounding box in fractional coordinates (0.0 - 1.0) */
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  /** Style info */
  fontFamily?: string;
  fontWeight?: number;
  fontSizePixels?: number;
  color?: string;
  textAlign?: string;
  strokeColor?: string;
  strokeWidth?: number;
  isUppercase?: boolean;
  semanticRole?: string;
}

// ---------------------------------------------------------------------------
// SVG text rendering helpers
// ---------------------------------------------------------------------------

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Estimate optimal font size so text fits within the bounding box.
 *
 * Uses a simple heuristic: calculate based on box dimensions and text length.
 * For CJK text, characters are roughly square. For Latin, roughly 0.55x height.
 */
function estimateFontSize(
  text: string,
  boxWidthPx: number,
  boxHeightPx: number,
  originalSize?: number,
): number {
  if (!text) return 14;

  // Check if CJK
  const hasCJK = /[\u4e00-\u9fff\uac00-\ud7af\u3040-\u30ff]/.test(text);
  const charWidthRatio = hasCJK ? 1.0 : 0.58;

  // Ignore originalSize if it's too small relative to the box —
  // Gemini often returns tiny font sizes based on source image
  const minReasonableSize = Math.max(16, Math.floor(boxHeightPx * 0.35));
  let size = (originalSize && originalSize >= minReasonableSize)
    ? originalSize
    : Math.floor(boxHeightPx * 0.65);

  // Estimate how many chars fit per line at this size
  const charsPerLine = Math.floor(boxWidthPx / (size * charWidthRatio));
  if (charsPerLine <= 0) return Math.max(16, Math.floor(boxWidthPx * 0.8));

  const lineCount = Math.ceil(text.length / Math.max(1, charsPerLine));
  const lineHeight = 1.35;
  const totalHeight = lineCount * size * lineHeight;

  // Scale down if text overflows vertically
  if (totalHeight > boxHeightPx && boxHeightPx > 0) {
    const scale = boxHeightPx / totalHeight;
    size = Math.floor(size * scale);
  }

  // Clamp — minimum 16px for readability
  return Math.max(16, Math.min(size, 120));
}

/**
 * Word-wrap text for SVG <tspan> rendering.
 * Returns array of lines that fit within the given width.
 */
function wrapText(
  text: string,
  maxWidthPx: number,
  fontSize: number,
): string[] {
  const hasCJK = /[\u4e00-\u9fff\uac00-\ud7af\u3040-\u30ff]/.test(text);
  const charWidth = fontSize * (hasCJK ? 1.0 : 0.58);
  const maxChars = Math.max(1, Math.floor(maxWidthPx / charWidth));

  if (text.length <= maxChars) return [text];

  const lines: string[] = [];

  if (hasCJK) {
    // Character-by-character wrapping for CJK
    for (let i = 0; i < text.length; i += maxChars) {
      lines.push(text.slice(i, i + maxChars));
    }
  } else {
    // Word-based wrapping for Latin
    const words = text.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (test.length <= maxChars) {
        currentLine = test;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

/**
 * Fetch a Google Font and return it as a base64-encoded woff data URI.
 * Used to embed fonts in SVG for server-side rendering where system fonts
 * may not include Arabic, Hindi, etc.
 */
/** In-memory font cache with max 20 entries (LRU-style eviction) */
const _fontCache = new Map<string, { base64: string; format: string }>();
const FONT_CACHE_MAX = 20;

async function fetchFontAsBase64(fontFamily: string, _text?: string, weight: number = 700): Promise<{ base64: string; format: string } | null> {
  const cacheKey = `${fontFamily}:${weight}`;
  const cached = _fontCache.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    // Fetch FULL font (no text= subset) to avoid missing glyphs for
    // special characters like smart quotes, emoji, ligatures, etc.
    //
    // UA header is critical — without it, Google Fonts returns woff2
    // (modern) which older resvg-js builds can't parse. With an old
    // Safari UA, Google falls back to TTF/woff which is reliably supported.
    const cssUrl = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${weight}`;
    const cssRes = await fetch(cssUrl, {
      headers: {
        // Old Safari UA → Google serves TTF (maximally compatible)
        "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
      signal: controller.signal,
    });
    if (!cssRes.ok) { clearTimeout(timeout); return null; }
    const css = await cssRes.text();
    // Prefer truetype > woff > woff2 (most compatible with resvg-js)
    // Note: Google may return multiple @font-face blocks — find any supported one
    const matches = Array.from(css.matchAll(/src:\s*url\(([^)]+)\)\s*format\('(woff2?|truetype)'\)/g));
    const preferred = matches.find((m) => m[2] === "truetype")
      || matches.find((m) => m[2] === "woff")
      || matches[0];
    if (!preferred?.[1]) { clearTimeout(timeout); return null; }
    const fontUrl = preferred[1];
    const fontFormat = preferred[2];
    const fontRes = await fetch(fontUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!fontRes.ok) return null;
    const buf = Buffer.from(await fontRes.arrayBuffer());
    const result = { base64: buf.toString("base64"), format: fontFormat };
    if (_fontCache.size >= FONT_CACHE_MAX) {
      const oldest = _fontCache.keys().next().value;
      if (oldest) _fontCache.delete(oldest);
    }
    _fontCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Detect if text contains characters that need a specific Noto Sans variant.
 * Returns the Google Fonts family name if a special font is needed.
 */
function detectFontForText(text: string): string | null {
  if (/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)) return "Noto+Sans+Arabic";
  // Hinglish uses Roman script, so Devanagari detection is no longer needed for Hindi translations
  // if (/[\u0900-\u097F]/.test(text)) return "Noto+Sans+Devanagari";
  return null;
}

/**
 * Generate an SVG text overlay for all segments.
 * If embedFont is provided, it will be embedded as @font-face in the SVG.
 */
function buildSvgOverlay(
  segments: TextSegment[],
  imageWidth: number,
  imageHeight: number,
  fontFace?: { familyName: string; base64: string; format: string },
): string {
  const elements: string[] = [];

  for (const seg of segments) {
    if (!seg.translatedText?.trim()) continue;

    // Skip non-translatable metadata
    if (seg.semanticRole === "LABEL" || seg.semanticRole === "WATERMARK") continue;

    // Convert fractional coords to pixels
    const x = Math.round(seg.boxX * imageWidth);
    const y = Math.round(seg.boxY * imageHeight);
    const w = Math.round(seg.boxWidth * imageWidth);
    const h = Math.round(seg.boxHeight * imageHeight);

    if (w <= 0 || h <= 0) continue;

    const text = seg.isUppercase ? seg.translatedText.toUpperCase() : seg.translatedText;
    // Use provided color, default to white for meme overlay readability
    const color = seg.color || "#FFFFFF";
    // Always add contrasting stroke: dark text gets white stroke, light text gets black stroke
    const isLightColor = /^#(f|e|d|c)/i.test(color) || color.toLowerCase() === "#ffffff" || color === "white";
    const strokeColor = seg.strokeColor || (isLightColor ? "#000000" : "#FFFFFF");
    const strokeWidth = seg.strokeWidth || 2;
    const fontWeight = seg.fontWeight || 700;
    const fontFamily = mapFontFamily(seg.fontFamily);
    const align = (seg.textAlign || "CENTER").toLowerCase();

    // Calculate font size
    const fontSize = estimateFontSize(text, w, h, seg.fontSizePixels);
    const lineHeight = fontSize * 1.35;

    // Word wrap
    const lines = wrapText(text, w, fontSize);

    // Calculate text anchor and x position based on alignment
    let textAnchor = "start";
    let textX = x;
    if (align === "center") {
      textAnchor = "middle";
      textX = x + w / 2;
    } else if (align === "right") {
      textAnchor = "end";
      textX = x + w;
    }

    // Vertical centering
    const totalTextHeight = lines.length * lineHeight;
    const startY = y + (h - totalTextHeight) / 2 + fontSize;

    // Build tspan elements for each line
    const tspans = lines.map((line, i) => {
      const ly = Math.round(startY + i * lineHeight);
      return `<tspan x="${textX}" y="${ly}">${escapeXml(line)}</tspan>`;
    }).join("");

    const safeFontFamily = escapeXml(fontFamily);
    // RTL direction for Arabic text so shaping/ligatures render correctly
    const isArabic = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
    const directionAttr = isArabic ? ' direction="rtl"' : '';
    // Stroke (outline) for meme text readability
    elements.push(
      `<text font-family="${safeFontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" ` +
      `text-anchor="${textAnchor}"${directionAttr} fill="${strokeColor}" ` +
      `stroke="${strokeColor}" stroke-width="${strokeWidth * 2}" stroke-linejoin="round" ` +
      `paint-order="stroke">${tspans}</text>`
    );

    // Main text
    elements.push(
      `<text font-family="${safeFontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" ` +
      `text-anchor="${textAnchor}"${directionAttr} fill="${color}">${tspans}</text>`
    );
  }

  const fontFaceBlock = fontFace
    ? `<defs><style>@font-face { font-family: '${fontFace.familyName}'; src: url(data:font/${fontFace.format};base64,${fontFace.base64}) format('${fontFace.format}'); }</style></defs>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
${fontFaceBlock}
${elements.join("\n")}
</svg>`;
}

/**
 * Map font hints to system-available font families.
 */
function mapFontFamily(hint?: string): string {
  if (!hint) return "Arial, Helvetica, sans-serif";
  const h = hint.toLowerCase();
  if (h.includes("impact")) return "Impact, Arial Black, sans-serif";
  if (h.includes("gothic") || h.includes("맑은")) return "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
  // Keep specific Noto Sans variants intact (Arabic, KR, JP, SC, etc.)
  if (h.includes("noto sans arabic")) return "'Noto Sans Arabic', sans-serif";
  if (h.includes("noto sans kr")) return "'Noto Sans KR', sans-serif";
  if (h.includes("noto sans jp")) return "'Noto Sans JP', sans-serif";
  if (h.includes("noto sans sc")) return "'Noto Sans SC', sans-serif";
  if (h.includes("noto")) return "'Noto Sans', 'Noto Sans CJK', sans-serif";
  if (h.includes("serif")) return "Georgia, 'Times New Roman', serif";
  if (h.includes("mono")) return "'Courier New', monospace";
  return "Arial, Helvetica, sans-serif";
}

// ---------------------------------------------------------------------------
// Watermark helpers
// ---------------------------------------------------------------------------

import * as path from "path";

const WATERMARK_HEIGHT_RATIO = 0.05; // 5% of image height for the bar
const WATERMARK_MIN_HEIGHT = 28;
const WATERMARK_MAX_HEIGHT = 56;
const WATERMARK_BG_COLOR = "#000000";
const WATERMARK_SEPARATOR_COLOR = "#333333";

/** Cached watermark logo buffer (loaded once) */
let _watermarkLogoCache: Buffer | null = null;

/**
 * Load the watermark logo PNG from public/watermark-logo.png.
 * Cached in memory after first load.
 */
async function loadWatermarkLogo(): Promise<Buffer> {
  if (_watermarkLogoCache) return _watermarkLogoCache;
  const fsp = await import("fs/promises");
  const logoPath = path.join(process.cwd(), "public", "watermark-logo.png");
  _watermarkLogoCache = await fsp.readFile(logoPath);
  return _watermarkLogoCache;
}

/**
 * Build watermark bar: black strip with separator + centered logo image.
 * Returns the composited bar as a Buffer.
 */
async function buildWatermarkBar(imageWidth: number, barHeight: number): Promise<Buffer> {
  const logo = await loadWatermarkLogo();

  // Resize logo to fit within bar (60% of bar height, maintain aspect ratio)
  const logoTargetHeight = Math.max(10, Math.round(barHeight * 0.5));
  const resizedLogo = await sharp(logo)
    .resize({ height: logoTargetHeight, fit: "inside" })
    .png()
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const logoWidth = logoMeta.width || 100;
  const logoHeight = logoMeta.height || logoTargetHeight;

  // Center the logo in the bar
  const logoLeft = Math.round((imageWidth - logoWidth) / 2);
  const logoTop = Math.round((barHeight - logoHeight) / 2);
  const separatorHeight = Math.max(1, Math.round(barHeight * 0.03));

  // Build separator SVG
  const separatorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${separatorHeight}">
    <rect width="${imageWidth}" height="${separatorHeight}" fill="${WATERMARK_SEPARATOR_COLOR}"/>
  </svg>`;

  return sharp({
    create: {
      width: imageWidth,
      height: barHeight,
      channels: 4,
      background: WATERMARK_BG_COLOR,
    },
  })
    .composite([
      { input: Buffer.from(separatorSvg), top: 0, left: 0 },
      { input: resizedLogo, top: logoTop, left: logoLeft },
    ])
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// Main composer function
// ---------------------------------------------------------------------------

/**
 * Compose a translated meme image:
 *   Clean image (background) + SVG text overlay + watermark bar → final image
 *
 * @param cleanImageBuffer - The clean image (text removed via inpainting)
 * @param segments - Translated text segments with positioning
 * @param options - Output options
 * @returns Final composed image as Buffer
 */
export async function composeTranslatedImage(
  cleanImageBuffer: Buffer,
  segments: TextSegment[],
  options: {
    format?: "png" | "jpeg" | "webp";
    quality?: number;
    watermark?: boolean;
  } = {},
): Promise<Buffer> {
  const { format = "png", quality = 90, watermark = true } = options;

  // Get image dimensions
  const metadata = await sharp(cleanImageBuffer).metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Filter to only translatable segments
  const translatableSegments = segments.filter(
    (s) => s.semanticRole !== "LABEL" && s.semanticRole !== "WATERMARK" && s.translatedText?.trim()
  );

  // Watermark bar dimensions
  const barHeight = watermark
    ? Math.min(WATERMARK_MAX_HEIGHT, Math.max(WATERMARK_MIN_HEIGHT, Math.round(height * WATERMARK_HEIGHT_RATIO)))
    : 0;
  const finalHeight = height + barHeight;

  // Build text overlay (on original image area)
  const composites: sharp.OverlayOptions[] = [];

  if (translatableSegments.length > 0) {
    // Detect if we need a special font (Arabic, Hindi, etc.)
    const allText = translatableSegments.map(s => s.translatedText).join("");
    const specialFont = detectFontForText(allText);
    let fontData: { base64: string; format: string } | null = null;

    if (specialFont) {
      fontData = await fetchFontAsBase64(specialFont, allText);
      if (fontData) {
        const familyName = specialFont.replace(/\+/g, " ");
        // Override font family in segments to match the fetched font
        for (const seg of translatableSegments) {
          seg.fontFamily = familyName;
        }
      }
    }

    const svgFontFace = (specialFont && fontData)
      ? { familyName: specialFont.replace(/\+/g, " "), base64: fontData.base64, format: fontData.format }
      : undefined;
    const svgOverlay = buildSvgOverlay(translatableSegments, width, height, svgFontFace);

    if (specialFont && fontData) {
      // Use resvg-js with font file for non-Latin scripts (Arabic, Hindi).
      // Sharp's librsvg cannot load custom fonts.
      //
      // CRITICAL FIXES:
      //  1. Use the correct extension matching the actual format so resvg
      //     can parse it (.woff2 vs .woff). Mis-labeled woff2 files break
      //     resvg silently and produce a blank overlay.
      //  2. Set defaultFontFamily to the Arabic family so resvg uses it as
      //     the fallback when it can't match the CSS font-family exactly.
      //  3. Enable loadSystemFonts as a secondary fallback — if fontFiles
      //     fails for any reason, system fonts can still render SOMETHING.
      const os = await import("os");
      const fsp = await import("fs/promises");
      const familyName = specialFont.replace(/\+/g, " ");
      const ext = fontData.format === "woff2" ? ".woff2"
        : fontData.format === "truetype" ? ".ttf"
        : ".woff";
      const fontPath = path.join(os.tmpdir(), `mimzy-font-${specialFont.replace(/\+/g, "-")}${ext}`);
      const fontBuf = Buffer.from(fontData.base64, "base64");
      await fsp.writeFile(fontPath, fontBuf);

      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svgOverlay, {
        fitTo: { mode: "width" as const, value: width },
        font: {
          loadSystemFonts: true,
          fontFiles: [fontPath],
          defaultFontFamily: familyName,
          sansSerifFamily: familyName,
        },
      });
      const overlayPng = Buffer.from(resvg.render().asPng());
      composites.push({ input: overlayPng, top: 0, left: 0 });
    } else {
      composites.push({ input: Buffer.from(svgOverlay), top: 0, left: 0 });
    }
  }

  // Build watermark bar (image-based logo)
  if (watermark && barHeight > 0) {
    const wmBar = await buildWatermarkBar(width, barHeight);
    composites.push({ input: wmBar, top: height, left: 0 });
  }

  // Extend canvas downward to fit watermark, then composite everything
  let pipeline = sharp(cleanImageBuffer)
    .extend({
      top: 0,
      bottom: barHeight,
      left: 0,
      right: 0,
      background: WATERMARK_BG_COLOR,
    })
    .composite(composites);

  // Output format
  if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality });
  } else {
    pipeline = pipeline.png({ compressionLevel: 6 });
  }

  return pipeline.toBuffer();
}

/**
 * Compose a translated image from a URL (fetches the clean image first).
 */
export async function composeFromUrl(
  cleanImageUrl: string,
  segments: TextSegment[],
  options?: { format?: "png" | "jpeg" | "webp"; quality?: number },
): Promise<Buffer> {
  // Fetch the clean image
  const response = await fetch(cleanImageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch clean image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const cleanBuffer = Buffer.from(arrayBuffer);

  return composeTranslatedImage(cleanBuffer, segments, options);
}
