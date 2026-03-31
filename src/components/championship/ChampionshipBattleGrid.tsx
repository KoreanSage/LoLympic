"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { useTranslation } from "@/i18n";

interface BattlePost {
  id: string;
  postId: string;
  userId: string;
  countryId: string;
  battleVoteCount: number;
  finalRank: number | null;
  post: {
    id: string;
    title: string;
    images: Array<{ originalUrl: string }>;
    reactionCount: number;
  };
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  country: {
    id: string;
    nameEn: string;
    flagEmoji: string;
  };
}

interface ChampionshipBattleGridProps {
  posts: BattlePost[];
  votedPostIds: Set<string>;
  canVote: boolean;
  onVote: (championshipPostId: string) => void;
  voting: string | null;
}

export default function ChampionshipBattleGrid({
  posts,
  votedPostIds,
  canVote,
  onVote,
  voting,
}: ChampionshipBattleGridProps) {
  const { t } = useTranslation();

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-subtle">{t("championship.noPosts")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post, idx) => {
        const hasVoted = votedPostIds.has(post.id);
        const isVoting = voting === post.id;
        const imageUrl = post.post.images[0]?.originalUrl;

        return (
          <div
            key={post.id}
            className={`relative rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
              idx === 0
                ? "border-[#c9a84c]/40 ring-1 ring-[#c9a84c]/20"
                : "border-border"
            } bg-background-surface`}
          >
            {/* Image */}
            <Link href={`/post/${post.postId}`}>
              {imageUrl ? (
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={post.post.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {/* Rank overlay */}
                  {post.finalRank && post.finalRank <= 3 && (
                    <div className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center text-lg bg-black/50 backdrop-blur-sm">
                      {post.finalRank === 1 ? "\u{1F947}" : post.finalRank === 2 ? "\u{1F948}" : "\u{1F949}"}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[4/3] bg-background-elevated flex items-center justify-center">
                  <span className="text-4xl text-foreground-subtle">🖼️</span>
                </div>
              )}
            </Link>

            {/* Info */}
            <div className="p-3">
              {/* Country flag + name */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{post.country.flagEmoji}</span>
                <span className="text-xs font-medium text-foreground-muted">{post.country.nameEn}</span>
              </div>

              {/* Title */}
              <Link href={`/post/${post.postId}`}>
                <h3 className="text-sm font-semibold text-foreground truncate hover:text-[#c9a84c] transition-colors">
                  {post.post.title}
                </h3>
              </Link>

              {/* Author */}
              <div className="flex items-center gap-2 mt-2">
                <Avatar
                  src={post.user.avatarUrl}
                  alt={post.user.displayName || post.user.username}
                  size="xs"
                />
                <Link
                  href={`/user/${post.user.username}`}
                  className="text-xs text-foreground-subtle hover:text-foreground transition-colors"
                >
                  {post.user.displayName || `@${post.user.username}`}
                </Link>
              </div>

              {/* Vote count + button */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🔥</span>
                  <span className="text-sm font-bold text-[#c9a84c]">{post.battleVoteCount}</span>
                  <span className="text-[11px] text-foreground-subtle">{t("championship.votes")}</span>
                </div>

                {canVote && (
                  <button
                    onClick={() => onVote(post.id)}
                    disabled={hasVoted || isVoting}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      hasVoted
                        ? "bg-[#c9a84c]/20 text-[#c9a84c] cursor-default"
                        : "bg-[#c9a84c] text-black hover:bg-[#b8963f] disabled:opacity-50"
                    }`}
                  >
                    {isVoting ? (
                      <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
                    ) : hasVoted ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {t("championship.voted")}
                      </span>
                    ) : (
                      t("championship.voteFor")
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
