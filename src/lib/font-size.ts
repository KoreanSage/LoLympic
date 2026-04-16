/**
 * Shared font-size calculator for translated meme text rendering.
 *
 * All 4 rendering paths use this single function so font sizing is
 * consistent across the platform.
 *
 * APPROACH: Hybrid — use Gemini's original size when available,
 * fall back to height+width estimate, scale down to fit but never
 * below 70% of starting size. Readability > completeness.
 */

const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\u3040-\u30FF]/;
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

export type ScriptType = "cjk" | "arabic" | "latin";

export function detectScript(text: string): ScriptType {
  if (CJK_RE.test(text)) return "cjk";
  if (ARABIC_RE.test(text)) return "arabic";
  return "latin";
}

export interface FontSizeOptions {
  text: string;
  boxWidthPx: number;
  boxHeightPx: number;
  originalSizePx?: number;
}

const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 120;

export function calculateFontSize(opts: FontSizeOptions): number {
  const { text, boxWidthPx, boxHeightPx, originalSizePx } = opts;

  if (!text || boxHeightPx <= 0 || boxWidthPx <= 0) return MIN_FONT_SIZE;

  const script = detectScript(text);
  const avgCharWidth = script === "cjk" ? 1.0 : 0.6;
  // Use proper Unicode-aware character count (handles emoji, surrogate pairs)
  const charCount = Array.from(text).length;

  // ── Step 1: Start from original size or height+width estimate ──
  let size: number;
  if (originalSizePx && originalSizePx >= 10) {
    size = originalSizePx;
  } else {
    const heightBased = boxHeightPx * 0.65;
    const widthBased = boxWidthPx / Math.max(1, charCount * avgCharWidth) * (charCount > 10 ? charCount * 0.3 : 1);
    size = Math.min(heightBased, Math.max(widthBased, heightBased * 0.3));
  }

  // ── Step 2: Scale down to fit, but NEVER below 70% ──
  const charsPerLine = Math.max(1, Math.floor(boxWidthPx / (size * avgCharWidth)));
  const estimatedLines = Math.ceil(charCount / charsPerLine);
  const totalTextHeight = estimatedLines * size * 1.35;

  if (totalTextHeight > boxHeightPx && boxHeightPx > 0) {
    const scale = boxHeightPx / totalTextHeight;
    size = size * Math.max(scale, 0.7);
  }

  // ── Step 3: CJK boost ──
  if (script === "cjk") {
    size *= 1.08;
  }

  // ── Step 4: Clamp ──
  return Math.round(
    Math.max(MIN_FONT_SIZE, Math.min(size, MAX_FONT_SIZE, boxHeightPx * 0.85))
  );
}
