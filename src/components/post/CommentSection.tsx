"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";

interface CommentAuthor {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  countryFlag?: string;
  isChampion?: boolean;
}

interface Comment {
  id: string;
  body: string;
  likeCount: number;
  userLiked?: boolean;
  createdAt: string;
  author: CommentAuthor;
  replies?: Comment[];
}

interface CommentSectionProps {
  comments: Comment[];
  postId: string;
  className?: string;
}

// ── Mention types & helpers ──────────────────────────────────────────────────

interface MentionUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  countryFlag: string | null;
}

/** Render comment body with @username turned into profile links */
function renderBodyWithMentions(body: string) {
  const parts = body.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (/^@\w+$/.test(part)) {
      const username = part.slice(1);
      return (
        <Link
          key={i}
          href={`/profile/${username}`}
          className="text-[#c9a84c] hover:underline font-medium"
        >
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── MentionDropdown ──────────────────────────────────────────────────────────

function MentionDropdown({
  query,
  postId,
  onSelect,
  visible,
  position,
}: {
  query: string;
  postId: string;
  onSelect: (user: MentionUser) => void;
  visible: boolean;
  position: { top: number; left: number };
}) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || query.length === 0) {
      setUsers([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/users/mentions?q=${encodeURIComponent(query)}&postId=${postId}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || []);
        setActiveIndex(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, postId, visible]);

  if (!visible) return null;

  return (
    <div
      ref={listRef}
      className="absolute z-50 bg-background-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto w-64"
      style={{ top: position.top, left: position.left }}
    >
      {loading && users.length === 0 && (
        <div className="px-3 py-2 text-xs text-foreground-subtle">{t("mention.searching")}</div>
      )}
      {!loading && users.length === 0 && query.length > 0 && (
        <div className="px-3 py-2 text-xs text-foreground-subtle">{t("mention.noUsers")}</div>
      )}
      {users.map((user, idx) => (
        <button
          key={user.id}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-background-overlay transition-colors ${
            idx === activeIndex ? "bg-background-overlay" : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault(); // prevent blur
            onSelect(user);
          }}
          onMouseEnter={() => setActiveIndex(idx)}
        >
          <Avatar src={user.avatarUrl} alt={user.username} size="xs" />
          <div className="flex-1 min-w-0">
            <span className="text-foreground font-medium truncate block">
              {user.countryFlag && <span className="mr-1">{user.countryFlag}</span>}
              {user.displayName || user.username}
            </span>
            <span className="text-foreground-subtle truncate block">@{user.username}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── useMention hook ──────────────────────────────────────────────────────────

function useMention(textareaRef: React.RefObject<HTMLTextAreaElement | null>) {
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionVisible, setMentionVisible] = useState(false);
  const [mentionPos, setMentionPos] = useState({ top: 0, left: 0 });
  const [mentionStart, setMentionStart] = useState(-1);

  const handleInputChange = useCallback(
    (value: string, cursorPos: number) => {
      // Look backwards from cursor for an @ not preceded by a word character
      const textBefore = value.slice(0, cursorPos);
      const match = textBefore.match(/(^|[\s])@(\w*)$/);
      if (match) {
        const query = match[2];
        setMentionQuery(query);
        setMentionStart(cursorPos - query.length - 1); // position of '@'
        setMentionVisible(true);
        // Position dropdown below textarea
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          const parentRect = textareaRef.current.offsetParent?.getBoundingClientRect();
          setMentionPos({
            top: rect.bottom - (parentRect?.top || 0) + 4,
            left: rect.left - (parentRect?.left || 0),
          });
        }
      } else {
        setMentionVisible(false);
        setMentionQuery("");
      }
    },
    [textareaRef]
  );

  const insertMention = useCallback(
    (user: MentionUser, value: string, setValue: (v: string) => void) => {
      if (mentionStart < 0) return;
      const before = value.slice(0, mentionStart);
      const after = value.slice(mentionStart + mentionQuery.length + 1); // +1 for '@'
      const newValue = `${before}@${user.username} ${after}`;
      setValue(newValue);
      setMentionVisible(false);
      setMentionQuery("");
      // Focus textarea and set cursor after inserted mention
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = mentionStart + user.username.length + 2; // @ + username + space
          textareaRef.current.focus();
          textareaRef.current.selectionStart = pos;
          textareaRef.current.selectionEnd = pos;
        }
      }, 0);
    },
    [mentionStart, mentionQuery, textareaRef]
  );

  const closeMention = useCallback(() => {
    setMentionVisible(false);
    setMentionQuery("");
  }, []);

  return {
    mentionQuery,
    mentionVisible,
    mentionPos,
    handleInputChange,
    insertMention,
    closeMention,
  };
}

export default function CommentSection({
  comments: initialComments,
  postId,
  className = "",
}: CommentSectionProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const mainMention = useMention(mainTextareaRef);

  const sessionUsername = (session?.user as any)?.username;
  const sessionAvatarUrl = (session?.user as any)?.avatarUrl || session?.user?.image || null;
  const sessionDisplayName = (session?.user as any)?.displayName || session?.user?.name || sessionUsername;

  // Map API comment to local Comment shape
  const mapComment = (c: any): Comment => ({
    id: c.id,
    body: c.body,
    likeCount: c.likeCount ?? 0,
    userLiked: c.userLiked ?? false,
    createdAt: c.createdAt,
    author: {
      username: c.author?.username || "unknown",
      displayName: c.author?.displayName,
      avatarUrl: c.author?.avatarUrl,
      countryFlag: c.author?.country?.flagEmoji,
      isChampion: c.author?.isChampion ?? false,
    },
    replies: c.replies?.map(mapComment),
  });

  // Fetch comments from API on mount
  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data.comments || [];
        setComments(raw.map(mapComment));
      }
    } catch {
      // Fall back to initial comments
    }
  }, [postId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        const comment: Comment = data.comment
          ? mapComment(data.comment)
          : {
              id: `new-${Date.now()}`,
              body: newComment.trim(),
              likeCount: 0,
              createdAt: new Date().toISOString(),
              author: {
                username: sessionUsername || "you",
                displayName: sessionDisplayName || "You",
                avatarUrl: sessionAvatarUrl,
              },
              replies: [],
            };
        setComments((prev) => [comment, ...prev]);
        setNewComment("");
      } else {
        toast(t("comment.failedPost"), "error");
      }
    } catch {
      toast("Failed to post comment", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (res.ok) {
        setComments((prev) =>
          prev
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: c.replies?.filter((r) => r.id !== commentId),
            }))
        );
        toast(t("comment.deleted"), "success");
      } else {
        toast(t("comment.failedDelete"), "error");
      }
    } catch {
      toast("Failed to delete comment", "error");
    }
  };

  const handleEditComment = async (commentId: string, newBody: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, body: newBody }),
      });
      if (res.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, body: newBody } : c))
        );
        toast(t("comment.updated"), "success");
      } else {
        toast(t("comment.failedUpdate"), "error");
      }
    } catch {
      toast("Failed to update comment", "error");
    }
  };

  const handleReportComment = async (commentId: string, reason: string, details?: string) => {
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "COMMENT",
          targetId: commentId,
          reason,
          details: details || undefined,
        }),
      });
      if (res.ok) {
        toast(t("comment.reportSubmitted"), "success");
      } else {
        toast(t("comment.failedReport"), "error");
      }
    } catch {
      toast("Failed to submit report", "error");
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Comment input */}
      {session ? (
      <div className="flex gap-3">
        <Avatar src={sessionAvatarUrl} size="md" alt={sessionDisplayName || "You"} />
        <div className="flex-1 relative">
          <textarea
            ref={mainTextareaRef}
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              mainMention.handleInputChange(e.target.value, e.target.selectionStart);
            }}
            placeholder={t("comment.add")}
            className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active transition-colors"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Escape" && mainMention.mentionVisible) {
                mainMention.closeMention();
                e.preventDefault();
                return;
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            onBlur={() => {
              // Delay to allow dropdown click
              setTimeout(() => mainMention.closeMention(), 200);
            }}
          />
          <MentionDropdown
            query={mainMention.mentionQuery}
            postId={postId}
            visible={mainMention.mentionVisible}
            position={mainMention.mentionPos}
            onSelect={(user) =>
              mainMention.insertMention(user, newComment, setNewComment)
            }
          />
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? t("comment.posting") : t("comment.post")}
            </Button>
          </div>
        </div>
      </div>
      ) : (
        <p className="text-sm text-foreground-subtle text-center py-2">
          {t("comment.loginToComment")}
        </p>
      )}

      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="space-y-1">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              sessionUsername={sessionUsername}
              onDelete={handleDeleteComment}
              onEdit={handleEditComment}
              onReport={handleReportComment}
              postId={postId}
              onReply={async (parentId, text) => {
                try {
                  const res = await fetch(`/api/posts/${postId}/comments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ body: text, parentId }),
                  });
                  if (res.ok) {
                    const data = await res.json();
                    const reply: Comment = data.comment
                      ? mapComment(data.comment)
                      : {
                          id: `reply-${Date.now()}`,
                          body: text,
                          likeCount: 0,
                          createdAt: new Date().toISOString(),
                          author: {
                            username: sessionUsername || "you",
                            displayName: sessionDisplayName || "You",
                            avatarUrl: sessionAvatarUrl,
                          },
                        };
                    setComments((prev) =>
                      prev.map((c) =>
                        c.id === parentId
                          ? { ...c, replies: [...(c.replies || []), reply] }
                          : c
                      )
                    );
                  } else {
                    toast(t("comment.failedReply"), "error");
                  }
                } catch {
                  toast("Failed to post reply", "error");
                }
              }}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground-subtle text-center py-8">
          {t("comment.empty")}
        </p>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  depth,
  sessionUsername,
  postId,
  onReply,
  onDelete,
  onEdit,
  onReport,
}: {
  comment: Comment;
  depth: number;
  sessionUsername?: string;
  postId: string;
  onReply?: (parentId: string, text: string) => void;
  onDelete?: (commentId: string) => void;
  onEdit?: (commentId: string, newBody: string) => void;
  onReport?: (commentId: string, reason: string, details?: string) => void;
}) {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyMention = useMention(replyTextareaRef);
  const [liked, setLiked] = useState(comment.userLiked ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(comment.likeCount);
  const [likePending, setLikePending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const userLang = (session?.user as any)?.preferredLanguage || "en";
  const isOwn = sessionUsername === comment.author.username;
  const timeAgo = formatTimeAgo(comment.createdAt);

  const handleTranslate = async () => {
    if (translatedText) {
      setTranslatedText(null); // Toggle off
      return;
    }
    setIsTranslating(true);
    try {
      const res = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: comment.body, targetLanguage: userLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedText(data.translated);
      }
    } catch {
      // ignore
    } finally {
      setIsTranslating(false);
    }
  };

  const handleLike = async () => {
    if (likePending) return;
    const wasLiked = liked;
    // Optimistic update
    setLiked(!wasLiked);
    setLocalLikeCount((prev) => (wasLiked ? prev - 1 : prev + 1));
    setLikePending(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${comment.id}/like`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setLiked(data.liked);
        setLocalLikeCount(data.likeCount);
      } else {
        // Revert
        setLiked(wasLiked);
        setLocalLikeCount((prev) => (wasLiked ? prev + 1 : prev - 1));
      }
    } catch {
      setLiked(wasLiked);
      setLocalLikeCount((prev) => (wasLiked ? prev + 1 : prev - 1));
    } finally {
      setLikePending(false);
    }
  };

  const handleReply = () => {
    if (!replyText.trim() || !onReply) return;
    onReply(comment.id, replyText.trim());
    setReplyText("");
    setShowReplyBox(false);
  };

  const handleSaveEdit = () => {
    if (!editText.trim() || !onEdit) return;
    onEdit(comment.id, editText.trim());
    setIsEditing(false);
  };

  const handleSubmitReport = () => {
    if (!reportReason || !onReport) return;
    onReport(comment.id, reportReason, reportDetails || undefined);
    setShowReportModal(false);
    setReportReason("");
    setReportDetails("");
  };

  return (
    <div className={depth > 0 ? "ml-10 border-l border-border pl-4" : ""}>
      <div className="py-3">
        <div className="flex gap-3">
          <Avatar
            src={comment.author.avatarUrl}
            alt={comment.author.username}
            size="sm"
            countryFlag={comment.author.countryFlag}
            isChampion={comment.author.isChampion}
          />
          <div className="flex-1 min-w-0">
            {/* Author line */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-foreground-muted">
                {comment.author.displayName || comment.author.username}
              </span>
              <span className="text-[10px] text-foreground-subtle">{timeAgo}</span>
              {isOwn && <span className="text-[10px] text-[#c9a84c]">{t("comment.you")}</span>}
            </div>

            {/* Body or edit mode */}
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full bg-background-surface border border-border-active rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveEdit();
                    if (e.key === "Escape") {
                      setIsEditing(false);
                      setEditText(comment.body);
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={handleSaveEdit} disabled={!editText.trim()}>
                    {t("comment.save")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(comment.body);
                    }}
                  >
                    {t("comment.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {renderBodyWithMentions(comment.body)}
                </p>
                {translatedText && (
                  <p className="text-sm text-foreground leading-relaxed mt-1 pl-2 border-l-2 border-[#c9a84c]/40 italic">
                    {translatedText}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            {!isEditing && (
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    liked ? "text-red-400" : "text-foreground-subtle hover:text-foreground-muted"
                  }`}
                >
                  <svg className="w-3 h-3" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {localLikeCount > 0 && localLikeCount}
                </button>
                {/* Translate */}
                {session && (
                  <button
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      translatedText
                        ? "text-[#c9a84c]"
                        : "text-foreground-subtle hover:text-foreground-muted"
                    }`}
                    title={translatedText ? t("comment.original") : t("comment.translate")}
                  >
                    {isTranslating ? (
                      <div className="w-3 h-3 border border-foreground-subtle border-t-[#c9a84c] rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                    )}
                    {translatedText ? t("comment.original") : t("comment.translate")}
                  </button>
                )}
                {depth === 0 && (
                  <button
                    onClick={() => setShowReplyBox(!showReplyBox)}
                    className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors"
                  >
                    {t("comment.reply")}
                  </button>
                )}
                {/* Edit (own comments only) */}
                {isOwn && (
                  <button
                    onClick={() => {
                      setEditText(comment.body);
                      setIsEditing(true);
                    }}
                    className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors flex items-center gap-1"
                    title={t("comment.edit")}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                {/* Delete (own comments only) */}
                {isOwn && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-foreground-subtle hover:text-red-400 transition-colors flex items-center gap-1"
                    title={t("comment.delete")}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                {/* Report (other users' comments) */}
                {!isOwn && sessionUsername && (
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors flex items-center gap-1"
                    title={t("comment.report")}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Delete confirm inline */}
            {showDeleteConfirm && (
              <div className="mt-2 flex items-center gap-2 bg-background-surface border border-border rounded-lg px-3 py-2">
                <span className="text-xs text-foreground-muted flex-1">{t("comment.deleteConfirm")}</span>
                <button
                  onClick={() => {
                    onDelete?.(comment.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-medium"
                >
                  {t("comment.delete")}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-foreground-subtle hover:text-foreground-muted"
                >
                  {t("comment.cancel")}
                </button>
              </div>
            )}

            {/* Report modal inline */}
            {showReportModal && (
              <div className="mt-2 bg-background-surface border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-foreground-muted">{t("comment.reportTitle")}</p>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-background-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-active"
                >
                  <option value="">{t("comment.reportReason")}</option>
                  <option value="Spam">{t("comment.spam")}</option>
                  <option value="Harassment">{t("comment.harassment")}</option>
                  <option value="Hate Speech">{t("comment.hateSpeech")}</option>
                  <option value="Violence">{t("comment.violence")}</option>
                  <option value="Sexual Content">{t("comment.sexualContent")}</option>
                  <option value="Misinformation">{t("comment.misinformation")}</option>
                  <option value="Copyright">{t("comment.copyrightReport")}</option>
                  <option value="Other">{t("comment.other")}</option>
                </select>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder={t("comment.reportDetails")}
                  className="w-full bg-background-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active"
                  rows={2}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason("");
                      setReportDetails("");
                    }}
                    className="text-xs text-foreground-subtle hover:text-foreground-muted px-2 py-1"
                  >
                    {t("comment.cancel")}
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={!reportReason}
                    className="text-xs text-[#c9a84c] hover:text-[#d4b85c] font-medium px-2 py-1 disabled:opacity-50"
                  >
                    {t("comment.reportSubmit")}
                  </button>
                </div>
              </div>
            )}

            {/* Reply box */}
            {showReplyBox && (
              <div className="mt-2 relative">
                <div className="flex gap-2">
                  <textarea
                    ref={replyTextareaRef}
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value);
                      replyMention.handleInputChange(e.target.value, e.target.selectionStart);
                    }}
                    placeholder={t("comment.replyPlaceholder")}
                    className="flex-1 bg-background-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && replyMention.mentionVisible) {
                        replyMention.closeMention();
                        e.preventDefault();
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                      if (e.key === "Escape") {
                        setShowReplyBox(false);
                        setReplyText("");
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => replyMention.closeMention(), 200);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleReply}
                    disabled={!replyText.trim()}
                  >
                    {t("comment.reply")}
                  </Button>
                </div>
                <MentionDropdown
                  query={replyMention.mentionQuery}
                  postId={postId}
                  visible={replyMention.mentionVisible}
                  position={replyMention.mentionPos}
                  onSelect={(user) =>
                    replyMention.insertMention(user, replyText, setReplyText)
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Replies (depth 1 only -- 2-depth max) */}
      {comment.replies && comment.replies.length > 0 && depth === 0 && (
        <div>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={1}
              sessionUsername={sessionUsername}
              postId={postId}
              onDelete={onDelete}
              onEdit={onEdit}
              onReport={onReport}
            />
          ))}
        </div>
      )}
    </div>
  );
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
  return `${Math.floor(days / 30)}mo`;
}
