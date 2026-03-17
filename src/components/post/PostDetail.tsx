"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import MemeRenderer from "@/components/translation/MemeRenderer";
import TranslationToggle from "@/components/translation/TranslationToggle";
import CompareMode from "@/components/translation/CompareMode";
import CultureNoteCard from "./CultureNoteCard";
import SuggestionPanel from "./SuggestionPanel";
import CommentSection from "./CommentSection";
import { TranslationSegmentData } from "@/types/components";

interface PostDetailProps {
  id: string;
  title: string;
  body?: string | null;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
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
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  createdAt: string;
  tags?: string[];
  onDelete?: () => void;
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
  body,
  author,
  country,
  imageUrl,
  cleanImageUrl,
  translatedImageUrl,
  mimeType,
  segments,
  reactionCount,
  commentCount,
  shareCount,
  viewCount,
  createdAt,
  tags,
  onDelete,
  cultureNotes = [],
  suggestions = [],
  comments = [],
}: PostDetailProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const hasOverlaySegments = segments.some(
    (s) => s.boxX != null && s.boxY != null && s.boxWidth != null && s.boxHeight != null
  );
  const isGif = mimeType === "image/gif";
  const hasTranslation = !isGif && (hasOverlaySegments || !!translatedImageUrl);
  const [showTranslation, setShowTranslation] = useState(hasTranslation);
  const [activeTab, setActiveTab] = useState("culture");
  const [showCompare, setShowCompare] = useState(false);
  const [reacted, setReacted] = useState(false);
  const [localReactionCount, setLocalReactionCount] = useState(reactionCount);
  const [saved, setSaved] = useState(false);
  const [reactPending, setReactPending] = useState(false);

  // Load user's existing reaction and bookmark state on mount
  useEffect(() => {
    // Load bookmark from localStorage
    try {
      const raw = localStorage.getItem("lolympic_bookmarks");
      const bookmarks: string[] = raw ? JSON.parse(raw) : [];
      setSaved(bookmarks.includes(id));
    } catch {}

    // Load user's reaction state from API
    fetch(`/api/posts/${id}/reactions`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setLocalReactionCount(data.total ?? reactionCount);
          if (data.userReactions && data.userReactions.length > 0) {
            setReacted(true);
          }
        }
      })
      .catch(() => {});
  }, [id, reactionCount]);

  // More options menu state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const sessionUsername = (session?.user as any)?.username;
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
        toast("Post deleted successfully", "success");
        onDelete?.();
        router.push("/");
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || "Failed to delete post", "error");
      }
    } catch {
      toast("Failed to delete post", "error");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      toast("Please select a reason", "error");
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
        toast("Report submitted. Thank you.", "success");
        setShowReportModal(false);
        setReportReason("");
        setReportDetails("");
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || "Failed to submit report", "error");
      }
    } catch {
      toast("Failed to submit report", "error");
    } finally {
      setIsReporting(false);
    }
  };

  const tabs = [
    { id: "culture", label: "Culture Note", count: cultureNotes.length },
    { id: "suggestions", label: "Suggestions", count: suggestions.length },
    { id: "comments", label: "Comments", count: commentCount },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Author header */}
      <div className="flex items-center gap-3">
        <Avatar
          src={author.avatarUrl}
          alt={author.displayName || author.username}
          size="lg"
          countryFlag={country?.flagEmoji}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {author.displayName || author.username}
            </span>
            {country && (
              <span className="text-xs text-foreground-subtle">{country.nameEn}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground-subtle">
            <span>@{author.username}</span>
            <span>&middot;</span>
            <span suppressHydrationWarning>{new Date(createdAt).toLocaleDateString()}</span>
          </div>
        </div>

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
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-background-elevated transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Post
                </button>
              )}
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
                Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-background-elevated border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Post</h3>
            <p className="text-sm text-foreground-muted mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-overlay transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => { setShowReportModal(false); setReportReason(""); setReportDetails(""); }}>
          <div className="bg-background-elevated border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">Report Post</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-foreground-muted mb-1.5">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-active transition-colors"
                >
                  <option value="">Select a reason...</option>
                  <option value="SPAM">Spam</option>
                  <option value="HARASSMENT">Harassment</option>
                  <option value="HATE_SPEECH">Hate Speech</option>
                  <option value="VIOLENCE">Violence</option>
                  <option value="SEXUAL_CONTENT">Sexual Content</option>
                  <option value="MISINFORMATION">Misinformation</option>
                  <option value="COPYRIGHT">Copyright</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-foreground-muted mb-1.5">Details (optional)</label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide additional details..."
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
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={isReporting || !reportReason}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#c9a84c] text-black hover:bg-[#b8963f] transition-colors disabled:opacity-50"
              >
                {isReporting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <h1 className="text-xl font-bold text-foreground">{title}</h1>

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

      {/* Meme viewer */}
      <div className="space-y-3">
        {/* Toggle + Compare toggle */}
        <div className="flex items-center justify-between">
          {(segments.length > 0 || translatedImageUrl) && (
            <TranslationToggle
              showTranslation={showTranslation}
              onChange={setShowTranslation}
            />
          )}
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-foreground-subtle hover:text-foreground-muted hover:bg-background-elevated border border-border transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            {showCompare ? "Single View" : "Compare"}
          </button>
        </div>

        {/* Image */}
        {isGif ? (
          <div className="rounded-xl overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title} className="w-full" />
          </div>
        ) : showCompare ? (
          <CompareMode imageUrl={imageUrl} segments={segments} />
        ) : (
          <div className="rounded-xl overflow-hidden border border-border">
            <MemeRenderer
              imageUrl={imageUrl}
              cleanImageUrl={cleanImageUrl}
              translatedImageUrl={translatedImageUrl}
              segments={segments}
              showTranslation={showTranslation}
            />
          </div>
        )}
      </div>

      {/* Body */}
      {body && (
        <p className="text-sm text-foreground-muted leading-relaxed">{body}</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-6 text-xs text-foreground-subtle">
        <span>{viewCount.toLocaleString()} views</span>
        <span>{reactionCount.toLocaleString()} reactions</span>
        <span>{commentCount.toLocaleString()} comments</span>
        <span>{shareCount.toLocaleString()} shares</span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 py-2 border-y border-border">
        <ActionButton
          label="React"
          icon="fire"
          active={reacted}
          count={localReactionCount}
          onClick={async () => {
            if (reactPending) return;
            const wasReacted = reacted;
            // Optimistic update
            setReacted(!wasReacted);
            setLocalReactionCount((prev) => (wasReacted ? prev - 1 : prev + 1));
            setReactPending(true);
            try {
              const res = await fetch(`/api/posts/${id}/reactions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "FIRE" }),
              });
              if (!res.ok) throw new Error();
              const data = await res.json();
              setLocalReactionCount((prev) => data.total ?? prev);
            } catch {
              // Revert on failure
              setReacted(wasReacted);
              setLocalReactionCount((prev) => (wasReacted ? prev + 1 : prev - 1));
            } finally {
              setReactPending(false);
            }
          }}
        />
        <ActionButton
          label="Comment"
          icon="comment"
          onClick={() => setActiveTab("comments")}
        />
        <ActionButton
          label="Share"
          icon="share"
          onClick={async () => {
            const url = window.location.href;
            if (navigator.share) {
              try { await navigator.share({ title, url }); } catch {}
            } else {
              await navigator.clipboard.writeText(url);
              toast("Link copied to clipboard!", "success");
            }
          }}
        />
        <div className="flex-1" />
        <ActionButton
          label="Save"
          icon="save"
          active={saved}
          onClick={() => {
            try {
              const raw = localStorage.getItem("lolympic_bookmarks");
              const bookmarks: string[] = raw ? JSON.parse(raw) : [];
              if (saved) {
                const filtered = bookmarks.filter((bid) => bid !== id);
                localStorage.setItem("lolympic_bookmarks", JSON.stringify(filtered));
                toast("Bookmark removed", "success");
              } else {
                if (!bookmarks.includes(id)) bookmarks.push(id);
                localStorage.setItem("lolympic_bookmarks", JSON.stringify(bookmarks));
                toast("Bookmarked!", "success");
              }
            } catch {}
            setSaved(!saved);
          }}
        />
      </div>

      {/* Tabs: Culture Note | Suggestions | Comments */}
      <Tabs
        tabs={tabs}
        defaultTab="culture"
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
                No culture notes yet
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
