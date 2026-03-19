"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import MainLayout from "@/components/layout/MainLayout";
import Avatar from "@/components/ui/Avatar";
import { useTranslation } from "@/i18n";
import type { MessageData } from "@/types/messages";

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

export default function ChatPage() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id as string;

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [otherUser, setOtherUser] = useState<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  // Image attachment state
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    width: number | null;
    height: number | null;
  } | null>(null);
  const [imageUploading, setImageUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const userId = (session?.user as any)?.id;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages?limit=50`);
      if (res.ok) {
        const data = await res.json();
        const msgs = (data.messages || []).reverse(); // API returns desc, we want asc
        setMessages(msgs);
      }
    } catch {
      // ignore
    }
  }, [conversationId]);

  // Fetch conversation info (other user)
  useEffect(() => {
    if (status !== "authenticated") return;

    const fetchConvInfo = async () => {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          const conv = data.conversations?.find((c: any) => c.id === conversationId);
          if (conv) {
            setOtherUser(conv.otherUser);
          }
        }
      } catch {
        // ignore
      }
    };

    fetchConvInfo();
  }, [status, conversationId]);

  // Initial fetch and polling
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status !== "authenticated") return;

    const init = async () => {
      await fetchMessages();
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };
    init();

    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [status, router, fetchMessages, scrollToBottom]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB limit

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPendingImage({
        url: data.url,
        width: data.width ?? null,
        height: data.height ?? null,
      });
    } catch {
      // silent fail
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    const hasText = inputValue.trim().length > 0;
    const hasImage = !!pendingImage;
    if ((!hasText && !hasImage) || sending) return;

    const body = inputValue.trim();
    const image = pendingImage;
    setInputValue("");
    setPendingImage(null);
    setSending(true);

    // Optimistic update
    const optimisticMsg: MessageData = {
      id: `temp-${Date.now()}`,
      body,
      imageUrl: image?.url,
      imageWidth: image?.width,
      imageHeight: image?.height,
      createdAt: new Date().toISOString(),
      senderId: userId,
      sender: {
        id: userId,
        username: (session?.user as any)?.username || "",
        displayName: (session?.user as any)?.displayName || null,
        avatarUrl: (session?.user as any)?.avatarUrl || null,
      },
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const payload: Record<string, unknown> = {};
      if (hasText) payload.body = body;
      if (image) {
        payload.imageUrl = image.url;
        payload.imageWidth = image.width;
        payload.imageHeight = image.height;
      }

      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? data.message : m))
        );
      }
    } catch {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (status === "loading" || loading) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-2xl mx-auto py-6">
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-border border-t-[#c9a84c] animate-spin" />
          </div>
        </div>
      </MainLayout>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: MessageData[] }[] = [];
  messages.forEach((msg) => {
    const date = formatDate(msg.createdAt);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === date) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date, messages: [msg] });
    }
  });

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-2xl mx-auto py-6 flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-border mb-4">
          <Link
            href="/messages"
            className="p-1.5 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-background-elevated transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          {otherUser && (
            <Link href={`/user/${otherUser.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Avatar
                src={otherUser.avatarUrl}
                alt={otherUser.displayName || otherUser.username}
                size="sm"
              />
              <span className="text-sm font-semibold text-foreground">
                {otherUser.displayName || otherUser.username}
              </span>
            </Link>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 scrollbar-hide">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-foreground-subtle">
                Send a message to start the conversation
              </p>
            </div>
          ) : (
            groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="flex items-center justify-center my-4">
                  <span className="text-[10px] text-foreground-subtle bg-background-elevated px-2 py-0.5 rounded-full">
                    {group.date}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.messages.map((msg) => {
                    const isMine = msg.senderId === userId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl overflow-hidden ${
                            isMine
                              ? "bg-[#c9a84c] text-black rounded-br-md"
                              : "bg-background-elevated text-foreground rounded-bl-md"
                          }`}
                        >
                          {msg.imageUrl && (
                            <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={msg.imageUrl}
                                alt="Shared image"
                                width={msg.imageWidth ?? undefined}
                                height={msg.imageHeight ?? undefined}
                                className="max-w-full max-h-64 object-contain cursor-pointer"
                              />
                            </a>
                          )}
                          <div className="px-3 py-2">
                            {msg.body && (
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.body}
                              </p>
                            )}
                            <p
                              className={`text-[10px] mt-1 ${
                                isMine ? "text-black/50" : "text-foreground-subtle"
                              }`}
                            >
                              {formatTime(msg.createdAt)}
                            </p>
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
        <div className="border-t border-border pt-3">
          {/* Image preview */}
          {pendingImage && (
            <div className="mb-2 relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage.url}
                alt="Attachment preview"
                className="max-h-32 rounded-lg border border-border"
              />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
              >
                &times;
              </button>
            </div>
          )}
          {imageUploading && (
            <div className="mb-2 flex items-center gap-2 text-xs text-foreground-subtle">
              <div className="w-4 h-4 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
              Uploading image...
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading}
              className="p-2.5 rounded-xl text-foreground-subtle hover:text-foreground hover:bg-background-elevated disabled:opacity-40 transition-colors flex-shrink-0"
              title="Attach image"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("messages.typePlaceholder")}
              rows={1}
              className="flex-1 bg-background-elevated border border-border-hover rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-foreground-subtle focus:outline-none focus:border-[#c9a84c]/50 transition-colors resize-none max-h-32"
              style={{ minHeight: "40px" }}
            />
            <button
              onClick={handleSend}
              disabled={(!inputValue.trim() && !pendingImage) || sending}
              className="p-2.5 rounded-xl bg-[#c9a84c] text-black hover:bg-[#d4b85c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
