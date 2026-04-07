"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import MemeRenderer from "@/components/translation/MemeRenderer";
import ScreenshotRenderer from "@/components/translation/ScreenshotRenderer";
import TranslationToggle from "@/components/translation/TranslationToggle";
import CompareMode from "@/components/translation/CompareMode";
import ImageCarousel from "@/components/ui/ImageCarousel";
import { Pencil } from "lucide-react";
import CultureNoteCard from "./CultureNoteCard";
import SuggestionPanel from "./SuggestionPanel";
import ReactionUsersModal from "./ReactionUsersModal";
import CommentSection from "./CommentSection";
import PostEditModal from "./PostEditModal";
import ForwardModal from "./ForwardModal";
import { TranslationSegmentData } from "@/types/components";

interface PostDetailProps {
  id: string;
  title: string;
  originalTitle?: string;
  body?: string | null;
  originalBody?: string | null;
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
  category?: string | null;
  imageUrl: string;
  cleanImageUrl?: string;
  translatedImageUrl?: string;
  mimeType?: string;
  segments: TranslationSegmentData[];
  memeType?: string;
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: string;
  isEdited?: boolean;
  tags?: string[];
  images?: Array<{
    originalUrl: string;
    cleanUrl?: string | null;
    mimeType?: string | null;
  }>;
  onDelete?: () => void;
  preferredLang?: string;
  cultureNotes?: Array<{
    id: string;
    summary: string;
    explanation: string;
    translationNote?: string | null;
    creatorType: string;
    status: string;
  }>;
  suggestions?: Array<{
    id: string;
    proposedText: string;
    originalText: string;
    reason?: string | null;
    upvoteCount: number;
    downvoteCount: number;
    status: string;
    author: {
      username: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
    createdAt: string;
  }>;
  comments?: Array<{
    id: string;
    body: string;
    likeCount: number;
    createdAt: string;
    author: {
      username: string;
      displayName?: string | null;
      avatarUrl?: string | null;
      countryFlag?: string;
    };
    replies?: Array<{
      id: string;
      body: string;
      likeCount: number;
      createdAt: string;
      author: {
        username: string;
        displayName?: string | null;
        avatarUrl?: string | null;
        countryFlag?: string;
      };
    }>;
  }>;
}

export default function PostDetail({
  id,
  title,
  originalTitle,
  body,
  originalBody,
  author,
  country,
  category,
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
  tags,
  images,
  onDelete,
  preferredLang: preferredLangProp,
  cultureNotes = [],
  suggestions = [],
  comments = [],
}: PostDetailProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation();
  const hasOverlaySegments = segments.some(
    (s) => s.boxX != null && s.boxY != null && s.boxWidth != null && s.boxHeight != null
  );
  const isGif = mimeType === "image/gif";
  const isTextOnly = !imageUrl && (!images || images.length === 0);
  const hasTranslation = !isGif && (hasOverlaySegments || !!translatedImageUrl || (isTextOnly && (!!originalTitle || !!originalBody)));

  // Detect Type B (screenshot/forum posts) — use explicit memeType or heuristic
  const isTypeB = memeType === "B" || (!memeType && segments.length >= 4 && segments.every(
    (s) => ["DIALOGUE", "CAPTION", "OTHER", "HEADLINE", "LABEL"].includes(s.semanticRole)
  ) && !segments.some((s) => s.semanticRole === "OVERLAY"));
  const [showTranslation, setShowTranslation] = useState(hasTranslation);
  const [activeTab, setActiveTab] = useState("comments");
  const [showCompare, setShowCompare] = useState(false);
  const [saved, setSaved] = useState(false);
  const [voteScore, setVoteScore] = useState(0);
  const [userVote, setUserVote] = useState(0);
  const [votePending, setVotePending] = useState(false);

  // Load user's existing reaction and bookmark state on mount
  useEffect(() => {
    // Load bookmark from localStorage first (instant)
    try {
      const raw = localStorage.getItem("mimzy_bookmarks");
      const bookmarks: string[] = raw ? JSON.parse(raw) : [];
      setSaved(bookmarks.includes(id));
    } catch (e) {
      console.error("Failed to read bookmarks from localStorage:", e);
    }

    // If logged in, verify bookmark from server
    if (session?.user) {
      fetch("/api/bookmarks?limit=100")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.postIds) {
            const serverSaved = (data.postIds as string[]).includes(id);
            setSaved(serverSaved);
          }
        })
        .catch(() => { /* keep localStorage state */ });
    }

    // Load user's vote state from API
    if (!session?.user) return;
    fetch(`/api/posts/${id}/vote`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setVoteScore(data.voteScore ?? 0);
          setUserVote(data.userVote ?? 0);
        }
      })
      .catch((e) => { console.error("Failed to fetch vote state:", e); });
  }, [id, session?.user?.id]);

  // Edit and forward modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReactionsModal, setShowReactionsModal] = useState(false);

  // More options menu state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const sessionUsername = session?.user?.username;
  const isOwnPost = sessionUsername === author.username;

  // Close more menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showMoreMenu]);

  const handleDeletePost = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast(t("feed.deletePost"), "success");
        onDelete?.();
        router.push("/");
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || t("common.error"), "error");
      }
    } catch {
      toast(t("common.error"), "error");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      toast(t("comment.reportReason"), "error");
      return;
    }
    setIsReporting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "POST",
          targetId: id,
          reason: reportReason,
          details: reportDetails || undefined,
        }),
      });
      if (res.ok) {
        toast(t("comment.reportSubmitted"), "success");
        setShowReportModal(false);
        setReportReason("");
        setReportDetails("");
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || t("comment.failedReport"), "error");
      }
    } catch {
      toast(t("comment.failedReport"), "error");
    } finally {
      setIsReporting(false);
    }
  };

  const preferredLang = preferredLangProp || session?.user?.preferredLanguage || "en";

  const tabs = [
    { id: "comments", label: t("post.comments"), count: commentCount },
    { id: "culture", label: t("post.cultureNote"), count: cultureNotes.length },
    { id: "suggestions", label: t("post.discussion"), count: suggestions.length },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {/* Author header */}
      <div className="flex items-center gap-2">
        <Avatar
          src={author.avatarUrl}
          alt={author.displayName || author.username}
          size="md"
          countryFlag={country?.flagEmoji}
          isChampion={author.isChampion}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">
              {author.displayName || author.username}
            </span>
            {country && (
              <span className="text-xs text-foreground-subtle">{country.nameEn}</span>
            )}
            <span className="text-xs text-foreground-subtle">·</span>
            <span className="text-xs text-foreground-subtle" suppressHydrationWarning>{new Date(createdAt).toLocaleDateString()}</span>
            {isEdited && (
              <>
                <span className="text-xs text-foreground-subtle">·</span>
                <span className="text-xs text-foreground-subtle italic">{t("post.edited") || "\uC218\uC815\uB428"}</span>
              </>
            )}
          </div>
        </div>

        {/* Edit button (author only) */}
        {isOwnPost && (
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated transition-colors"
            aria-label={t("post.editPost") || "Edit post"}
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        {/* More options */}
        <div className="relative" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-2 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated transition-colors"
            aria-label="More options"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-background-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50">
              {isOwnPost && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowEditModal(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground-muted hover:bg-background-elevated transition-colors flex items-center gap-2"
                >
                  <Pencil className="w-4 h-4" />
                  {t("post.editPost") || "Edit Post"}
                </button>
              )}
              {isOwnPost && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-background-elevated transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {t("post.deletePost")}
                </button>
              )}
              {!isOwnPost && (
                <button
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowReportModal(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-foreground-muted hover:bg-background-elevated transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                  </svg>
                  {t("post.reportPost")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-background-elevated border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-2">{t("feed.deletePost")}</h3>
            <p className="text-sm text-foreground-muted mb-6">
              {t("feed.deleteConfirm")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-overlay transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDeletePost}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {isDeleting ? t("feed.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => { setShowReportModal(false); setReportReason(""); setReportDetails(""); }}>
          <div className="bg-background-elevated border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">{t("post.reportPost")}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-foreground-muted mb-1.5">{t("comment.reportReason")}</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-active transition-colors"
                >
                  <option value="">{t("comment.reportReason")}</option>
                  <option value="SPAM">{t("comment.spam")}</option>
                  <option value="HARASSMENT">{t("comment.harassment")}</option>
                  <option value="HATE_SPEECH">{t("comment.hateSpeech")}</option>
                  <option value="VIOLENCE">{t("comment.violence")}</option>
                  <option value="SEXUAL_CONTENT">{t("comment.sexualContent")}</option>
                  <option value="MISINFORMATION">{t("comment.misinformation")}</option>
                  <option value="COPYRIGHT">{t("comment.copyrightReport")}</option>
                  <option value="OTHER">{t("comment.other")}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1.5">{t("comment.reportDetails")}</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder={t("comment.reportDetails")}
                  className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active transition-colors"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason("");
                  setReportDetails("");
                }}
                className="px-4 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-overlay transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReport}
                disabled={isReporting || !reportReason}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#c9a84c] text-black hover:bg-[#b8963f] transition-colors disabled:opacity-50"
              >
                {isReporting ? t("common.loading") : t("comment.reportSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title — shows translated or original based on toggle */}
      <h1 className="text-lg font-bold text-foreground leading-snug">
        {showTranslation ? title : (originalTitle || title)}
      </h1>

      {/* Translation toggle for text posts (title + body) */}
      {isTextOnly && (originalTitle || originalBody) && (
        <div className="flex items-center gap-2 -mt-1">
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

      {/* Category badge */}
      {isTextOnly && category && category !== "meme" && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-background-surface border border-border text-foreground-muted w-fit">
          {category === "community" ? "💬 Community" : category}
        </span>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="default">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Text-only post: show body */}
      {isTextOnly && body && (
        <div className="bg-background-surface border border-border rounded-xl p-5">
          <p className="text-base text-foreground-muted leading-relaxed whitespace-pre-wrap">
            {showTranslation ? body : (originalBody || body)}
          </p>
        </div>
      )}

      {/* Meme viewer — only for posts with images */}
      {!isTextOnly && <div className="space-y-0 -mt-1">
        {/* Translation bar above image */}
        {(segments.length > 0 || translatedImageUrl) && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-background-surface border border-border rounded-t-xl">
            <div className="flex items-center gap-2">
              <TranslationToggle
                showTranslation={showTranslation}
                onChange={setShowTranslation}
              />
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                showTranslation
                  ? "bg-green-500/15 text-green-400"
                  : "bg-background-elevated text-foreground-subtle"
              }`}>
                {showTranslation ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("feed.translated")}
                  </>
                ) : (
                  t("feed.original")
                )}
              </span>
            </div>
            <button
              onClick={() => setShowCompare(!showCompare)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated border border-border transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
              {showCompare ? t("post.original") : t("post.translated")}
            </button>
          </div>
        )}

        {/* Image(s) */}
        {/* Priority 0: Compare mode (side-by-side original + translated) */}
        {showCompare && translatedImageUrl ? (
          <div className={`overflow-hidden border border-border rounded-b-xl border-t-0`}>
            <div className="grid grid-cols-2 gap-0.5 bg-border">
              <div className="bg-black/5 flex items-center justify-center">
                <Image src={imageUrl} alt="Original" width={800} height={800} className="w-full h-full object-contain" unoptimized />
              </div>
              <div className="bg-black/5 flex items-center justify-center">
                <Image src={translatedImageUrl} alt="Translated" width={800} height={800} className="w-full h-full object-contain" unoptimized />
              </div>
            </div>
          </div>
        ) : showTranslation && translatedImageUrl ? (
          <div className={`overflow-hidden border border-border flex items-center justify-center bg-black/5 ${(segments.length > 0 || translatedImageUrl) ? "rounded-b-xl border-t-0" : "rounded-xl"}`}>
            <Image src={translatedImageUrl} alt={title} width={800} height={800} className="w-full h-full object-contain" unoptimized />
          </div>
        ) : isTypeB && segments.length > 0 ? (
          /* Type B without translatedImageUrl: ScreenshotRenderer > original */
          <div className={`overflow-hidden border border-border flex items-center justify-center bg-black/5 ${(segments.length > 0 || translatedImageUrl) ? "rounded-b-xl border-t-0" : "rounded-xl"}`}>
            {showTranslation ? (
              <ScreenshotRenderer
                segments={segments}
                showTranslation={showTranslation}
                originalImageUrl={imageUrl}
              />
            ) : (
              <Image src={imageUrl} alt={title} width={800} height={800} className="w-full h-full object-contain" unoptimized />
            )}
          </div>
        ) : images && images.length > 1 ? (
          <div className={`overflow-hidden border border-border ${(segments.length > 0 || translatedImageUrl) ? "rounded-b-xl border-t-0" : "rounded-xl"}`}>
            <ImageCarousel>
              {images.map((img, i) => {
                const imgIsGif = img.mimeType === "image/gif";
                const imgSegments = segments.filter((s: any) => (s.imageIndex ?? 0) === i);
                return (
                  <div key={i} className="flex items-center justify-center bg-black/5 dark:bg-black/20">
                    {imgIsGif ? (
                      <Image src={img.originalUrl} alt={title} width={800} height={800} className="w-full h-auto object-contain" unoptimized />
                    ) : (
                      <MemeRenderer
                        imageUrl={img.originalUrl}
                        cleanImageUrl={img.cleanUrl || undefined}
                        translatedImageUrl={i === 0 ? translatedImageUrl : undefined}
                        segments={imgSegments}
                        showTranslation={showTranslation}
                      />
                    )}
                  </div>
                );
              })}
            </ImageCarousel>
          </div>
        ) : isGif ? (
          <div className={`overflow-hidden border border-border flex items-center justify-center bg-black/5 ${(segments.length > 0 || translatedImageUrl) ? "rounded-b-xl border-t-0" : "rounded-xl"}`}>
            <Image src={imageUrl} alt={title} width={800} height={800} className="w-full h-full object-contain" unoptimized />
          </div>
        ) : (
          <div className={`overflow-hidden border border-border flex items-center justify-center ${(segments.length > 0 || translatedImageUrl) ? "rounded-b-xl border-t-0" : "rounded-xl"}`}>
            <MemeRenderer
              imageUrl={imageUrl}
              cleanImageUrl={cleanImageUrl}
              translatedImageUrl={translatedImageUrl}
              segments={segments}
              showTranslation={showTranslation}
            />
          </div>
        )}
      </div>}

      {/* Body (for meme posts that also have body text) */}
      {!isTextOnly && body && (
        <div>
          <p className="text-base sm:text-lg text-foreground-muted leading-relaxed whitespace-pre-wrap">{body}</p>
          {originalBody && (
            <p className="text-sm text-foreground-subtle mt-1 whitespace-pre-wrap">{originalBody}</p>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-foreground-subtle -mb-1">
        <button onClick={() => setShowReactionsModal(true)} className="hover:text-foreground-muted hover:underline transition-colors">
          {reactionCount.toLocaleString()} reactions
        </button>
        <span>{viewCount.toLocaleString()} {t("post.views")}</span>
        <span>{commentCount.toLocaleString()} {t("post.comments")}</span>
        <span>{shareCount.toLocaleString()} {t("post.shares")}</span>
      </div>

      {/* Reactions modal */}
      {showReactionsModal && (
        <ReactionUsersModal postId={id} onClose={() => setShowReactionsModal(false)} />
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 py-1.5 border-y border-border">
        {/* Upvote / Score / Downvote */}
        <div className="flex items-center gap-1">
          <button
            aria-label="Upvote"
            onClick={async () => {
              if (votePending) return;
              const prevVote = userVote;
              const prevScore = voteScore;
              const newVal = userVote === 1 ? 0 : 1;
              const diff = newVal - userVote;
              setVoteScore((p) => p + diff);
              setUserVote(newVal);
              setVotePending(true);
              try {
                const res = await fetch(`/api/posts/${id}/vote`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ value: newVal }),
                });
                if (res.ok) { const d = await res.json(); setVoteScore(d.voteScore); }
              } catch { setVoteScore(prevScore); setUserVote(prevVote); }
              finally { setVotePending(false); }
            }}
            className={`p-2 rounded-lg transition-all ${userVote === 1 ? "text-[#c9a84c] bg-[#c9a84c]/10" : "text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated"}`}
          >
            <svg className="w-5 h-5" fill={userVote === 1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <span className={`text-sm font-bold min-w-[24px] text-center ${voteScore > 0 ? "text-[#c9a84c]" : voteScore < 0 ? "text-blue-400" : "text-foreground-subtle"}`}>
            {voteScore}
          </span>
          <button
            aria-label="Downvote"
            onClick={async () => {
              if (votePending) return;
              const prevVote = userVote;
              const prevScore = voteScore;
              const newVal = userVote === -1 ? 0 : -1;
              const diff = newVal - userVote;
              setVoteScore((p) => p + diff);
              setUserVote(newVal);
              setVotePending(true);
              try {
                const res = await fetch(`/api/posts/${id}/vote`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ value: newVal }),
                });
                if (res.ok) { const d = await res.json(); setVoteScore(d.voteScore); }
              } catch { setVoteScore(prevScore); setUserVote(prevVote); }
              finally { setVotePending(false); }
            }}
            className={`p-2 rounded-lg transition-all ${userVote === -1 ? "text-blue-400 bg-blue-400/10" : "text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated"}`}
          >
            <svg className="w-5 h-5" fill={userVote === -1 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <ActionButton
          label={t("post.comments")}
          icon="comment"
          onClick={() => setActiveTab("comments")}
        />
        <ActionButton
          label={t("post.sharePost")}
          icon="share"
          onClick={async () => {
            const url = window.location.href;
            if (navigator.share) {
              try { await navigator.share({ title, url }); } catch (e) { console.error("Share failed:", e); }
            } else {
              try {
                await navigator.clipboard.writeText(url);
                toast(t("feed.linkCopied"), "success");
              } catch {
                toast(t("feed.linkCopied"), "success"); // fallback - some browsers block clipboard
              }
            }
          }}
        />
        <ActionButton
          label={t("post.forward") || "\uC804\uB2EC"}
          icon="forward"
          onClick={() => setShowForwardModal(true)}
        />
        <div className="flex-1" />
        <ActionButton
          label={t("feed.save") || "Save"}
          icon="save"
          active={saved}
          onClick={() => {
            const willSave = !saved;
            // localStorage update
            try {
              const raw = localStorage.getItem("mimzy_bookmarks");
              const bookmarks: string[] = raw ? JSON.parse(raw) : [];
              if (saved) {
                const filtered = bookmarks.filter((bid) => bid !== id);
                localStorage.setItem("mimzy_bookmarks", JSON.stringify(filtered));
              } else {
                if (!bookmarks.includes(id)) bookmarks.push(id);
                localStorage.setItem("mimzy_bookmarks", JSON.stringify(bookmarks));
              }
            } catch (e) {
              console.error("Failed to update bookmarks in localStorage:", e);
            }
            // DB sync when logged in
            if (session?.user) {
              fetch("/api/bookmarks", {
                method: willSave ? "POST" : "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ postId: id }),
              }).catch((e) => { console.error("Failed to sync bookmark to server:", e); });
            }
            setSaved(willSave);
            toast(saved ? t("feed.bookmarkRemoved") : t("feed.bookmarked"), "success");
          }}
        />
      </div>

      {/* Tabs: Culture Note | Suggestions | Comments */}
      <Tabs
        tabs={tabs}
        defaultTab="comments"
        onChange={setActiveTab}
      />

      {/* Tab content */}
      <div className="pb-16">
        {activeTab === "culture" && (
          <div className="space-y-3">
            {cultureNotes.length > 0 ? (
              cultureNotes.map((note) => (
                <CultureNoteCard key={note.id} {...note} />
              ))
            ) : (
              <p className="text-sm text-foreground-subtle text-center py-8">
                {t("post.cultureNote")}
              </p>
            )}
          </div>
        )}

        {activeTab === "suggestions" && (
          <SuggestionPanel
            suggestions={suggestions}
            postId={id}
            segments={segments.map((s) => ({
              id: s.id || "",
              sourceText: s.sourceText || "",
              translatedText: s.translatedText || "",
            }))}
          />
        )}

        {activeTab === "comments" && (
          <CommentSection comments={comments} postId={id} />
        )}
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <PostEditModal
          post={{ id, title, body: body || undefined, category: category || undefined, tags }}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            // Refresh server data to reflect changes
            router.refresh();
          }}
        />
      )}

      {/* Forward modal */}
      {showForwardModal && (
        <ForwardModal postId={id} onClose={() => setShowForwardModal(false)} />
      )}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  active,
  count,
  onClick,
}: {
  label: string;
  icon: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    fire: (
      <svg className="w-4 h-4" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
    ),
    comment: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    share: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    save: (
      <svg className="w-4 h-4" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
    forward: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
      </svg>
    ),
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-sm ${
        active
          ? "text-[#c9a84c] bg-[#c9a84c]/10"
          : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
      }`}
    >
      {icons[icon]}
      {count !== undefined && <span className="text-xs">{count}</span>}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
