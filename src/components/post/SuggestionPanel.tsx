"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";

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
    country?: { flagEmoji?: string } | null;
  };
  createdAt: string;
}

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  postId: string;
  segments?: Array<{ id: string; sourceText: string; translatedText: string }>;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

export default function SuggestionPanel({
  suggestions: initialSuggestions,
  postId,
  className = "",
}: SuggestionPanelProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/suggestions?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.suggestions) setSuggestions(data.suggestions);
      }
    } catch {
      // ignore
    }
  }, [postId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          type: "TRANSLATION",
          targetEntityType: "TRANSLATION_PAYLOAD",
          targetEntityId: postId,
          originalText: "",
          proposedText: body.trim(),
        }),
      });
      if (res.ok) {
        setBody("");
        fetchSuggestions();
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || "Failed to post", "error");
      }
    } catch {
      toast("Failed to post", "error");
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
              ? { ...s, upvoteCount: data.upvoteCount, downvoteCount: data.downvoteCount, userVote: data.vote }
              : s
          )
        );
      }
    } catch {
      toast("Failed to vote", "error");
    }
  };

  const sorted = [...suggestions].sort((a, b) => {
    if (a.status === "APPROVED" && b.status !== "APPROVED") return -1;
    if (b.status === "APPROVED" && a.status !== "APPROVED") return 1;
    return (b.upvoteCount - b.downvoteCount) - (a.upvoteCount - a.downvoteCount);
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Input */}
      {session && (
        <div className="flex gap-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit();
            }}
            placeholder={t("discussion.placeholder")}
            className="flex-1 bg-background-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle resize-none focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
            rows={2}
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !body.trim()}
            className="self-end px-4 py-2 rounded-lg bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#d4b85e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t("discussion.posting") : t("discussion.post")}
          </button>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 ? (
        <p className="text-sm text-foreground-subtle text-center py-8">
          {t("discussion.empty")}
        </p>
      ) : (
        sorted.map((s) => (
          <DiscussionItem key={s.id} item={s} onVote={handleVote} />
        ))
      )}
    </div>
  );
}

function DiscussionItem({
  item,
  onVote,
}: {
  item: Suggestion;
  onVote: (id: string, vote: "up" | "down") => void;
}) {
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const { data: session } = useSession();
  const { t } = useTranslation();
  const preferredLang = (session?.user as any)?.preferredLanguage || "en";

  const handleTranslate = async () => {
    if (translatedText) {
      setTranslatedText(null);
      return;
    }
    setIsTranslating(true);
    try {
      const res = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: item.proposedText,
          targetLanguage: preferredLang,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedText(data.translatedText);
      }
    } catch {
      // ignore
    } finally {
      setIsTranslating(false);
    }
  };

  const net = item.upvoteCount - item.downvoteCount;

  return (
    <div className="bg-background-surface rounded-lg p-4 border border-border">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Avatar src={item.author.avatarUrl} alt={item.author.username} size="sm" />
        <span className="text-sm font-medium text-foreground">
          {item.author.displayName || item.author.username}
        </span>
        {item.author.country?.flagEmoji && (
          <span className="text-xs">{item.author.country.flagEmoji}</span>
        )}
        <span className="text-xs text-foreground-subtle" suppressHydrationWarning>
          {timeAgo(item.createdAt)}
        </span>
      </div>

      {/* Body */}
      <p className="text-sm text-foreground mb-2 whitespace-pre-wrap">{item.proposedText}</p>

      {/* Translated text */}
      {translatedText && (
        <div className="border-l-2 border-[#c9a84c]/50 pl-3 mb-2">
          <p className="text-sm text-foreground-muted italic">{translatedText}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Upvote */}
        <button
          onClick={() => onVote(item.id, "up")}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            item.userVote === "up"
              ? "text-emerald-400 bg-emerald-500/10"
              : "text-foreground-subtle hover:text-emerald-400"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          {item.upvoteCount}
        </button>

        {/* Downvote */}
        <button
          onClick={() => onVote(item.id, "down")}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
            item.userVote === "down"
              ? "text-red-400 bg-red-500/10"
              : "text-foreground-subtle hover:text-red-400"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {item.downvoteCount}
        </button>

        {net !== 0 && (
          <span className={`text-xs font-mono ${net > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {net > 0 ? "+" : ""}{net}
          </span>
        )}

        {/* Translate */}
        <button
          onClick={handleTranslate}
          disabled={isTranslating}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-foreground-subtle hover:text-[#c9a84c] transition-colors ml-auto"
        >
          {isTranslating ? (
            <span className="w-3 h-3 border border-foreground-subtle border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          )}
          {translatedText ? t("discussion.original") : t("discussion.translate")}
        </button>
      </div>
    </div>
  );
}
