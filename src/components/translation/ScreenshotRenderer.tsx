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

/** Check if a label is a UI button (Agree/Scrap/Like/Save etc.) */
function isUIButton(text: string): boolean {
  return /^(공감|스크랩|좋아요|Like|Agree|Save|Scrap|Share|Bookmark|Report|신고|저장)$/i.test(text.trim());
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
  content: string[];           // individual lines from segments
  contentJoined: string;       // merged into flowing paragraph
  reactions: number[];         // [likes, comments, stars, ...]
  uiButtons: string[];         // ["Agree", "Scrap"] etc.
}

function parseBlocks(segments: TranslationSegmentData[]): ParsedPost[] {
  const sorted = [...segments].sort((a, b) => (a.boxY ?? 0) - (b.boxY ?? 0));
  const posts: ParsedPost[] = [];
  let current: ParsedPost = { content: [], contentJoined: "", reactions: [], uiButtons: [] };

  // Track which numeric labels we've already consumed as part of a reaction row
  const consumedIndices = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (consumedIndices.has(i)) continue;

    const seg = sorted[i];
    const text = seg.translatedText.trim();
    const role = seg.semanticRole;
    const y = seg.boxY ?? 0;

    if (role === "LABEL" && isUsername(text)) {
      // If we already have content, push the current post and start new one
      if (current.content.length > 0 || current.username) {
        current.contentJoined = joinContent(current.content);
        posts.push(current);
        current = { content: [], contentJoined: "", reactions: [], uiButtons: [] };
      }
      current.username = text;
    } else if (role === "LABEL" && isTimestamp(text)) {
      current.timestamp = text;
    } else if (role === "LABEL" && isUIButton(text)) {
      current.uiButtons.push(text);
    } else if (role === "LABEL" && isNumericLabel(text)) {
      // Check if there are other numeric labels at same Y (reaction row)
      const sameYNumerics: { index: number; value: number }[] = [];
      for (let j = 0; j < sorted.length; j++) {
        if (
          sorted[j].semanticRole === "LABEL" &&
          isNumericLabel(sorted[j].translatedText.trim()) &&
          Math.abs((sorted[j].boxY ?? 0) - y) < 0.02
        ) {
          sameYNumerics.push({ index: j, value: parseInt(sorted[j].translatedText.trim(), 10) });
        }
      }

      if (sameYNumerics.length >= 2 && current.reactions.length === 0) {
        // This is a reaction row — collect all numbers at this Y
        current.reactions = sameYNumerics
          .sort((a, b) => (sorted[a.index].boxX ?? 0) - (sorted[b.index].boxX ?? 0))
          .map((n) => n.value);
        // Mark all consumed
        sameYNumerics.forEach((n) => consumedIndices.add(n.index));
      } else if (sameYNumerics.length < 2 && current.reactions.length === 0) {
        // Single number — like count for a comment
        current.reactions = [parseInt(text, 10)];
        consumedIndices.add(i);
      }
    } else if (isContent(seg)) {
      current.content.push(text);
    }
    // Other labels are silently skipped
  }

  // Push last post
  if (current.content.length > 0 || current.username) {
    current.contentJoined = joinContent(current.content);
    posts.push(current);
  }

  return posts;
}

/**
 * Join multiple content lines into a coherent flowing paragraph.
 *
 * Instead of showing each OCR line separately, merge them into
 * natural text. Sentences that end without punctuation get a space
 * to flow into the next line.
 */
function joinContent(lines: string[]): string {
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0];

  let result = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const prev = result.trimEnd();
    const next = lines[i].trim();
    if (!next) continue;

    // If previous line ends with sentence-ending punctuation, add a paragraph break
    const endsWithPunctuation = /[.!?。！？…"」』)\]]$/.test(prev);
    // If next line starts with a quote or special marker, treat as new paragraph
    const startsNewParagraph = /^["「『([]/.test(next);

    if (endsWithPunctuation || startsNewParagraph) {
      result = prev + "\n\n" + next;
    } else {
      // Same sentence continues — join with space
      result = prev + " " + next;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Icon components (inline SVGs for cleaner JSX)
// ---------------------------------------------------------------------------

function UserIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function ThumbUpIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3.75a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 5.25c0 .372-.052.732-.142 1.072a12.12 12.12 0 01-.597 1.928h4.489a2.25 2.25 0 012.25 2.25v2.25a2.25 2.25 0 01-2.25 2.25h-1.064M14.25 14.25v3a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-6.3c0-.597.237-1.17.659-1.591L8.909 5.109A2.25 2.25 0 0110.5 4.5h.038c.666 0 1.283.356 1.614.934l.013.024" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg className="w-4 h-4 text-foreground-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="w-5 h-5 text-foreground-subtle" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  );
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
    <div className="w-full bg-white dark:bg-[#1a1a1a] overflow-hidden rounded-lg shadow-sm">
      {/* ── Main post ── */}
      <div className="px-6 pt-6 pb-5">
        {/* Author row with action buttons */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
              <span className="text-gray-400 dark:text-neutral-500">
                <UserIcon size={22} />
              </span>
            </div>
            <div>
              <span className="font-bold text-[15px] text-gray-900 dark:text-gray-100 block leading-tight">
                {mainPost.username || "Anonymous"}
              </span>
              {mainPost.timestamp && (
                <span className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5 block">
                  {mainPost.timestamp}
                </span>
              )}
            </div>
          </div>

          {/* UI buttons (Agree / Scrap etc.) */}
          {mainPost.uiButtons.length > 0 && (
            <div className="flex items-center gap-2">
              {mainPost.uiButtons.map((btn, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700 rounded-lg"
                >
                  {i === 0 && <ThumbUpIcon />}
                  {i === 1 && <StarIcon />}
                  {btn}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Main content — flowing paragraphs */}
        <div className="text-[15px] text-gray-800 dark:text-gray-200 leading-[1.75] whitespace-pre-line mb-5">
          {mainPost.contentJoined}
        </div>

        {/* Reaction row */}
        {mainPost.reactions.length > 0 && (
          <div className="flex items-center gap-5 text-sm pt-1">
            {mainPost.reactions[0] !== undefined && (
              <span className="flex items-center gap-1.5 text-gray-400 dark:text-neutral-500">
                <ThumbUpIcon />
                <span className="text-[#c9a84c] font-semibold">{mainPost.reactions[0]}</span>
              </span>
            )}
            {mainPost.reactions[1] !== undefined && (
              <span className="flex items-center gap-1.5 text-gray-400 dark:text-neutral-500">
                <CommentIcon />
                <span className="text-gray-500 dark:text-neutral-400 font-medium">{mainPost.reactions[1]}</span>
              </span>
            )}
            {mainPost.reactions[2] !== undefined && (
              <span className="flex items-center gap-1.5 text-gray-400 dark:text-neutral-500">
                <StarIcon />
                <span className="text-gray-500 dark:text-neutral-400 font-medium">{mainPost.reactions[2]}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Comments ── */}
      {comments.length > 0 && (
        <div className="border-t border-gray-100 dark:border-neutral-800">
          {comments.map((comment, idx) => {
            // Detect replies based on original X position
            const commentSegments = segments.filter(
              (s) => isContent(s) && comment.content.some((c) => s.translatedText.trim() === c)
            );
            const avgX = commentSegments.length > 0
              ? commentSegments.reduce((sum, s) => sum + (s.boxX ?? 0), 0) / commentSegments.length
              : 0;
            const isReply = avgX > 0.12;

            return (
              <div
                key={idx}
                className={`border-b border-gray-50 dark:border-neutral-800/50 last:border-0 ${
                  isReply ? "ml-10 border-l-2 border-l-gray-100 dark:border-l-neutral-800" : ""
                }`}
              >
                <div className={`px-6 py-4 ${isReply ? "pl-5" : ""}`}>
                  {/* Reply indicator */}
                  {isReply && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <ReplyIcon />
                    </div>
                  )}

                  {/* Comment header: author + action icons */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                        <span className="text-gray-400 dark:text-neutral-500">
                          <UserIcon size={16} />
                        </span>
                      </div>
                      <span className="font-bold text-[14px] text-gray-900 dark:text-gray-100">
                        {comment.username || `Anonymous ${idx + 1}`}
                      </span>
                    </div>

                    {/* Action icons */}
                    <div className="flex items-center gap-2 text-gray-300 dark:text-neutral-600">
                      <CommentIcon />
                      <ThumbUpIcon />
                      <MoreIcon />
                    </div>
                  </div>

                  {/* Comment body — flowing text */}
                  <div className="text-[14px] text-gray-700 dark:text-gray-300 leading-[1.7] whitespace-pre-line mb-3 pl-[42px]">
                    {comment.contentJoined}
                  </div>

                  {/* Comment metadata row */}
                  <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-neutral-500 pl-[42px]">
                    {comment.timestamp && (
                      <span>{comment.timestamp}</span>
                    )}
                    {comment.reactions.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ThumbUpIcon />
                        <span className="font-medium">{comment.reactions[0]}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
