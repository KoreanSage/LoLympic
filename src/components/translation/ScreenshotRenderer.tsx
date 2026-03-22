"use client";

import { TranslationSegmentData } from "@/types/components";

interface ScreenshotRendererProps {
  segments: TranslationSegmentData[];
  showTranslation?: boolean;
  originalImageUrl?: string;
}

/**
 * ScreenshotRenderer — Renders Type B (screenshot/forum) meme translations
 * as clean HTML instead of canvas overlay.
 *
 * Groups segments by vertical position to reconstruct the post/comment structure,
 * then renders them in a clean card-based layout.
 */
export default function ScreenshotRenderer({
  segments,
  showTranslation = true,
  originalImageUrl,
}: ScreenshotRendererProps) {
  if (!showTranslation || segments.length === 0) {
    // Show original image when translation is off
    if (originalImageUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={originalImageUrl} alt="Original" className="w-full" />
      );
    }
    return null;
  }

  // Group segments by vertical position to detect post vs comment structure
  // Sort by Y position first
  const sorted = [...segments].sort((a, b) => (a.boxY ?? 0) - (b.boxY ?? 0));

  // Cluster segments into "blocks" based on vertical proximity
  const blocks: TranslationSegmentData[][] = [];
  let currentBlock: TranslationSegmentData[] = [];
  let lastBottomY = -1;

  for (const seg of sorted) {
    const segY = seg.boxY ?? 0;
    const gap = lastBottomY >= 0 ? segY - lastBottomY : 0;

    // If there's a significant vertical gap (>5% of image height), start new block
    if (gap > 0.05 && currentBlock.length > 0) {
      blocks.push(currentBlock);
      currentBlock = [];
    }

    currentBlock.push(seg);
    lastBottomY = segY + (seg.boxHeight ?? 0.05);
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  // Determine block type: first block is usually the main post, rest are comments
  const mainPost = blocks[0] || [];
  const commentBlocks = blocks.slice(1);

  return (
    <div className="w-full bg-background-surface rounded-xl overflow-hidden">
      {/* Main post block */}
      {mainPost.length > 0 && (
        <div className="p-5 border-b border-border">
          {/* Anonymous author header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-background-elevated flex items-center justify-center">
              <svg className="w-4 h-4 text-foreground-subtle" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-foreground">
              Anonymous
            </span>
          </div>

          {/* Main post content */}
          <div className="space-y-2">
            {mainPost.map((seg, i) => (
              <SegmentText key={seg.id || i} segment={seg} isMainPost />
            ))}
          </div>
        </div>
      )}

      {/* Comment blocks */}
      {commentBlocks.map((block, blockIdx) => {
        // Check if this is a reply (indented) based on X position
        const avgX = block.reduce((sum, s) => sum + (s.boxX ?? 0), 0) / block.length;
        const isReply = avgX > 0.1; // If X > 10%, it's likely a nested reply

        return (
          <div
            key={blockIdx}
            className={`border-b border-border/50 last:border-0 ${
              isReply ? "ml-8 pl-4 border-l-2 border-border" : ""
            }`}
          >
            <div className={`p-4 ${isReply ? "py-3" : ""}`}>
              {/* Comment author */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-background-elevated flex items-center justify-center">
                  <svg className="w-3 h-3 text-foreground-subtle" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className="font-medium text-xs text-foreground-muted">
                  Anonymous {blockIdx + 1}
                </span>
              </div>

              {/* Comment content */}
              <div className="space-y-1">
                {block.map((seg, i) => (
                  <SegmentText key={seg.id || i} segment={seg} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Renders a single segment's translated text with appropriate styling */
function SegmentText({
  segment,
  isMainPost = false,
}: {
  segment: TranslationSegmentData;
  isMainPost?: boolean;
}) {
  const text = segment.translatedText;
  const role = segment.semanticRole;

  // Determine text size and weight based on semantic role
  let className = "text-foreground-muted leading-relaxed";

  if (role === "HEADLINE") {
    className = `font-bold text-foreground leading-snug ${
      isMainPost ? "text-lg" : "text-base"
    }`;
  } else if (role === "CAPTION" || role === "SUBTITLE") {
    className = "text-sm text-foreground-muted leading-relaxed";
  } else if (role === "LABEL") {
    className = "text-xs text-foreground-subtle";
  } else if (role === "WATERMARK") {
    className = "text-xs text-foreground-subtle italic";
  } else {
    className = `${isMainPost ? "text-base" : "text-sm"} text-foreground-muted leading-relaxed`;
  }

  // Text alignment
  const align = segment.textAlign?.toLowerCase() || "left";
  const alignClass =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  return (
    <p className={`${className} ${alignClass} whitespace-pre-wrap`}>
      {text}
    </p>
  );
}
