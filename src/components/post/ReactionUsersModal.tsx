"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

const REACTION_EMOJIS: Record<string, string> = {
  FIRE: "\uD83D\uDD25",
  LAUGH: "\uD83D\uDE02",
  SKULL: "\uD83D\uDC80",
  HEART: "\u2764\uFE0F",
  CRY: "\uD83D\uDE22",
};

const REACTION_TABS = ["ALL", "FIRE", "LAUGH", "SKULL", "HEART", "CRY"] as const;

interface ReactionUser {
  type: string;
  createdAt: string;
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    countryFlag: string | null;
  };
}

interface Props {
  postId: string;
  onClose: () => void;
}

export default function ReactionUsersModal({ postId, onClose }: Props) {
  const [users, setUsers] = useState<ReactionUser[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const typeParam = activeTab !== "ALL" ? `&type=${activeTab}` : "";
    fetch(`/api/posts/${postId}/reactions?users=true${typeParam}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setUsers(data.users || []);
          setCounts(data.counts || {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId, activeTab]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm mx-4 max-h-[70vh] bg-background-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">Reactions</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-background-elevated text-foreground-subtle hover:text-foreground transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto scrollbar-hide">
          {REACTION_TABS.map((tab) => {
            const count = tab === "ALL"
              ? Object.values(counts).reduce((a, b) => a + b, 0)
              : (counts[tab] || 0);
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? "bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30"
                    : "text-foreground-subtle hover:bg-background-elevated border border-transparent"
                }`}
              >
                <span>{tab === "ALL" ? "All" : REACTION_EMOJIS[tab]}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-sm text-foreground-subtle py-8">No reactions yet</p>
          ) : (
            <div className="space-y-0.5">
              {users.map((r, i) => (
                <Link
                  key={`${r.user.username}-${r.type}-${i}`}
                  href={`/user/${r.user.username}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background-elevated transition-colors"
                >
                  <Avatar
                    src={r.user.avatarUrl}
                    alt={r.user.displayName || r.user.username}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {r.user.countryFlag && <span className="mr-1">{r.user.countryFlag}</span>}
                      {r.user.displayName || r.user.username}
                    </p>
                    <p className="text-[10px] text-foreground-subtle">@{r.user.username}</p>
                  </div>
                  <span className="text-base flex-shrink-0">{REACTION_EMOJIS[r.type] || "\uD83D\uDD25"}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
