"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Search, Send, Check } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@/i18n";

interface ForwardUser {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

interface Conversation {
  id: string;
  user: ForwardUser;
  lastMessage?: string;
}

interface ForwardModalProps {
  postId: string;
  onClose: () => void;
}

export default function ForwardModal({ postId, onClose }: ForwardModalProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ForwardUser[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<ForwardUser | null>(null);
  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Focus search input on mount
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  // Load recent conversations
  useEffect(() => {
    setLoadingConversations(true);
    fetch("/api/conversations")
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((data) => {
        setConversations(data.conversations || []);
      })
      .catch(() => {
        setConversations([]);
      })
      .finally(() => setLoadingConversations(false));
  }, []);

  // Search users with debounce
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/search?type=users&q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.users || []);
        }
      } catch {
        // ignore
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleForward = useCallback(async () => {
    if (!selectedUser || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/posts/${postId}/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          message: message.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSent(true);
        toast(t("post.forwardSent") || "Forwarded!", "success");
        setTimeout(() => onClose(), 1200);
      } else {
        const data = await res.json().catch(() => null);
        toast(data?.error || t("common.error") || "Failed to forward", "error");
      }
    } catch {
      toast(t("common.error") || "Failed to forward", "error");
    } finally {
      setIsSending(false);
    }
  }, [selectedUser, message, postId, isSending, toast, t, onClose]);

  const userList = query.trim() ? searchResults : conversations.map((c) => c.user);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-background-elevated border border-border rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">
            {t("post.forward") || "Forward"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-subtle hover:text-foreground-muted hover:bg-background-overlay transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success state */}
        {sent ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm text-foreground-muted">
              {t("post.forwardSent") || "Forwarded!"}
            </p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 bg-background-surface border border-border rounded-lg px-3 py-2">
                <Search className="w-4 h-4 text-foreground-subtle shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder-foreground-subtle outline-none"
                  placeholder={t("post.searchUsers") || "Search users..."}
                />
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-foreground-subtle border-t-[#c9a84c] rounded-full animate-spin shrink-0" />
                )}
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loadingConversations && !query.trim() ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-foreground-subtle border-t-[#c9a84c] rounded-full animate-spin" />
                </div>
              ) : userList.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-foreground-subtle">
                    {query.trim()
                      ? t("post.noUsersFound") || "No users found"
                      : t("post.noRecentConversations") || "No recent conversations"}
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {userList.map((user) => (
                    <button
                      key={user.id}
                      onClick={() =>
                        setSelectedUser(
                          selectedUser?.id === user.id ? null : user
                        )
                      }
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedUser?.id === user.id
                          ? "bg-[#c9a84c]/10"
                          : "hover:bg-background-overlay"
                      }`}
                    >
                      <Avatar
                        src={user.avatarUrl}
                        alt={user.username}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.displayName || user.username}
                        </p>
                        <p className="text-xs text-foreground-subtle truncate">
                          @{user.username}
                        </p>
                      </div>
                      {selectedUser?.id === user.id && (
                        <div className="w-5 h-5 rounded-full bg-[#c9a84c] flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-black" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Message input + send */}
            {selectedUser && (
              <div className="border-t border-border px-4 py-3 space-y-3 shrink-0">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleForward();
                    }
                  }}
                  className="w-full bg-background-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-border-active transition-colors"
                  placeholder={t("post.addMessage") || "Add a message (optional)"}
                />
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleForward}
                  loading={isSending}
                  className="w-full"
                >
                  <Send className="w-4 h-4" />
                  {t("post.sendForward") || "Send"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
