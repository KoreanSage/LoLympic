"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import Avatar from "@/components/ui/Avatar";
import type { ConversationListItem, MessageData } from "@/types/messages";

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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
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

  // Split-pane state (desktop)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<MessageData[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ url: string; width: number | null; height: number | null } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;

    const fetchConversations = async () => {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch { setError(true); } finally { setLoading(false); }
    };

    fetchConversations();
    const fetchIfVisible = () => { if (document.visibilityState === "visible") fetchConversations(); };
    const interval = setInterval(fetchIfVisible, 10000);
    return () => clearInterval(interval);
  }, [status, router]);

  // Fetch messages for selected conversation (desktop)
  const fetchChatMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages((data.messages || []).reverse());
      }
    } catch { /* ignore */ }
  }, []);

  // When conversation selected, fetch messages
  useEffect(() => {
    if (!selectedConvId) return;
    setChatLoading(true);
    fetchChatMessages(selectedConvId).then(() => {
      setChatLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    const interval = setInterval(() => fetchChatMessages(selectedConvId), 5000);
    return () => clearInterval(interval);
  }, [selectedConvId, fetchChatMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  const handleSelectConversation = (convId: string) => {
    // On mobile, navigate to separate page. On desktop, show inline.
    if (window.innerWidth < 1024) {
      router.push(`/messages/${convId}`);
    } else {
      setSelectedConvId(convId);
      setInputValue("");
      setPendingImage(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPendingImage({ url: data.url, width: data.width ?? null, height: data.height ?? null });
    } catch { /* silent */ } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!selectedConvId) return;
    const hasText = inputValue.trim().length > 0;
    const hasImage = !!pendingImage;
    if ((!hasText && !hasImage) || sending) return;

    const body = inputValue.trim();
    const image = pendingImage;
    setInputValue("");
    setPendingImage(null);
    setSending(true);

    const optimisticMsg: MessageData = {
      id: `temp-${Date.now()}`, body,
      imageUrl: image?.url, imageWidth: image?.width, imageHeight: image?.height,
      createdAt: new Date().toISOString(), senderId: userId || "",
      sender: { id: userId || "", username: session?.user?.username || "", displayName: session?.user?.displayName || null, avatarUrl: session?.user?.avatarUrl || null },
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const payload: Record<string, unknown> = {};
      if (hasText) payload.body = body;
      if (image) { payload.imageUrl = image.url; payload.imageWidth = image.width; payload.imageHeight = image.height; }
      const res = await fetch(`/api/conversations/${selectedConvId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => prev.map((m) => (m.id === optimisticMsg.id ? data.message : m)));
      }
    } catch {
      setChatMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (filter === "unread") result = result.filter((c) => c.unreadCount > 0);
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

  const unreadTotal = useMemo(() => conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations]);

  if (error) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-2xl mx-auto py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">{t("messages.title")}</h1>
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-foreground-muted text-sm">{t("common.error") || "Something went wrong."}</p>
            <button onClick={() => { setError(false); setLoading(true); window.location.reload(); }}
              className="px-4 py-2 rounded-xl bg-[#c9a84c] text-black text-sm font-medium hover:bg-[#b8963f] transition-colors">
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

  // Group messages by date
  const groupedMessages: { date: string; messages: MessageData[] }[] = [];
  chatMessages.forEach((msg) => {
    const date = formatDate(msg.createdAt);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === date) { lastGroup.messages.push(msg); }
    else { groupedMessages.push({ date, messages: [msg] }); }
  });

  return (
    <MainLayout showSidebar={false}>
      {/* Desktop: split pane, Mobile: list only */}
      <div className="lg:grid lg:grid-cols-[360px_1fr] lg:gap-0 lg:border lg:border-border lg:rounded-xl lg:overflow-hidden" style={{ height: "calc(100vh - 7rem)" }}>

        {/* ── Left Panel: Conversation List ── */}
        <div className={`${selectedConvId ? "hidden lg:flex" : "flex"} flex-col lg:border-r lg:border-border h-full`}>
          <div className="p-4 space-y-3">
            <h1 className="text-xl font-bold text-foreground">{t("messages.title")}</h1>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("messages.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2 bg-background-surface border border-border rounded-lg text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors" />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 bg-background-surface rounded-lg p-0.5 border border-border w-fit">
              <button onClick={() => setFilter("all")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filter === "all" ? "bg-background-overlay text-foreground" : "text-foreground-subtle hover:text-foreground-muted"}`}>
                {t("messages.filterAll")}
              </button>
              <button onClick={() => setFilter("unread")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${filter === "unread" ? "bg-background-overlay text-foreground" : "text-foreground-subtle hover:text-foreground-muted"}`}>
                {t("messages.filterUnread")}
                {unreadTotal > 0 && <span className="w-4 h-4 rounded-full bg-[#c9a84c] text-black text-[9px] font-bold flex items-center justify-center">{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
              </button>
            </div>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-foreground-muted text-sm">{searchQuery || filter === "unread" ? t("messages.noResults") : t("messages.empty")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredConversations.map((conv) => (
                  <button key={conv.id} onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-background-elevated transition-colors text-left ${selectedConvId === conv.id ? "bg-background-elevated" : ""}`}>
                    <Avatar src={conv.otherUser.avatarUrl} alt={conv.otherUser.displayName || conv.otherUser.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium truncate ${conv.unreadCount > 0 ? "text-foreground" : "text-foreground-muted"}`}>
                          {conv.otherUser.displayName || conv.otherUser.username}
                        </span>
                        {conv.lastMessage && <span className="text-xs text-foreground-subtle flex-shrink-0 ml-2">{formatTimeAgo(conv.lastMessage.createdAt)}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-xs truncate ${conv.unreadCount > 0 ? "text-foreground-muted font-medium" : "text-foreground-subtle"}`}>
                          {conv.lastMessage ? conv.lastMessage.body : t("messages.empty")}
                        </p>
                        {conv.unreadCount > 0 && <span className="flex-shrink-0 ml-2 w-5 h-5 rounded-full bg-[#c9a84c] text-black text-[10px] font-bold flex items-center justify-center">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Chat (desktop only) ── */}
        <div className="hidden lg:flex flex-col h-full bg-background">
          {!selectedConvId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto text-foreground-subtle/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-sm text-foreground-subtle">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                {selectedConv?.otherUser && (
                  <Link href={`/user/${selectedConv.otherUser.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <Avatar src={selectedConv.otherUser.avatarUrl} alt={selectedConv.otherUser.displayName || selectedConv.otherUser.username} size="sm" />
                    <span className="text-sm font-semibold text-foreground">{selectedConv.otherUser.displayName || selectedConv.otherUser.username}</span>
                  </Link>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
                {chatLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 rounded-full border-2 border-border border-t-[#c9a84c] animate-spin" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-foreground-subtle">Send a message to start the conversation</p>
                  </div>
                ) : (
                  groupedMessages.map((group) => (
                    <div key={group.date}>
                      <div className="flex items-center justify-center my-3">
                        <span className="text-[10px] text-foreground-subtle bg-background-elevated px-2 py-0.5 rounded-full">{group.date}</span>
                      </div>
                      <div className="space-y-1">
                        {group.messages.map((msg) => {
                          const isMine = msg.senderId === userId;
                          return (
                            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMine ? "bg-[#c9a84c] text-black rounded-br-md" : "bg-background-elevated text-foreground rounded-bl-md"}`}>
                                {msg.imageUrl && (
                                  <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                                    <img src={msg.imageUrl} alt="Shared image" className="max-w-full max-h-64 object-contain cursor-pointer" />
                                  </a>
                                )}
                                <div className="px-3 py-2">
                                  {msg.body && <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>}
                                  <p className={`text-[10px] mt-1 ${isMine ? "text-black/50" : "text-foreground-subtle"}`}>{formatTime(msg.createdAt)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border px-4 py-3">
                {pendingImage && (
                  <div className="mb-2 relative inline-block">
                    <img src={pendingImage.url} alt="Attachment preview" className="max-h-24 rounded-lg border border-border" />
                    <button onClick={() => setPendingImage(null)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">&times;</button>
                  </div>
                )}
                {imageUploading && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-foreground-subtle">
                    <div className="w-4 h-4 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} disabled={imageUploading}
                    className="p-2 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-background-elevated disabled:opacity-40 transition-colors flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                  </button>
                  <textarea ref={inputRef} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={t("messages.typePlaceholder")} rows={1}
                    className="flex-1 bg-background-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors resize-none max-h-32"
                    style={{ minHeight: "38px" }} />
                  <button onClick={handleSend} disabled={(!inputValue.trim() && !pendingImage) || sending}
                    className="p-2 rounded-lg bg-[#c9a84c] text-black hover:bg-[#d4b85c] disabled:opacity-40 transition-colors flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
