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

  // Start from original size or estimate from box height
  let size = originalSize || Math.floor(boxHeightPx * 0.75);

  // Estimate how many chars fit per line at this size
  const charsPerLine = Math.floor(boxWidthPx / (size * charWidthRatio));
  if (charsPerLine <= 0) return Math.max(8, Math.floor(boxWidthPx * 0.8));

  const lineCount = Math.ceil(text.length / Math.max(1, charsPerLine));
  const lineHeight = 1.35;
  const totalHeight = lineCount * size * lineHeight;

  // Scale down if text overflows vertically
  if (totalHeight > boxHeightPx && boxHeightPx > 0) {
    const scale = boxHeightPx / totalHeight;
    size = Math.floor(size * scale);
  }

  // Clamp
  return Math.max(8, Math.min(size, 72));
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
async function fetchFontAsBase64(fontFamily: string, text: string, weight: number = 700): Promise<{ base64: string; format: string } | null> {
  try {
    const encoded = encodeURIComponent(text);
    const cssUrl = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${weight}&text=${encoded}`;
    const cssRes = await fetch(cssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src: url\((.+)\) format\('(woff|woff2|truetype)'\)/);
    if (!match?.[1]) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    const buf = Buffer.from(await fontRes.arrayBuffer());
    return { base64: buf.toString("base64"), format: match[2] };
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
  if (/[\u0900-\u097F]/.test(text)) return "Noto+Sans+Devanagari";
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
  embedFont?: { familyName: string; base64: string; format: string },
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
    const color = seg.color || "#000000";
    const fontWeight = seg.fontWeight || 400;
    const fontFamily = mapFontFamily(seg.fontFamily);
    const align = (seg.textAlign || "LEFT").toLowerCase();

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

    // Stroke (outline) for overlay/meme text
    if (seg.strokeColor && seg.strokeWidth) {
      elements.push(
        `<text font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" ` +
        `text-anchor="${textAnchor}" fill="${seg.strokeColor}" ` +
        `stroke="${seg.strokeColor}" stroke-width="${seg.strokeWidth * 2}" stroke-linejoin="round" ` +
        `paint-order="stroke">${tspans}</text>`
      );
    }

    // Main text
    elements.push(
      `<text font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" ` +
      `text-anchor="${textAnchor}" fill="${color}">${tspans}</text>`
    );
  }

  const fontFaceDef = embedFont
    ? `<defs><style>@font-face { font-family: '${embedFont.familyName}'; src: url('data:font/${embedFont.format};base64,${embedFont.base64}') format('${embedFont.format}'); }</style></defs>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
${fontFaceDef}
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
  if (h.includes("noto")) return "'Noto Sans', 'Noto Sans CJK', sans-serif";
  if (h.includes("serif")) return "Georgia, 'Times New Roman', serif";
  if (h.includes("mono")) return "'Courier New', monospace";
  return "Arial, Helvetica, sans-serif";
}

// ---------------------------------------------------------------------------
// Watermark helpers
// ---------------------------------------------------------------------------

import * as path from "path";
import * as fs from "fs";

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
function loadWatermarkLogo(): Buffer {
  if (_watermarkLogoCache) return _watermarkLogoCache;
  const logoPath = path.join(process.cwd(), "public", "watermark-logo.png");
  _watermarkLogoCache = fs.readFileSync(logoPath);
  return _watermarkLogoCache;
}

/**
 * Build watermark bar: black strip with separator + centered logo image.
 * Returns the composited bar as a Buffer.
 */
async function buildWatermarkBar(imageWidth: number, barHeight: number): Promise<Buffer> {
  const logo = loadWatermarkLogo();

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
    let embedFont: { familyName: string; base64: string; format: string } | undefined;

    if (specialFont) {
      const fontData = await fetchFontAsBase64(specialFont, allText);
      if (fontData) {
        const familyName = specialFont.replace(/\+/g, " ");
        embedFont = { familyName, ...fontData };
        // Override font family in segments to use the embedded font
        for (const seg of translatableSegments) {
          seg.fontFamily = familyName;
        }
      }
    }

    const svgOverlay = buildSvgOverlay(translatableSegments, width, height, embedFont);
    composites.push({ input: Buffer.from(svgOverlay), top: 0, left: 0 });
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
