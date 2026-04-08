"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
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
import ReactionUsersModal from "@/components/post/ReactionUsersModal";
import { TranslationSegmentData } from "@/types/components";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";
import ForwardModal from "@/components/post/ForwardModal";
import { formatRelativeTime } from "@/lib/utils";

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
  width?: number | null;
  height?: number | null;
}

interface FeedCardProps {
  id: string;
  title: string;
  body?: string | null;
  category?: string | null;
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
  viewCount?: number;
  createdAt: string;
  isEdited?: boolean;
  seasonBadge?: string;
  tags?: string[];
  topComments?: TopComment[];
  images?: FeedImage[];
  onDelete?: (id: string) => void;
  isBookmarked?: boolean;
}

// Bookmark helpers
function getBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("mimzy_bookmarks");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveBookmarks(ids: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mimzy_bookmarks", JSON.stringify(Array.from(ids)));
}

function FeedCardInner({
  id,
  title,
  body,
  category,
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
  viewCount,
  createdAt,
  isEdited,
  seasonBadge,
  tags,
  topComments,
  images,
  onDelete,
  isBookmarked: isBookmarkedProp,
}: FeedCardProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const preferredLang = session?.user?.preferredLanguage || "en";

  // Auto-enable translation overlay when segments with bounding boxes exist or pre-rendered image available
  const hasOverlaySegments = useMemo(
    () => segments.some(
      (s) => s.boxX != null && s.boxY != null && s.boxWidth != null && s.boxHeight != null
    ),
    [segments]
  );
  const isGif = mimeType === "image/gif";
  const isVideo = !!mimeType?.startsWith("video/");
  const isMultiImage = images && images.length > 1;
  // For multi-image posts, don't use translatedImageUrl (it contains all segments merged onto one image)
  const effectiveTranslatedImageUrl = isMultiImage ? undefined : translatedImageUrl;
  const hasImageTranslation = !isGif && !isVideo && (hasOverlaySegments || !!effectiveTranslatedImageUrl);
  const hasTranslation = hasImageTranslation || !!translatedTitle || !!translatedBody;
  const isTextOnly = !imageUrl && (!images || images.length === 0);
  const isCommunity = category === "community";

  // Detect Type B (screenshot/forum posts)
  const isTypeB = memeType === "B" || (!memeType && segments.length >= 4 && segments.every(
    (s) => ["DIALOGUE", "CAPTION", "OTHER", "HEADLINE", "LABEL"].includes(s.semanticRole)
  ) && !segments.some((s) => s.semanticRole === "OVERLAY"));
  const [showTranslation, setShowTranslation] = useState(true);
  useEffect(() => {
    setShowTranslation(hasTranslation);
  }, [hasTranslation]);

  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportPending, setReportPending] = useState(false);
  const [voteScore, setVoteScore] = useState(0);
  const [userVote, setUserVote] = useState(0);
  const [votePending, setVotePending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwnPost = session?.user?.username === author.username;
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  // Load vote state (only for authenticated users)
  useEffect(() => {
    if (!session?.user) return;
    fetch(`/api/posts/${id}/vote`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setVoteScore(data.voteScore ?? 0);
          setUserVote(data.userVote ?? 0);
        }
      })
      .catch((e) => { console.error("Failed to fetch vote state:", e); });
  }, [id, session?.user]);

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

  const handleReport = useCallback(async (reason: string) => {
    if (reportPending) return;
    setReportPending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "POST", targetId: id, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      toast(t("feed.reportSubmitted"), "success");
      setShowReportDialog(false);
    } catch {
      toast(t("feed.reportFailed"), "error");
    } finally {
      setReportPending(false);
    }
  }, [id, reportPending, toast, t]);

  const handleDelete = useCallback(async () => {
    if (deletePending) return;
    setDeletePending(true);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast(t("feed.postDeleted"), "success");
      onDelete?.(id);
    } catch {
      toast(t("feed.deleteFailed"), "error");
    } finally {
      setDeletePending(false);
      setShowDeleteConfirm(false);
    }
  }, [id, deletePending, toast, onDelete]);

  // Load bookmark state: from prop (batched) or localStorage (guest)
  useEffect(() => {
    if (isBookmarkedProp !== undefined) {
      setBookmarked(isBookmarkedProp);
    } else {
      setBookmarked(getBookmarks().has(id));
    }
  }, [isBookmarkedProp, id]);

  const timeAgo = useMemo(() => formatRelativeTime(createdAt), [createdAt]);

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

  const handleComment = useCallback(() => {
    router.push(`/post/${id}`);
  }, [router, id]);

  const handleShare = useCallback(async () => {
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
  }, [id, title, toast, t]);

  const handleBookmark = useCallback(() => {
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
      }).catch((e) => { console.error("Failed to sync bookmark to server:", e); });
    }
    toast(bookmarked ? t("feed.bookmarkRemoved") : t("feed.bookmarked"), "success");
  }, [id, bookmarked, session, toast, t]);

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
            {isEdited && (
              <span className="italic">({t("post.edited") || "\uC218\uC815\uB428"})</span>
            )}
          </div>
        </div>

        {/* Three-dot menu */}
        {session?.user && (
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
                {isOwnPost && (
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
                )}
                {!isOwnPost && (
                  <>
                    <button
                      onClick={async () => {
                        setMenuOpen(false);
                        if (!session?.user) return;
                        try {
                          await fetch(`/api/posts/${id}/translation-request`, { method: "POST" });
                          toast(t("feed.translationSent"), "success");
                        } catch {
                          toast(t("feed.translationFailed"), "error");
                        }
                      }}
                      aria-label="Request translation"
                      className="w-full text-left px-3 py-2 text-sm text-foreground-muted hover:bg-background-elevated transition-colors flex items-center gap-2"
                    >
                      <span className="text-sm">🌐</span>
                      {t("feed.requestTranslation")}
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setShowReportDialog(true);
                      }}
                      aria-label="Report post"
                      className="w-full text-left px-3 py-2 text-sm text-foreground-muted hover:bg-background-elevated transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" /></svg>
                      {t("feed.report")}
                    </button>
                  </>
                )}
                {isAdmin && (
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      try {
                        toast("Deleting translations...", "info");
                        const delRes = await fetch(`/api/posts/${id}/retranslate`, { method: "POST" });
                        const delData = await delRes.json();
                        if (!delRes.ok) { toast(`Error: ${delData.error}`, "error"); return; }
                        toast(`Deleted ${delData.deletedPayloads} translations. Retranslating...`, "info");
                        const allLangs = ["ko", "en", "ja", "zh", "es", "hi", "ar"].filter(l => l !== (sourceLanguage || delData.sourceLanguage));
                        const transRes = await fetch("/api/translate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ postId: id, sourceLanguage: sourceLanguage || delData.sourceLanguage, targetLanguages: allLangs }),
                        });
                        if (transRes.ok) {
                          toast("Retranslation complete! Refresh to see.", "success");
                        } else {
                          toast("Retranslation failed", "error");
                        }
                      } catch {
                        toast("Retranslation failed", "error");
                      }
                    }}
                    aria-label="Retranslate post"
                    className="w-full text-left px-3 py-2 text-sm text-[#c9a84c] hover:bg-background-elevated transition-colors flex items-center gap-2 border-t border-border"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                    </svg>
                    Retranslate
                  </button>
                )}
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

      {/* Report dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={() => setShowReportDialog(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            className="bg-background-surface border border-border rounded-xl p-5 mx-4 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="report-dialog-title" className="text-base font-semibold text-foreground mb-3">{t("feed.reportTitle")}</h3>
            <div className="space-y-2">
              {([
                { reason: "SPAM", label: t("feed.reportSpam") },
                { reason: "SEXUAL_CONTENT", label: t("feed.reportInappropriate") },
                { reason: "COPYRIGHT", label: t("feed.reportCopyright") },
                { reason: "OTHER", label: t("feed.reportOther") },
              ] as const).map(({ reason, label }) => (
                <button
                  key={reason}
                  onClick={() => handleReport(reason)}
                  disabled={reportPending}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-foreground-muted hover:bg-background-elevated transition-colors border border-border disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setShowReportDialog(false)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-foreground-muted border border-border hover:bg-background-elevated transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title — translated or original based on toggle */}
      {title && (
        <Link href={`/post/${id}`}>
          <h3 className="px-4 pb-2 text-[22px] font-medium text-foreground-muted hover:text-foreground transition-colors line-clamp-2">
            {showTranslation && translatedTitle ? translatedTitle : title}
          </h3>
        </Link>
      )}

      {/* Text-only post body OR community post body (community shows body before image) */}
      {(isTextOnly || isCommunity) && (
        <>
          {/* Translation toggle — controls title + body */}
          {(translatedTitle || translatedBody) && (
            <div className="flex items-center gap-2 px-4 pb-2">
              <TranslationToggle
                showTranslation={showTranslation}
                onChange={setShowTranslation}
              />
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                showTranslation
                  ? "bg-green-500/15 text-green-400"
                  : "bg-background-elevated text-foreground-subtle"
              }`}>
                {showTranslation ? t("feed.translated") : t("feed.original")}
              </span>
            </div>
          )}
          {body && (
            <Link href={`/post/${id}`} className="block">
              <div className="px-4 pb-3">
                <p className="text-sm text-foreground-muted leading-relaxed whitespace-pre-wrap">
                  {(() => {
                    const displayBody = showTranslation && translatedBody ? translatedBody : body;
                    if (displayBody.length > 300) {
                      return <>{displayBody.slice(0, 300)}...<span className="text-[#c9a84c] text-xs ml-1 hover:underline">Read more...</span></>;
                    }
                    return displayBody;
                  })()}
                </p>
              </div>
            </Link>
          )}
          {/* Community post: compact image after body */}
          {isCommunity && !isTextOnly && (imageUrl || images?.[0]?.originalUrl) && (
            <Link href={`/post/${id}`} className="block px-4 pb-3">
              <div className="overflow-hidden rounded-xl border border-border max-w-sm">
                <Image
                  src={imageUrl || images![0].originalUrl}
                  alt={title}
                  width={images?.[0]?.width || 400}
                  height={images?.[0]?.height || 300}
                  className="w-full h-auto object-cover max-h-60"
                  sizes="320px"
                />
              </div>
            </Link>
          )}
        </>
      )}

      {/* Title-only translation toggle for image posts with translated title but no image translation */}
      {!isCommunity && !isTextOnly && (translatedTitle || translatedBody) && !(segments.length > 0 || effectiveTranslatedImageUrl) && (
        <div className="flex items-center gap-2 px-4 pb-2">
          <TranslationToggle
            showTranslation={showTranslation}
            onChange={setShowTranslation}
          />
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
            showTranslation
              ? "bg-green-500/15 text-green-400"
              : "bg-background-elevated text-foreground-subtle"
          }`}>
            {showTranslation ? t("feed.translated") : t("feed.original")}
          </span>
        </div>
      )}

      {/* Meme image(s) — only for non-community posts with images */}
      {!isCommunity && !isTextOnly && (
        <Link href={`/post/${id}`} className="block" onClick={isVideo ? (e: any) => e.preventDefault() : undefined}>
          <div className="px-4 pb-2">
            <div className={`overflow-hidden border border-border flex items-center justify-center bg-black/20 relative rounded-lg`}>
              {/* Floating translation toggle on image */}
              {(segments.length > 0 || effectiveTranslatedImageUrl) && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTranslation(!showTranslation); }}
                  className="absolute top-2 ltr:right-2 rtl:left-2 z-10 flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium hover:bg-black/75 transition-all shadow-lg whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  {showTranslation ? t("feed.original") : t("feed.translated")}
                </button>
              )}
              {/* Video playback */}
              {isVideo ? (
                <video
                  src={imageUrl}
                  className="w-full h-auto max-h-[600px] object-contain"
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              ) : images && images.length > 1 ? (
                <ImageCarousel>
                  {images.map((img, i) => {
                    const imgIsGif = img.mimeType === "image/gif";
                    const imgIsVideo = img.mimeType?.startsWith("video/");
                    const imgSegments = segments.filter((s: any) => (s.imageIndex ?? 0) === i);
                    return (
                      <div key={i} className="w-full flex items-center justify-center bg-black/5 dark:bg-black/20">
                        {imgIsVideo ? (
                          <video
                            src={img.originalUrl}
                            className="w-full h-auto max-h-[600px] object-contain"
                            controls
                            muted
                            loop
                            playsInline
                            preload="metadata"
                          />
                        ) : imgIsGif ? (
                          <Image src={img.originalUrl} alt={title} width={img.width || 800} height={img.height || 800} className="w-full h-auto object-contain max-h-[700px]" sizes="(max-width: 768px) 100vw, 600px" unoptimized />
                        ) : (
                          <MemeRenderer
                            imageUrl={img.originalUrl}
                            cleanImageUrl={img.cleanUrl || undefined}
                            translatedImageUrl={undefined}
                            segments={imgSegments}
                            showTranslation={showTranslation}
                            maxHeight={700}
                          />
                        )}
                      </div>
                    );
                  })}
                </ImageCarousel>
              ) : showTranslation && effectiveTranslatedImageUrl ? (
                <Image src={effectiveTranslatedImageUrl} alt={title} width={800} height={800} className="w-full h-auto object-contain max-h-[600px]" sizes="(max-width: 768px) 100vw, 600px" unoptimized />
              ) : isTypeB && segments.length > 0 ? (
                showTranslation ? (
                  <ScreenshotRenderer
                    segments={segments.filter((s: any) => (s.imageIndex ?? 0) === 0)}
                    showTranslation={showTranslation}
                    originalImageUrl={imageUrl}
                  />
                ) : (
                  <Image src={imageUrl} alt={title} width={800} height={800} className="w-full h-auto object-contain max-h-[600px]" sizes="(max-width: 768px) 100vw, 600px" unoptimized />
                )
              ) : isGif ? (
                <Image src={imageUrl} alt={title} width={800} height={800} className="w-full h-auto object-contain max-h-[600px]" sizes="(max-width: 768px) 100vw, 600px" unoptimized />
              ) : (
                <MemeRenderer
                  imageUrl={imageUrl}
                  cleanImageUrl={cleanImageUrl}
                  translatedImageUrl={effectiveTranslatedImageUrl}
                  segments={segments.filter((s: any) => (s.imageIndex ?? 0) === 0)}
                  showTranslation={showTranslation}
                  maxHeight={600}
                />
              )}
              {/* Bottom gradient for readability */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            </div>
          </div>
        </Link>
      )}

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
      <div className="flex items-center gap-1.5 px-4 py-3 border-t border-border">
        {/* Reddit-style vote buttons */}
        <div className="flex items-center gap-0.5">
          <button
            aria-label="Upvote"
            onClick={() => handleVote(userVote === 1 ? 0 : 1)}
            disabled={votePending}
            className={`p-2 rounded-lg transition-all duration-200 active:scale-90 ${
              userVote === 1
                ? "text-[#c9a84c] bg-[#c9a84c]/15"
                : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
            }`}
          >
            <svg className="w-5 h-5" fill={userVote === 1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => setShowReactionsModal(true)}
            className={`text-sm font-bold min-w-[24px] text-center hover:underline cursor-pointer ${
              voteScore > 0 ? "text-[#c9a84c]" : voteScore < 0 ? "text-blue-400" : "text-foreground-muted"
            }`}
          >
            {formatCount(voteScore)}
          </button>
          <button
            aria-label="Downvote"
            onClick={() => handleVote(userVote === -1 ? 0 : -1)}
            disabled={votePending}
            className={`p-2 rounded-lg transition-all duration-200 active:scale-90 ${
              userVote === -1
                ? "text-blue-400 bg-blue-400/15"
                : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
            }`}
          >
            <svg className="w-5 h-5" fill={userVote === -1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
        <ActionButton
          ariaLabel="Download"
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          }
          count={0}
          onClick={() => {
            const lang = localStorage.getItem("mimzy_preferredLanguage") || preferredLang || "en";
            const a = document.createElement("a");
            a.href = `/api/posts/${id}/download?lang=${lang}`;
            a.download = "";
            a.click();
          }}
        />
        <ActionButton
          ariaLabel={t("post.forward") || "Forward"}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
            </svg>
          }
          count={0}
          onClick={() => setShowForwardModal(true)}
        />
        <div className="flex-1" />
        {viewCount != null && viewCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-foreground-subtle mr-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {formatCount(viewCount)}
          </span>
        )}
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

      {/* Reactions modal */}
      {showReactionsModal && (
        <ReactionUsersModal postId={id} onClose={() => setShowReactionsModal(false)} />
      )}

      {/* Forward modal */}
      {showForwardModal && (
        <ForwardModal postId={id} onClose={() => setShowForwardModal(false)} />
      )}
    </Card>
  );
}

const FeedCard = React.memo(FeedCardInner);
export default FeedCard;

const ActionButton = React.memo(function ActionButton({
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
      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg transition-all duration-200 active:scale-95 ${
        active
          ? "text-[#c9a84c] bg-[#c9a84c]/15"
          : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
      }`}
    >
      {icon}
      {count > 0 && (
        <span className="text-sm font-medium">{formatCount(count)}</span>
      )}
    </button>
  );
});

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

