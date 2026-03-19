"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

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

export default function CommentSection({
  comments: initialComments,
  postId,
  className = "",
}: CommentSectionProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        toast("Failed to post comment", "error");
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
        toast("Comment deleted", "success");
      } else {
        toast("Failed to delete comment", "error");
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
        toast("Comment updated", "success");
      } else {
        toast("Failed to update comment", "error");
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
        toast("Report submitted. Thank you.", "success");
      } else {
        toast("Failed to submit report", "error");
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
        <div className="flex-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active transition-colors"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <div className="flex justify-end mt-2">
            <Button
              size="sm"
              variant="primary"
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
            >
              {isSubmitting ? "Posting..." : "Comment"}
            </Button>
          </div>
        </div>
      </div>
      ) : (
        <p className="text-sm text-foreground-subtle text-center py-2">
          Log in to leave a comment.
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
                    toast("Failed to post reply", "error");
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
          No comments yet. Start the conversation!
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
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState("");
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
              {isOwn && <span className="text-[10px] text-[#c9a84c]">you</span>}
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
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(comment.body);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-foreground-muted leading-relaxed">
                  {comment.body}
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
                    title={translatedText ? "Hide translation" : "Translate"}
                  >
                    {isTranslating ? (
                      <div className="w-3 h-3 border border-foreground-subtle border-t-[#c9a84c] rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                      </svg>
                    )}
                    {translatedText ? "Original" : "Translate"}
                  </button>
                )}
                {depth === 0 && (
                  <button
                    onClick={() => setShowReplyBox(!showReplyBox)}
                    className="text-xs text-foreground-subtle hover:text-foreground-muted transition-colors"
                  >
                    Reply
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
                    title="Edit"
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
                    title="Delete"
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
                    title="Report"
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
                <span className="text-xs text-foreground-muted flex-1">Delete this comment?</span>
                <button
                  onClick={() => {
                    onDelete?.(comment.id);
                    setShowDeleteConfirm(false);
                  }}
                  className="text-xs text-red-400 hover:text-red-300 font-medium"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs text-foreground-subtle hover:text-foreground-muted"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Report modal inline */}
            {showReportModal && (
              <div className="mt-2 bg-background-surface border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-foreground-muted">Report Comment</p>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-background-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-border-active"
                >
                  <option value="">Select a reason...</option>
                  <option value="Spam">Spam</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Hate Speech">Hate Speech</option>
                  <option value="Violence">Violence</option>
                  <option value="Sexual Content">Sexual Content</option>
                  <option value="Misinformation">Misinformation</option>
                  <option value="Copyright">Copyright</option>
                  <option value="Other">Other</option>
                </select>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Details (optional)..."
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
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReport}
                    disabled={!reportReason}
                    className="text-xs text-[#c9a84c] hover:text-[#d4b85c] font-medium px-2 py-1 disabled:opacity-50"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Reply box */}
            {showReplyBox && (
              <div className="mt-2 flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a reply..."
                  className="flex-1 bg-background-surface border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-foreground-subtle focus:outline-none focus:border-border-active"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleReply();
                    if (e.key === "Escape") {
                      setShowReplyBox(false);
                      setReplyText("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                >
                  Reply
                </Button>
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
