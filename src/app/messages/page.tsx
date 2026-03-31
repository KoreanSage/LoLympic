"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import Avatar from "@/components/ui/Avatar";
import type { ConversationListItem } from "@/types/messages";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

type FilterType = "all" | "unread";

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    const fetchConversations = async () => {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    // Poll every 10s, but only when tab is visible
    const fetchIfVisible = () => {
      if (document.visibilityState === "visible") fetchConversations();
    };
    const interval = setInterval(fetchIfVisible, 10000);
    return () => clearInterval(interval);
  }, [status, router]);

  // Filtered + searched conversations
  const filteredConversations = useMemo(() => {
    let result = conversations;

    // Filter by unread
    if (filter === "unread") {
      result = result.filter((c) => c.unreadCount > 0);
    }

    // Search by username / displayName / last message
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) => {
        const name = (c.otherUser.displayName || c.otherUser.username || "").toLowerCase();
        const msg = (c.lastMessage?.body || "").toLowerCase();
        return name.includes(q) || msg.includes(q);
      });
    }

    return result;
  }, [conversations, filter, searchQuery]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  if (error) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-2xl mx-auto py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">{t("messages.title")}</h1>
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-foreground-muted text-sm">{t("common.error") || "Something went wrong."}</p>
            <button
              onClick={() => { setError(false); setLoading(true); window.location.reload(); }}
              className="px-4 py-2 rounded-xl bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#b8963f] transition-colors"
            >
              {t("common.retry") || "Retry"}
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (status === "loading" || loading) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-2xl mx-auto py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">{t("messages.title")}</h1>
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-border border-t-[#c9a84c] animate-spin" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-2xl mx-auto py-6 space-y-4">
        {/* Header */}
        <h1 className="text-2xl font-bold text-foreground">{t("messages.title")}</h1>

        {/* Search bar */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("messages.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-2.5 bg-background-surface border border-border rounded-xl text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-background-surface rounded-lg p-0.5 border border-border w-fit">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              filter === "all"
                ? "bg-background-overlay text-foreground"
                : "text-foreground-subtle hover:text-foreground-muted"
            }`}
          >
            {t("messages.filterAll")}
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
              filter === "unread"
                ? "bg-background-overlay text-foreground"
                : "text-foreground-subtle hover:text-foreground-muted"
            }`}
          >
            {t("messages.filterUnread")}
            {unreadTotal > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#c9a84c] text-black text-[9px] font-bold flex items-center justify-center">
                {unreadTotal > 9 ? "9+" : unreadTotal}
              </span>
            )}
          </button>
        </div>

        {/* Conversation list */}
        {filteredConversations.length === 0 ? (
          <div className="bg-background-surface border border-border rounded-xl p-12 text-center">
            <svg
              className="w-12 h-12 mx-auto text-foreground-subtle mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
            <p className="text-foreground-muted text-sm">
              {searchQuery || filter === "unread"
                ? t("messages.noResults")
                : t("messages.empty")}
            </p>
            {!searchQuery && filter === "all" && (
              <p className="text-foreground-subtle text-xs mt-1">
                {t("messages.startHint")}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-background-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => router.push(`/messages/${conv.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-elevated transition-colors text-left"
              >
                <Avatar
                  src={conv.otherUser.avatarUrl}
                  alt={conv.otherUser.displayName || conv.otherUser.username}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium truncate ${conv.unreadCount > 0 ? "text-foreground" : "text-foreground-muted"}`}>
                      {conv.otherUser.displayName || conv.otherUser.username}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-xs text-foreground-subtle flex-shrink-0 ml-2">
                        {formatTimeAgo(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate ${conv.unreadCount > 0 ? "text-foreground-muted font-medium" : "text-foreground-subtle"}`}>
                      {conv.lastMessage
                        ? conv.lastMessage.body
                        : t("messages.empty")}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full bg-[#c9a84c] text-black text-[10px] font-bold flex items-center justify-center">
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
