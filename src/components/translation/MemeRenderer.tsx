"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  TranslationSegmentData,
  MemeRendererProps,
  LANGUAGE_FONT_DEFAULTS,
} from "@/types/components";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect a CJK-heavy segment by checking the translated text */
function detectLanguageFromText(text: string): string | null {
  if (/[\u3131-\uD79D]/.test(text)) return "ko";
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) return "ar";
  if (/[a-zA-Z]/.test(text)) return "en";
  return null;
}

/** Check if text is RTL (Arabic/Hebrew) */
function isRTL(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0590-\u05FF]/.test(text);
}

function resolveFont(segment: TranslationSegmentData): string {
  if (segment.fontFamily) return segment.fontFamily;
  if (segment.fontHint) {
    const hint = segment.fontHint.toLowerCase();
    for (const [, font] of Object.entries(LANGUAGE_FONT_DEFAULTS)) {
      if (font.toLowerCase().includes(hint)) return font;
    }
  }
  const lang = detectLanguageFromText(segment.translatedText);
  if (lang && LANGUAGE_FONT_DEFAULTS[lang]) return LANGUAGE_FONT_DEFAULTS[lang];
  return "Impact";
}

/** Check if a character is CJK (can break anywhere) */
function isCJK(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    (code >= 0x3131 && code <= 0xD79D) || // Korean
    (code >= 0x3040 && code <= 0x30FF) || // Japanese Hiragana/Katakana
    (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified
    (code >= 0xAC00 && code <= 0xD7AF)    // Korean Syllables
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  // Check if text contains CJK characters — use character-level wrapping
  const hasCJK = Array.from(text).some(isCJK);

  if (hasCJK) {
    // Character-level wrapping for CJK text
    const lines: string[] = [];
    let current = "";
    for (const ch of text) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  }

  // Word-level wrapping for Latin text
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  fontWeight: number,
  maxWidth: number,
  maxHeight: number,
  startSize: number
): { fontSize: number; lines: string[] } {
  let size = startSize;
  const minSize = 8;
  let lines: string[] = [];

  while (size >= minSize) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}, sans-serif`;
    lines = wrapText(ctx, text, maxWidth);
    const lineHeight = size * 1.2;
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= maxHeight) {
      const allFit = lines.every(
        (line) => ctx.measureText(line).width <= maxWidth
      );
      if (allFit) return { fontSize: size, lines };
    }
    size -= 1;
  }

  // Use minimum size
  ctx.font = `${fontWeight} ${minSize}px ${fontFamily}, sans-serif`;
  lines = wrapText(ctx, text, maxWidth);
  return { fontSize: minSize, lines };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MemeRenderer({
  imageUrl,
  cleanImageUrl,
  translatedImageUrl,
  segments,
  width,
  height,
  showTranslation = true,
}: MemeRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cleanImage, setCleanImage] = useState<HTMLImageElement | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [imageError, setImageError] = useState(false);
  const [translatedImageError, setTranslatedImageError] = useState(false);

  // Prefer canvas rendering (clean image + text overlay) for accuracy
  // Only fall back to pre-rendered Gemini image if we have no clean image AND no segments
  const usePreRendered = showTranslation && !!translatedImageUrl && !translatedImageError
    && (!cleanImageUrl || segments.length === 0);

  // Load original image
  useEffect(() => {
    setImageError(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.onerror = () => setImageError(true);
    img.src = imageUrl;
  }, [imageUrl]);

  // Load clean image (text-removed) when available
  useEffect(() => {
    if (!cleanImageUrl) {
      setCleanImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setCleanImage(img);
    img.onerror = () => setCleanImage(null);
    img.src = cleanImageUrl;
  }, [cleanImageUrl]);

  // Compute display size
  useEffect(() => {
    if (!image) return;

    const naturalW = image.naturalWidth;
    const naturalH = image.naturalHeight;
    const aspectRatio = naturalW / naturalH;

    let displayW = width || containerRef.current?.clientWidth || naturalW;
    let displayH = height || displayW / aspectRatio;

    if (height && !width) {
      displayH = height;
      displayW = displayH * aspectRatio;
    }

    setDisplaySize({ w: displayW, h: displayH });
  }, [image, width, height]);

  // Render canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || displaySize.w === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const { w: displayW, h: displayH } = displaySize;

    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // When showing translation and clean image is available, use it as base
    const baseImage =
      showTranslation && cleanImage && segments.length > 0 ? cleanImage : image;
    ctx.drawImage(baseImage, 0, 0, displayW, displayH);

    if (!showTranslation || segments.length === 0) return;

    const naturalW = image.naturalWidth;
    const naturalH = image.naturalHeight;
    const scaleX = displayW / naturalW;
    const scaleY = displayH / naturalH;

    for (const seg of segments) {
      if (
        seg.boxX == null ||
        seg.boxY == null ||
        seg.boxWidth == null ||
        seg.boxHeight == null
      )
        continue;

      const text = seg.isUppercase
        ? seg.translatedText.toUpperCase()
        : seg.translatedText;

      if (!text.trim()) continue;

      // Gemini returns coordinates in various formats:
      // 1. Fractional (0.0-1.0): relative to image dimensions
      // 2. Pixel (natural image coords): absolute positions
      // 3. Gemini 1000-scale: coordinates in 0-1000 range (common in Gemini vision)
      const maxCoord = Math.max(seg.boxX!, seg.boxY!, seg.boxX! + seg.boxWidth!, seg.boxY! + seg.boxHeight!);

      let bx: number, by: number, bw: number, bh: number;
      if (maxCoord <= 1.05) {
        // Fractional coordinates (0-1 range)
        bx = seg.boxX! * displayW;
        by = seg.boxY! * displayH;
        bw = seg.boxWidth! * displayW;
        bh = seg.boxHeight! * displayH;
      } else if (maxCoord > naturalW || maxCoord > naturalH) {
        // Gemini 1000-scale coordinates (exceeds natural image dimensions)
        // Normalize to 0-1 first, then scale to display
        const geminiScale = Math.max(
          (seg.boxX! + seg.boxWidth!) > 0 ? seg.boxX! + seg.boxWidth! : 1,
          (seg.boxY! + seg.boxHeight!) > 0 ? seg.boxY! + seg.boxHeight! : 1,
          1000
        );
        const norm = Math.max(geminiScale, 1000); // Assume at least 1000-scale
        bx = (seg.boxX! / norm) * displayW;
        by = (seg.boxY! / norm) * displayH;
        bw = (seg.boxWidth! / norm) * displayW;
        bh = (seg.boxHeight! / norm) * displayH;
      } else {
        // Absolute pixel coords relative to natural image size
        bx = seg.boxX! * scaleX;
        by = seg.boxY! * scaleY;
        bw = seg.boxWidth! * scaleX;
        bh = seg.boxHeight! * scaleY;
      }

      const fontFamily = resolveFont(seg);
      const fontWeight = seg.fontWeight || 700;
      const startFontSize = seg.fontSizePixels
        ? seg.fontSizePixels * Math.min(scaleX, scaleY)
        : bh * 0.7;

      ctx.save();

      // Sample background color for contrast detection
      const imgData = ctx.getImageData(
        Math.max(0, Math.floor(bx * dpr)),
        Math.max(0, Math.floor(by * dpr)),
        Math.max(1, Math.min(4, Math.floor(bw * dpr))),
        Math.max(1, Math.min(4, Math.floor(bh * dpr)))
      );
      const r = imgData.data[0], g = imgData.data[1], b = imgData.data[2];
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;

      // Cover original text with a clean semi-transparent backdrop
      // This provides much better readability than raw background sampling
      const padX = bw * 0.06;
      const padY = bh * 0.08;
      const bgX = bx - padX;
      const bgY = by - padY;
      const bgW = bw + padX * 2;
      const bgH = bh + padY * 2;
      const borderRadius = Math.min(bgH * 0.15, 8);

      // Draw rounded rect backdrop
      ctx.beginPath();
      ctx.moveTo(bgX + borderRadius, bgY);
      ctx.lineTo(bgX + bgW - borderRadius, bgY);
      ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + borderRadius);
      ctx.lineTo(bgX + bgW, bgY + bgH - borderRadius);
      ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - borderRadius, bgY + bgH);
      ctx.lineTo(bgX + borderRadius, bgY + bgH);
      ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - borderRadius);
      ctx.lineTo(bgX, bgY + borderRadius);
      ctx.quadraticCurveTo(bgX, bgY, bgX + borderRadius, bgY);
      ctx.closePath();

      // Use a solid-ish backdrop matching the dominant background
      ctx.fillStyle = seg.backgroundColor || (brightness > 128
        ? `rgba(${Math.min(255, r + 30)},${Math.min(255, g + 30)},${Math.min(255, b + 30)},0.92)`
        : `rgba(${Math.max(0, r - 20)},${Math.max(0, g - 20)},${Math.max(0, b - 20)},0.92)`);
      ctx.fill();

      // Handle rotation
      if (seg.rotation) {
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        ctx.translate(cx, cy);
        ctx.rotate((seg.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }

      // Fit text
      const padding = 4;
      const { fontSize, lines } = fitFontSize(
        ctx,
        text,
        fontFamily,
        fontWeight,
        bw - padding * 2,
        bh - padding * 2,
        startFontSize
      );

      const lineHeight = fontSize * 1.2;
      const totalTextHeight = lines.length * lineHeight;

      // Vertical centering
      const startY = by + (bh - totalTextHeight) / 2 + fontSize;

      // Horizontal alignment (flip for RTL text like Arabic)
      const rtl = isRTL(seg.translatedText);
      const align = (seg.textAlign || "CENTER").toUpperCase();
      if (rtl) {
        ctx.direction = "rtl";
        if (align === "LEFT") ctx.textAlign = "right";
        else if (align === "RIGHT") ctx.textAlign = "left";
        else ctx.textAlign = "center";
      } else {
        ctx.direction = "ltr";
        if (align === "LEFT") ctx.textAlign = "left";
        else if (align === "RIGHT") ctx.textAlign = "right";
        else ctx.textAlign = "center";
      }

      let anchorX = bx + bw / 2;
      if (align === "LEFT") anchorX = rtl ? bx + bw - padding : bx + padding;
      else if (align === "RIGHT") anchorX = rtl ? bx + padding : bx + bw - padding;

      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
      ctx.textBaseline = "alphabetic";

      // Auto-detect text color based on background brightness
      const autoColor = brightness > 128 ? "#000000" : "#FFFFFF";
      const fillColor = seg.color || autoColor;
      const contrastStroke = brightness > 128 ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)";

      for (let i = 0; i < lines.length; i++) {
        const ly = startY + i * lineHeight;

        // Always add a subtle stroke for crisp text on backdrop
        if (seg.strokeColor || seg.strokeWidth) {
          ctx.strokeStyle = seg.strokeColor || contrastStroke;
          ctx.lineWidth = (seg.strokeWidth || 2) * Math.min(scaleX, scaleY);
          ctx.lineJoin = "round";
          ctx.strokeText(lines[i], anchorX, ly);
        } else {
          // Subtle stroke for text edge definition
          ctx.strokeStyle = contrastStroke;
          ctx.lineWidth = Math.max(1, fontSize * 0.04);
          ctx.lineJoin = "round";
          ctx.strokeText(lines[i], anchorX, ly);
        }

        // Fill
        ctx.fillStyle = fillColor;
        ctx.fillText(lines[i], anchorX, ly);
      }

      ctx.restore();
    }
  }, [image, cleanImage, segments, displaySize, showTranslation]);

  useEffect(() => {
    render();
  }, [render]);

  // Re-render on resize
  useEffect(() => {
    if (!containerRef.current || width) return;
    const observer = new ResizeObserver(() => {
      if (!image) return;
      const containerW = containerRef.current?.clientWidth || 0;
      if (containerW > 0 && containerW !== displaySize.w) {
        const aspect = image.naturalWidth / image.naturalHeight;
        setDisplaySize({ w: containerW, h: containerW / aspect });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [image, width, displaySize.w]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Pre-rendered translated image — clean swap, no canvas needed */}
      {usePreRendered && (
        <img
          src={translatedImageUrl}
          alt="Translated meme"
          className="w-full rounded-lg"
          style={{ maxWidth: "100%" }}
          onError={() => setTranslatedImageError(true)}
        />
      )}
      {/* Canvas fallback — used for original image or when no pre-rendered image */}
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg"
        style={{
          maxWidth: "100%",
          display: !usePreRendered && displaySize.w > 0 ? "block" : "none",
        }}
      />
      {imageError && !usePreRendered && (
        <div className="w-full aspect-[4/3] bg-background-surface rounded-lg flex items-center justify-center">
          <span className="text-foreground-subtle text-sm">Failed to load image</span>
        </div>
      )}
      {!image && !imageError && !usePreRendered && (
        <div className="w-full aspect-[4/3] bg-background-surface rounded-lg animate-pulse flex items-center justify-center">
          <span className="text-foreground-subtle text-sm">Loading image...</span>
        </div>
      )}
    </div>
  );
}
