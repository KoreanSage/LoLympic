/**
 * Shared font-size calculator for translated meme text rendering.
 *
 * All 4 rendering paths (image-composer/Sharp, translate/Satori,
 * smart-render/Satori, cron/Satori) use this single function so font
 * sizing is consistent across the platform.
 *
 * APPROACH: Height-based sizing with a soft width guard.
 *
 * Previous approach (character-count-based) estimated the number of
 * wrapped lines from text length, then divided boxHeight by the line
 * count. This worked for English but aggressively shrank translated
 * text — a 5-word English phrase that becomes 15 Japanese characters
 * would be estimated at 3 lines and shrunk to 1/4 the box height.
 *
 * New approach: base the font size on box HEIGHT only (proven by the
 * cron path which already used `boxHeight * 0.65`). Let the renderer
 * (Satori CSS word-wrap or SVG tspan wrapping) handle line breaks.
 * Only apply a gentle 15% reduction for extremely long text.
 */

// ---------------------------------------------------------------------------
// Script detection
// ---------------------------------------------------------------------------

const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u3040-\u30FF]/;
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

export type ScriptType = "cjk" | "arabic" | "latin";

export function detectScript(text: string): ScriptType {
  if (CJK_RE.test(text)) return "cjk";
  if (ARABIC_RE.test(text)) return "arabic";
  return "latin";
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

export interface FontSizeOptions {
  /** The translated text to render. */
  text: string;
  /** Bounding box width in pixels. */
  boxWidthPx: number;
  /** Bounding box height in pixels. */
  boxHeightPx: number;
  /** Original font size from Gemini analysis (optional). */
  originalSizePx?: number;
}

/** Minimum font size — raised from 8/12/14px to 20px for readability. */
const MIN_FONT_SIZE = 20;
/** Maximum font size. */
const MAX_FONT_SIZE = 120;

/**
 * Calculate the optimal font size for translated meme text.
 *
 * The size is primarily based on the bounding box HEIGHT, not text
 * length. This prevents the aggressive shrinking that occurred when
 * translations were longer than the source English text.
 */
export function calculateFontSize(opts: FontSizeOptions): number {
  const { text, boxWidthPx, boxHeightPx, originalSizePx } = opts;

  if (!text || boxHeightPx <= 0) return MIN_FONT_SIZE;
  if (boxWidthPx <= 0) return MIN_FONT_SIZE;

  const script = detectScript(text);
  const avgCharWidth = script === "cjk" ? 1.0 : 0.6;

  // ── Step 1: Start from original size if Gemini provided one ──
  // Gemini's fontSizePixels reflects the source text's visual size in
  // the original image — this is the best baseline when available.
  let size: number;
  if (originalSizePx && originalSizePx >= 10) {
    size = originalSizePx;
  } else {
    // No original size — start with height-based estimate, BUT cap it
    // so large boxes (e.g. entire image height) don't produce giant text.
    // Use the SMALLER of height-based and width-based estimates.
    const heightBased = boxHeightPx * 0.65;
    const widthBased = boxWidthPx / Math.max(1, text.length * avgCharWidth) * (text.length > 10 ? text.length * 0.3 : 1);
    size = Math.min(heightBased, Math.max(widthBased, heightBased * 0.3));
  }

  // ── Step 2: Ensure text actually FITS in the box ──
  // Estimate line wrapping and scale down if needed. This is the key
  // balance — the old approach was too aggressive (shrunk to 1/4), but
  // we can't ignore text length entirely (PR #118 lesson: that makes
  // text too big when the box is large).
  const charsPerLine = Math.max(1, Math.floor(boxWidthPx / (size * avgCharWidth)));
  const estimatedLines = Math.ceil(text.length / charsPerLine);
  const lineHeight = 1.35;
  const totalTextHeight = estimatedLines * size * lineHeight;

  if (totalTextHeight > boxHeightPx && boxHeightPx > 0) {
    // Scale down to fit, but NEVER below 50% of the starting size.
    // The old approach had no floor and would shrink to 12px.
    const scale = boxHeightPx / totalTextHeight;
    size = size * Math.max(scale, 0.5);
  }

  // ── Step 3: CJK boost ──
  // CJK characters carry more meaning per glyph — they read well at
  // slightly larger sizes even when the char count is higher.
  if (script === "cjk") {
    size *= 1.08;
  }

  // ── Step 4: Clamp ──
  return Math.round(
    Math.max(MIN_FONT_SIZE, Math.min(size, MAX_FONT_SIZE, boxHeightPx * 0.85))
  );
}
