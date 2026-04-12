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

  const script = detectScript(text);

  // ── Step 1: Height-based default ──
  // 65% of box height is the sweet spot (proven by cron path).
  const baseSize = boxHeightPx * 0.65;

  // ── Step 2: Consider original size if provided ──
  // Trust Gemini's original size if it's reasonable (at least 30% of
  // box height). Otherwise use our height-based default.
  let size: number;
  const minReasonable = boxHeightPx * 0.3;
  if (originalSizePx && originalSizePx >= minReasonable) {
    size = Math.max(originalSizePx, baseSize * 0.8);
  } else {
    size = baseSize;
  }

  // ── Step 3: CJK boost ──
  // CJK characters carry more meaning per glyph and are visually
  // denser, so they read well at slightly larger sizes. Japanese,
  // Chinese, and Korean all get a 10% boost.
  if (script === "cjk") {
    size *= 1.1;
  }

  // ── Step 4: Soft width guard ──
  // Only reduce font size if the text is EXTREMELY long relative to
  // the box. This is a gentle 15% reduction, applied at most once.
  // The old approach divided by line count which could shrink by 60%+.
  if (boxWidthPx > 0) {
    const avgCharWidth = script === "cjk" ? 1.0 : 0.6;
    const charsPerLine = Math.max(1, Math.floor(boxWidthPx / (size * avgCharWidth)));
    const estimatedLines = Math.ceil(text.length / charsPerLine);
    const maxLines = Math.max(1, Math.floor(boxHeightPx / (size * 1.3)));
    // Only trigger for text that would need 1.5x more lines than the
    // box can fit at the current size — catches extreme cases like
    // 200-character translations in a small box.
    if (estimatedLines > maxLines * 1.5) {
      size *= 0.85;
    }
  }

  // ── Step 5: Clamp ──
  return Math.round(
    Math.max(MIN_FONT_SIZE, Math.min(size, MAX_FONT_SIZE, boxHeightPx * 0.9))
  );
}
