"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import MemeRenderer from "@/components/translation/MemeRenderer";
import ScreenshotRenderer from "@/components/translation/ScreenshotRenderer";
import TranslationToggle from "@/components/translation/TranslationToggle";
import ImageCarousel from "@/components/ui/ImageCarousel";
import { TranslationSegmentData } from "@/types/components";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";

interface TopComment {
  id: string;
  body: string;
  likeCount: number;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    isChampion?: boolean;
    countryFlag?: string;
  };
}

interface FeedImage {
  originalUrl: string;
  cleanUrl?: string | null;
  mimeType?: string | null;
}

interface FeedCardProps {
  id: string;
  title: string;
  translatedTitle?: string;
  translatedBody?: string;
  sourceLanguage?: string;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    isChampion?: boolean;
  };
  country?: {
    flagEmoji: string;
    nameEn: string;
  } | null;
  imageUrl: string;
  cleanImageUrl?: string;
  translatedImageUrl?: string;
  mimeType?: string;
  segments: TranslationSegmentData[];
  memeType?: string;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
  seasonBadge?: string;
  tags?: string[];
  topComments?: TopComment[];
  images?: FeedImage[];
  onDelete?: (id: string) => void;
}

// Bookmark helpers
function getBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem("lolympic_bookmarks");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveBookmarks(ids: Set<string>) {
  localStorage.setItem("lolympic_bookmarks", JSON.stringify(Array.from(ids)));
}

export default function FeedCard({
  id,
  title,
  translatedTitle,
  translatedBody,
  sourceLanguage,
  author,
  country,
  imageUrl,
  cleanImageUrl,
  translatedImageUrl,
  mimeType,
  segments,
  memeType,
  reactionCount,
  commentCount,
  shareCount,
  createdAt,
  seasonBadge,
  tags,
  topComments,
  images,
  onDelete,
}: FeedCardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const preferredLang = (session?.user as any)?.preferredLanguage || "en";

  // Auto-enable translation overlay when segments with bounding boxes exist or pre-rendered image available
  const hasOverlaySegments = useMemo(
    () => segments.some(
      (s) => s.boxX != null && s.boxY != null && s.boxWidth != null && s.boxHeight != null
    ),
    [segments]
  );
  const isGif = mimeType === "image/gif";
  const hasTranslation = !isGif && (hasOverlaySegments || !!translatedImageUrl);

  // Detect Type B (screenshot/forum posts)
  const isTypeB = memeType === "B" || (!memeType && segments.length >= 4 && segments.every(
    (s) => ["DIALOGUE", "CAPTION", "OTHER", "HEADLINE", "LABEL"].includes(s.semanticRole)
  ) && !segments.some((s) => s.semanticRole === "OVERLAY"));
  const [showTranslation, setShowTranslation] = useState(false);
  useEffect(() => {
    setShowTranslation(hasTranslation);
  }, [hasTranslation]);

  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [voteScore, setVoteScore] = useState(0);
  const [userVote, setUserVote] = useState(0);
  const [votePending, setVotePending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwnPost = (session?.user as any)?.username === author.username;

  // Load vote state
  useEffect(() => {
    fetch(`/api/posts/${id}/vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setVoteScore(data.voteScore ?? 0);
          setUserVote(data.userVote ?? 0);
        }
      })
      .catch(() => {});
  }, [id]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const handleDelete = useCallback(async () => {
    if (deletePending) return;
    setDeletePending(true);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast("Post deleted", "success");
      onDelete?.(id);
    } catch {
      toast("Failed to delete post", "error");
    } finally {
      setDeletePending(false);
      setShowDeleteConfirm(false);
    }
  }, [id, deletePending, toast, onDelete]);

  // Load bookmark state from localStorage
  useEffect(() => {
    setBookmarked(getBookmarks().has(id));
  }, [id]);

  const timeAgo = formatTimeAgo(createdAt);

  const handleVote = useCallback(async (newValue: number) => {
    if (votePending) return;
    const prevScore = voteScore;
    const prevVote = userVote;
    // Optimistic update
    const diff = newValue - prevVote;
    setVoteScore((prev) => prev + diff);
    setUserVote(newValue);
    setVotePending(true);

    try {
      const res = await fetch(`/api/posts/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: newValue }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVoteScore(data.voteScore);
    } catch {
      setVoteScore(prevScore);
      setUserVote(prevVote);
    } finally {
      setVotePending(false);
    }
  }, [id, voteScore, userVote, votePending]);

  const handleComment = () => {
    router.push(`/post/${id}`);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast(t("feed.linkCopied"), "success");
    }
  };

  const handleBookmark = () => {
    const willSave = !bookmarked;
    const bookmarks = getBookmarks();
    if (bookmarked) {
      bookmarks.delete(id);
    } else {
      bookmarks.add(id);
    }
    saveBookmarks(bookmarks);
    setBookmarked(willSave);
    // DB sync when logged in
    if (session?.user) {
      fetch("/api/bookmarks", {
        method: willSave ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: id }),
      }).catch(() => {});
    }
    toast(bookmarked ? t("feed.bookmarkRemoved") : t("feed.bookmarked"), "success");
  };

  return (
    <Card noPadding hoverable>
      {/* Creator row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Avatar
          src={author.avatarUrl}
          alt={author.displayName || author.username}
          size="md"
          countryFlag={country?.flagEmoji}
          isChampion={author.isChampion}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/user/${author.username}`}
              className="text-sm font-medium text-foreground hover:text-[#c9a84c] transition-colors truncate"
            >
              {author.displayName || author.username}
            </Link>
            {seasonBadge && (
              <Badge variant="gold" size="sm">
                {seasonBadge}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* Three-dot menu for own posts */}
        {isOwnPost && (
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Post options"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-background-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setShowDeleteConfirm(true);
                  }}
                  aria-label="Delete post"
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-background-elevated transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t("feed.deletePost")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="bg-background-surface border border-border rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-dialog-title" className="text-base font-semibold text-foreground mb-2">{t("feed.deletePost")}</h3>
            <p className="text-sm text-foreground-muted mb-4">{t("feed.deleteConfirm")}</p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted border border-border hover:bg-background-elevated transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deletePending}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletePending ? t("feed.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      {title && (
        <Link href={`/post/${id}`}>
          <h3 className="px-4 pb-2 text-[22px] font-medium text-foreground-muted hover:text-foreground transition-colors line-clamp-2">
            {translatedTitle || title}
          </h3>
          {translatedTitle && (
            <p className="px-4 pb-2 text-xs text-foreground-subtle line-clamp-1">
              {title}
            </p>
          )}
        </Link>
      )}

      {/* Translation bar above image */}
      {(segments.length > 0 || translatedImageUrl) && (
        <div className="flex items-center justify-between mx-4 px-3 py-2 bg-background-surface border border-border rounded-t-lg">
          <div className="flex items-center gap-2">
            <TranslationToggle
              showTranslation={showTranslation}
              onChange={setShowTranslation}
            />
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
              showTranslation
                ? "bg-green-500/15 text-green-400"
                : "bg-background-elevated text-foreground-subtle"
            }`}>
              {showTranslation ? (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Translated
                </>
              ) : (
                "Original"
              )}
            </span>
          </div>
          {sourceLanguage && (
            <span className="text-[11px] text-foreground-subtle font-medium">
              {langToFlag(sourceLanguage)}{"\u2192"}{langToFlag(preferredLang)}
            </span>
          )}
        </div>
      )}

      {/* Meme image(s) */}
      <Link href={`/post/${id}`} className="block">
        <div className="px-4 pb-2">
          <div className={`overflow-hidden border border-border ${(segments.length > 0 || translatedImageUrl) ? "rounded-b-lg border-t-0" : "rounded-lg"}`}>
            {isTypeB && segments.length > 0 ? (
              /* Type B: translatedImageUrl (pre-rendered) > ScreenshotRenderer > original */
              showTranslation && translatedImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={translatedImageUrl} alt={title} className="w-full" />
              ) : showTranslation ? (
                <ScreenshotRenderer
                  segments={segments}
                  showTranslation={showTranslation}
                  originalImageUrl={imageUrl}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={title} className="w-full" />
              )
            ) : images && images.length > 1 ? (
              <ImageCarousel>
                {images.map((img, i) => {
                  const imgIsGif = img.mimeType === "image/gif";
                  const imgSegments = segments.filter((s: any) => (s.imageIndex ?? 0) === i);
                  return imgIsGif ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img.originalUrl} alt={title} className="w-full" />
                  ) : (
                    <MemeRenderer
                      key={i}
                      imageUrl={img.originalUrl}
                      cleanImageUrl={img.cleanUrl || undefined}
                      translatedImageUrl={i === 0 ? translatedImageUrl : undefined}
                      segments={imgSegments}
                      showTranslation={showTranslation}
                    />
                  );
                })}
              </ImageCarousel>
            ) : isGif ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={title} className="w-full" />
            ) : (
              <MemeRenderer
                imageUrl={imageUrl}
                cleanImageUrl={cleanImageUrl}
                translatedImageUrl={translatedImageUrl}
                segments={segments}
                showTranslation={showTranslation}
              />
            )}
          </div>
        </div>
      </Link>

      {/* (Translation toggle moved above image) */}

      {/* Fallback: show translation text when segments lack bounding boxes */}
      {segments.length > 0 && !hasOverlaySegments && (
        <div className="mx-4 mb-3 p-3 bg-background-surface border border-border rounded-lg">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3.5 h-3.5 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <span className="text-[10px] font-medium text-[#c9a84c]">{t("feed.aiTranslation")}</span>
          </div>
          <div className="space-y-1.5">
            {segments.map((seg, i) => (
              <div key={i} className="text-sm">
                <span className="text-foreground-muted line-through text-xs mr-2">{seg.sourceText}</span>
                <span className="text-white">{seg.translatedText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="text-xs text-[#c9a84c]/60 hover:text-[#c9a84c] transition-colors cursor-pointer">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Top comments preview */}
      {topComments && topComments.length > 0 && (
        <Link href={`/post/${id}`} className="block px-4 pb-2">
          <div className="space-y-1.5">
            {topComments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <span className="text-xs font-medium text-foreground-muted shrink-0">
                  {c.author.countryFlag && (
                    <span className="mr-0.5">{c.author.countryFlag}</span>
                  )}
                  {c.author.displayName || c.author.username}
                </span>
                <span className="text-xs text-foreground-subtle line-clamp-1 min-w-0">
                  {c.body}
                </span>
              </div>
            ))}
            {commentCount > 3 && (
              <span className="text-[11px] text-foreground-subtle hover:text-foreground-muted transition-colors">
                {t("feed.viewAllComments", { count: commentCount })}
              </span>
            )}
          </div>
        </Link>
      )}

      {/* Vote + Action row */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border">
        {/* Reddit-style vote buttons */}
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Upvote"
            onClick={() => handleVote(userVote === 1 ? 0 : 1)}
            disabled={votePending}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              userVote === 1
                ? "text-[#c9a84c] bg-[#c9a84c]/10"
                : "text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated"
            }`}
          >
            <svg className="w-4 h-4" fill={userVote === 1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <span className={`text-xs font-bold min-w-[20px] text-center ${
            voteScore > 0 ? "text-[#c9a84c]" : voteScore < 0 ? "text-blue-400" : "text-foreground-subtle"
          }`}>
            {formatCount(voteScore)}
          </span>
          <button
            aria-label="Downvote"
            onClick={() => handleVote(userVote === -1 ? 0 : -1)}
            disabled={votePending}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              userVote === -1
                ? "text-blue-400 bg-blue-400/10"
                : "text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated"
            }`}
          >
            <svg className="w-4 h-4" fill={userVote === -1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <ActionButton
          ariaLabel="Comment"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
          count={commentCount}
          onClick={handleComment}
        />
        <ActionButton
          ariaLabel="Share"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          }
          count={shareCount}
          onClick={handleShare}
        />
        <div className="flex-1" />
        <button
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
          onClick={handleBookmark}
          className={`p-2 rounded-lg transition-all duration-200 ${bookmarked ? "text-[#c9a84c] scale-110" : "text-foreground-subtle hover:text-foreground-muted"}`}
        >
          <svg className="w-4 h-4" fill={bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        </button>
      </div>
    </Card>
  );
}

function ActionButton({
  icon,
  count,
  active,
  onClick,
  ariaLabel,
}: {
  icon: React.ReactNode;
  count: number;
  active?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all duration-200 ${
        active
          ? "text-[#c9a84c] bg-[#c9a84c]/10"
          : "text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated"
      }`}
    >
      {icon}
      {count > 0 && (
        <span className="text-xs">{formatCount(count)}</span>
      )}
    </button>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

const LANG_FLAG_MAP: Record<string, string> = {
  ko: "\uD83C\uDDF0\uD83C\uDDF7",
  en: "\uD83C\uDDFA\uD83C\uDDF8",
  ja: "\uD83C\uDDEF\uD83C\uDDF5",
  zh: "\uD83C\uDDE8\uD83C\uDDF3",
  es: "\uD83C\uDDEA\uD83C\uDDF8",
  hi: "\uD83C\uDDEE\uD83C\uDDF3",
  ar: "\uD83C\uDDF8\uD83C\uDDE6",
};

function langToFlag(code: string): string {
  return LANG_FLAG_MAP[code] || code.toUpperCase();
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
