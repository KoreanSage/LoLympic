"use client";

import { TranslationSegmentData } from "@/types/components";

interface ScreenshotRendererProps {
  segments: TranslationSegmentData[];
  showTranslation?: boolean;
  originalImageUrl?: string;
}

// ---------------------------------------------------------------------------
// Segment classification helpers
// ---------------------------------------------------------------------------

/** Check if a label is a username (Anonymous, 익명, 匿名, etc.) */
function isUsername(text: string): boolean {
  const t = text.trim();
  return /^(Anonymous|Anónim|익명|匿名|गुमनाम|مجهول)/i.test(t) ||
    /^(Anonymous|Anon)\s*\d*$/i.test(t);
}

/** Check if a label is a timestamp */
function isTimestamp(text: string): boolean {
  return /^\d{1,2}[\/:]\d{1,2}\s+\d{1,2}:\d{2}$/.test(text.trim()) ||
    /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(text.trim());
}

/** Check if a label is a pure number (reaction count) */
function isNumericLabel(text: string): boolean {
  return /^\d+$/.test(text.trim());
}

/** Check if text is a content segment (not metadata) */
function isContent(seg: TranslationSegmentData): boolean {
  return ["CAPTION", "DIALOGUE", "OTHER", "HEADLINE", "SUBTITLE", "OVERLAY"].includes(seg.semanticRole);
}

// ---------------------------------------------------------------------------
// Structured post parsing
// ---------------------------------------------------------------------------

interface ParsedPost {
  username?: string;
  timestamp?: string;
  content: string[];
  reactions: number[];  // [likes, comments, stars, ...]
}

function parseBlocks(segments: TranslationSegmentData[]): ParsedPost[] {
  const sorted = [...segments].sort((a, b) => (a.boxY ?? 0) - (b.boxY ?? 0));
  const posts: ParsedPost[] = [];
  let current: ParsedPost = { content: [], reactions: [] };

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    const text = seg.translatedText.trim();
    const role = seg.semanticRole;
    const y = seg.boxY ?? 0;

    if (role === "LABEL" && isUsername(text)) {
      // If we already have content, push the current post and start new one
      if (current.content.length > 0 || current.username) {
        posts.push(current);
        current = { content: [], reactions: [] };
      }
      current.username = text;
    } else if (role === "LABEL" && isTimestamp(text)) {
      current.timestamp = text;
    } else if (role === "LABEL" && isNumericLabel(text)) {
      // Check if there are other numeric labels at same Y (reaction row)
      const sameYNumerics = sorted.filter(
        (s) => s.semanticRole === "LABEL" &&
          isNumericLabel(s.translatedText.trim()) &&
          Math.abs((s.boxY ?? 0) - y) < 0.02
      );
      if (sameYNumerics.length >= 2 && current.reactions.length === 0) {
        // This is a reaction row — collect all numbers at this Y
        current.reactions = sameYNumerics.map((s) => parseInt(s.translatedText.trim(), 10));
      } else if (sameYNumerics.length < 2) {
        // Single number after timestamp — it's a like count for a comment
        current.reactions = [parseInt(text, 10)];
      }
    } else if (isContent(seg)) {
      current.content.push(text);
    } else if (role === "LABEL") {
      // Other labels (like "Agree", "Scrap", UI buttons) — skip
    }
  }

  // Push last post
  if (current.content.length > 0 || current.username) {
    posts.push(current);
  }

  return posts;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScreenshotRenderer({
  segments,
  showTranslation = true,
  originalImageUrl,
}: ScreenshotRendererProps) {
  if (!showTranslation || segments.length === 0) {
    if (originalImageUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={originalImageUrl} alt="Original" className="w-full" />
      );
    }
    return null;
  }

  const posts = parseBlocks(segments);
  if (posts.length === 0) return null;

  const mainPost = posts[0];
  const comments = posts.slice(1);

  return (
    <div className="w-full bg-background-surface overflow-hidden">
      {/* Main post */}
      <div className="p-5 pb-4">
        {/* Author row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-background-elevated flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-foreground-subtle" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-sm text-foreground block">
                {mainPost.username || "Anonymous"}
              </span>
              {mainPost.timestamp && (
                <span className="text-xs text-foreground-subtle">{mainPost.timestamp}</span>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="text-[15px] text-foreground leading-relaxed space-y-1 mb-4">
          {mainPost.content.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {/* Reaction row */}
        {mainPost.reactions.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            {mainPost.reactions[0] !== undefined && (
              <span className="flex items-center gap-1 text-foreground-subtle">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3.75a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 5.25c0 .372-.052.732-.142 1.072a12.12 12.12 0 01-.597 1.928h4.489a2.25 2.25 0 012.25 2.25v2.25a2.25 2.25 0 01-2.25 2.25h-1.064M14.25 14.25v3a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-6.3c0-.597.237-1.17.659-1.591L8.909 5.109A2.25 2.25 0 0110.5 4.5h.038c.666 0 1.283.356 1.614.934l.013.024" />
                </svg>
                <span className="text-[#c9a84c] font-medium">{mainPost.reactions[0]}</span>
              </span>
            )}
            {mainPost.reactions[1] !== undefined && (
              <span className="flex items-center gap-1 text-foreground-subtle">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="font-medium">{mainPost.reactions[1]}</span>
              </span>
            )}
            {mainPost.reactions[2] !== undefined && (
              <span className="flex items-center gap-1 text-foreground-subtle">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
                <span className="font-medium">{mainPost.reactions[2]}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      {comments.length > 0 && <div className="border-t border-border" />}

      {/* Comments */}
      {comments.map((comment, idx) => {
        // Detect if this is a reply based on the original X position
        // In the original segments, replies tend to have higher X values
        const commentSegments = segments.filter(
          (s) => isContent(s) && comment.content.includes(s.translatedText.trim())
        );
        const avgX = commentSegments.length > 0
          ? commentSegments.reduce((sum, s) => sum + (s.boxX ?? 0), 0) / commentSegments.length
          : 0;
        const isReply = avgX > 0.12;

        return (
          <div key={idx} className={`border-b border-border/30 last:border-0 ${isReply ? "pl-6" : ""}`}>
            {/* Reply indicator */}
            {isReply && (
              <div className="flex items-center gap-1 px-5 pt-3">
                <svg className="w-3.5 h-3.5 text-foreground-subtle rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v6M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
            )}

            <div className="px-5 py-3">
              {/* Comment author */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-background-elevated flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-foreground-subtle" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <span className="font-bold text-sm text-foreground">
                  {comment.username || `Anonymous ${idx + 1}`}
                </span>
              </div>

              {/* Comment body */}
              <div className="text-[14px] text-foreground-muted leading-relaxed mb-2">
                {comment.content.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              {/* Comment metadata row */}
              <div className="flex items-center gap-3 text-xs text-foreground-subtle">
                {comment.timestamp && <span>{comment.timestamp}</span>}
                {comment.reactions.length > 0 && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3.75a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 5.25c0 .372-.052.732-.142 1.072a12.12 12.12 0 01-.597 1.928h4.489a2.25 2.25 0 012.25 2.25v2.25a2.25 2.25 0 01-2.25 2.25h-1.064M14.25 14.25v3a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-6.3c0-.597.237-1.17.659-1.591L8.909 5.109A2.25 2.25 0 0110.5 4.5h.038c.666 0 1.283.356 1.614.934l.013.024" />
                    </svg>
                    {comment.reactions[0]}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
