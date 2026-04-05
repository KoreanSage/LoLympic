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
 * Generate an SVG text overlay for all segments.
 */
function buildSvgOverlay(
  segments: TextSegment[],
  imageWidth: number,
  imageHeight: number,
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}" viewBox="0 0 ${imageWidth} ${imageHeight}">
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

const WATERMARK_HEIGHT_RATIO = 0.035; // 3.5% of image height
const WATERMARK_MIN_HEIGHT = 20;
const WATERMARK_MAX_HEIGHT = 48;
const WATERMARK_BG_COLOR = "#000000";
const WATERMARK_TEXT_COLOR = "#FFFFFF";
const WATERMARK_TEXT_OPACITY = 0.55;
const WATERMARK_SEPARATOR_COLOR = "#333333";
const WATERMARK_TEXT = ".mimzy.gg";

/**
 * Build an SVG watermark bar: black strip with a subtle top separator and
 * ".mimzy.gg" centered.
 */
function buildWatermarkSvg(imageWidth: number, barHeight: number): string {
  const fontSize = Math.max(9, Math.round(barHeight * 0.45));
  const separatorHeight = Math.max(1, Math.round(barHeight * 0.04));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${barHeight}">
  <rect width="${imageWidth}" height="${barHeight}" fill="${WATERMARK_BG_COLOR}"/>
  <rect width="${imageWidth}" height="${separatorHeight}" fill="${WATERMARK_SEPARATOR_COLOR}"/>
  <text x="${imageWidth / 2}" y="${barHeight / 2 + fontSize * 0.35}"
    font-family="'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
    font-size="${fontSize}" font-weight="500" letter-spacing="2"
    text-anchor="middle" fill="${WATERMARK_TEXT_COLOR}"
    opacity="${WATERMARK_TEXT_OPACITY}">${WATERMARK_TEXT}</text>
</svg>`;
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
    const svgOverlay = buildSvgOverlay(translatableSegments, width, height);
    composites.push({ input: Buffer.from(svgOverlay), top: 0, left: 0 });
  }

  // Build watermark bar
  if (watermark && barHeight > 0) {
    const wmSvg = buildWatermarkSvg(width, barHeight);
    composites.push({ input: Buffer.from(wmSvg), top: height, left: 0 });
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
