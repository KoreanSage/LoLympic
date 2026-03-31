"use client";

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
  const maxVotes = Math.max(...posts.map((p) => p.battleVoteCount), 1);

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 bg-background-surface border border-border rounded-xl">
        <p className="text-foreground-subtle">{t("championship.noPosts")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {posts.map((post, idx) => {
        const hasVoted = votedPostIds.has(post.id);
        const isVoting = voting === post.id;
        const imageUrl = post.post.images[0]?.originalUrl;
        const votePct = maxVotes > 0 ? Math.round((post.battleVoteCount / maxVotes) * 100) : 0;

        return (
          <div
            key={post.id}
            className={`relative rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
              idx === 0
                ? "border-[#c9a84c]/40 ring-1 ring-[#c9a84c]/20"
                : "border-border"
            } bg-background-surface`}
          >
            {/* Country flag header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-background-elevated border-b border-border">
              <span className="text-lg">{post.country.flagEmoji}</span>
              <span className="text-xs font-semibold text-foreground">{post.country.nameEn}</span>
              {idx === 0 && (
                <span className="ml-auto text-[9px] font-bold text-[#c9a84c] bg-[#c9a84c]/10 px-1.5 py-0.5 rounded-full">
                  #1
                </span>
              )}
            </div>

            {/* Image */}
            <Link href={`/post/${post.postId}`} className="block">
              {imageUrl ? (
                <div className="relative aspect-[3/2] overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={post.post.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {/* Vote overlay for voted posts */}
                  {hasVoted && (
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#c9a84c] flex items-center justify-center">
                      <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  {/* Rank overlay */}
                  {post.finalRank && post.finalRank <= 3 && (
                    <div className="absolute top-2 left-2 w-8 h-8 rounded-full flex items-center justify-center text-lg bg-black/50 backdrop-blur-sm">
                      {post.finalRank === 1 ? "🥇" : post.finalRank === 2 ? "🥈" : "🥉"}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-[3/2] bg-background-elevated flex items-center justify-center">
                  <span className="text-4xl text-foreground-subtle">🖼️</span>
                </div>
              )}
            </Link>

            {/* Info */}
            <div className="p-3">
              {/* Title */}
              <Link href={`/post/${post.postId}`}>
                <h3 className="text-sm font-semibold text-foreground truncate hover:text-[#c9a84c] transition-colors">
                  {post.post.title}
                </h3>
              </Link>

              {/* Author */}
              <div className="flex items-center gap-2 mt-1.5">
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

              {/* Vote progress bar */}
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-background-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      idx === 0 ? "bg-[#c9a84c]" : "bg-foreground-subtle/40"
                    }`}
                    style={{ width: `${Math.max(votePct, 5)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#c9a84c] min-w-[40px] text-right">
                  {post.battleVoteCount}
                </span>
              </div>

              {/* Vote button */}
              {canVote && (
                <button
                  onClick={() => onVote(post.id)}
                  disabled={hasVoted || isVoting}
                  className={`mt-3 w-full py-2 rounded-lg text-xs font-medium transition-all ${
                    hasVoted
                      ? "bg-[#c9a84c]/15 text-[#c9a84c] cursor-default border border-[#c9a84c]/30"
                      : "bg-[#c9a84c] text-black hover:bg-[#b8963f] disabled:opacity-50"
                  }`}
                >
                  {isVoting ? (
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin inline-block" />
                  ) : hasVoted ? (
                    <span className="flex items-center justify-center gap-1">
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
        );
      })}
    </div>
  );
}
