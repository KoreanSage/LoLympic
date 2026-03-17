"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Suggestion {
  id: string;
  proposedText: string;
  originalText: string;
  reason?: string | null;
  upvoteCount: number;
  downvoteCount: number;
  status: string;
  userVote?: "up" | "down" | null;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  createdAt: string;
}

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  postId: string;
  segments?: Array<{ id: string; sourceText: string; translatedText: string }>;
  className?: string;
}

export default function SuggestionPanel({
  suggestions: initialSuggestions,
  postId,
  segments = [],
  className = "",
}: SuggestionPanelProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [showForm, setShowForm] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [proposedText, setProposedText] = useState("");
  const [reason, setReason] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch suggestions from API on mount
  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/suggestions?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      }
    } catch {
      // Fall back to initial
    }
  }, [postId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleSubmit = async () => {
    if (!proposedText.trim() || !originalText.trim()) {
      toast("Please fill in original and proposed text", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          type: "TRANSLATION",
          targetEntityType: selectedSegmentId ? "TRANSLATION_SEGMENT" : "TRANSLATION_PAYLOAD",
          targetEntityId: selectedSegmentId || postId,
          originalText: originalText.trim(),
          proposedText: proposedText.trim(),
          reason: reason.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast("Suggestion submitted!", "success");
        setShowForm(false);
        setOriginalText("");
        setProposedText("");
        setReason("");
        setSelectedSegmentId("");
        fetchSuggestions();
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || "Failed to submit suggestion", "error");
      }
    } catch {
      toast("Failed to submit suggestion", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (suggestionId: string, vote: "up" | "down") => {
    try {
      const res = await fetch(`/api/suggestions/${suggestionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId
              ? {
                  ...s,
                  upvoteCount: data.upvoteCount,
                  downvoteCount: data.downvoteCount,
                  userVote: data.vote,
                }
              : s
          )
        );
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || "Failed to vote", "error");
      }
    } catch {
      toast("Failed to vote", "error");
    }
  };

  // Sort: approved first, then by net votes
  const sorted = [...suggestions].sort((a, b) => {
    if (a.status === "APPROVED" && b.status !== "APPROVED") return -1;
    if (b.status === "APPROVED" && a.status !== "APPROVED") return 1;
    const netA = a.upvoteCount - a.downvoteCount;
    const netB = b.upvoteCount - b.downvoteCount;
    return netB - netA;
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Submit suggestion button / form */}
      {session && (
        <div>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-3 rounded-lg border border-dashed border-border-active text-sm text-foreground-muted hover:text-foreground hover:border-[#c9a84c]/40 hover:bg-background-surface transition-colors"
            >
              + Suggest a better translation
            </button>
          ) : (
            <div className="bg-background-surface border border-border rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-foreground">New Suggestion</h4>

              {/* Segment selector if available */}
              {segments.length > 0 && (
                <div>
                  <label className="block text-xs text-foreground-muted mb-1">Select segment (optional)</label>
                  <select
                    value={selectedSegmentId}
                    onChange={(e) => {
                      setSelectedSegmentId(e.target.value);
                      const seg = segments.find((s) => s.id === e.target.value);
                      if (seg) {
                        setOriginalText(seg.translatedText);
                      }
                    }}
                    className="w-full bg-background-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-active transition-colors"
                  >
                    <option value="">General suggestion</option>
                    {segments.map((seg) => (
                      <option key={seg.id} value={seg.id}>
                        {seg.sourceText.slice(0, 50)}{seg.sourceText.length > 50 ? "..." : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-foreground-muted mb-1">Original / Current translation</label>
                <textarea
                  value={originalText}
                  onChange={(e) => setOriginalText(e.target.value)}
                  placeholder="The current translation text..."
                  className="w-full bg-background-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active transition-colors"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs text-foreground-muted mb-1">Your proposed translation</label>
                <textarea
                  value={proposedText}
                  onChange={(e) => setProposedText(e.target.value)}
                  placeholder="Your improved version..."
                  className="w-full bg-background-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-border-active transition-colors"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs text-foreground-muted mb-1">Reason (optional)</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this better?"
                  className="w-full bg-background-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-border-active transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setOriginalText("");
                    setProposedText("");
                    setReason("");
                    setSelectedSegmentId("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !originalText.trim() || !proposedText.trim()}
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestions list */}
      {sorted.length === 0 ? (
        <p className="text-sm text-foreground-subtle text-center py-8">
          No suggestions yet. Be the first to improve this translation!
        </p>
      ) : (
        sorted.map((s) => (
          <SuggestionItem key={s.id} suggestion={s} onVote={handleVote} />
        ))
      )}
    </div>
  );
}

function SuggestionItem({
  suggestion,
  onVote,
}: {
  suggestion: Suggestion;
  onVote: (id: string, vote: "up" | "down") => void;
}) {
  const isApproved = suggestion.status === "APPROVED";
  const net = suggestion.upvoteCount - suggestion.downvoteCount;

  return (
    <div
      className={`
        bg-background-surface rounded-lg p-4 border transition-colors
        ${isApproved ? "border-[#c9a84c]/30" : "border-border"}
      `}
    >
      {/* Author + status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Avatar
            src={suggestion.author.avatarUrl}
            alt={suggestion.author.username}
            size="sm"
          />
          <span className="text-xs text-foreground-muted">
            {suggestion.author.displayName || suggestion.author.username}
          </span>
          <span className="text-xs text-foreground-subtle" suppressHydrationWarning>
            {new Date(suggestion.createdAt).toLocaleDateString()}
          </span>
        </div>
        {isApproved && (
          <Badge variant="gold" size="sm">
            Approved
          </Badge>
        )}
        {suggestion.status === "PENDING" && (
          <Badge variant="warning" size="sm">
            Pending
          </Badge>
        )}
        {suggestion.status === "REJECTED" && (
          <Badge variant="danger" size="sm">
            Rejected
          </Badge>
        )}
      </div>

      {/* Original vs Proposed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-foreground-subtle block mb-1">
            Original
          </span>
          <p className="text-sm text-foreground-muted line-through decoration-border-active">
            {suggestion.originalText}
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#c9a84c]/60 block mb-1">
            Proposed
          </span>
          <p className="text-sm text-foreground">{suggestion.proposedText}</p>
        </div>
      </div>

      {/* Reason */}
      {suggestion.reason && (
        <p className="text-xs text-foreground-subtle italic mb-3">
          &ldquo;{suggestion.reason}&rdquo;
        </p>
      )}

      {/* Vote buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onVote(suggestion.id, "up")}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            suggestion.userVote === "up"
              ? "text-emerald-400 bg-emerald-500/10"
              : "text-foreground-subtle hover:text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {suggestion.upvoteCount}
        </button>
        <button
          onClick={() => onVote(suggestion.id, "down")}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            suggestion.userVote === "down"
              ? "text-red-400 bg-red-500/10"
              : "text-foreground-subtle hover:text-red-400 hover:bg-red-500/10"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {suggestion.downvoteCount}
        </button>
        <span
          className={`text-xs font-mono ml-1 ${
            net > 0 ? "text-emerald-400" : net < 0 ? "text-red-400" : "text-foreground-subtle"
          }`}
        >
          {net > 0 ? "+" : ""}
          {net}
        </span>
      </div>
    </div>
  );
}
