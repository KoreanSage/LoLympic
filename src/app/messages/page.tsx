"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();

    // Poll every 10s
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [status, router]);

  if (status === "loading" || loading) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-2xl mx-auto py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">Messages</h1>
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-border border-t-[#c9a84c] animate-spin" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-2xl mx-auto py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Messages</h1>

        {conversations.length === 0 ? (
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
            <p className="text-foreground-muted text-sm">No conversations yet</p>
            <p className="text-foreground-subtle text-xs mt-1">
              Visit a user&apos;s profile and click &quot;Message&quot; to start a conversation
            </p>
          </div>
        ) : (
          <div className="bg-background-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
            {conversations.map((conv) => (
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
                    <span className="text-sm font-medium text-foreground truncate">
                      {conv.otherUser.displayName || conv.otherUser.username}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-xs text-foreground-subtle flex-shrink-0 ml-2">
                        {formatTimeAgo(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-foreground-muted truncate">
                      {conv.lastMessage
                        ? conv.lastMessage.body
                        : "No messages yet"}
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
