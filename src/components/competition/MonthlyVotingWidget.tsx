"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/i18n";

interface MonthlyVotingData {
  currentMonth: number;
  currentYear: number;
  topPosts: Array<{
    id: string;
    title: string;
    reactionCount: number;
    imageUrl: string | null;
    author: { username: string; displayName: string | null };
    country: { flagEmoji: string } | null;
  }>;
  totalVotes: number;
  daysRemaining: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthlyVotingWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState<MonthlyVotingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMonthlyVoting();
  }, []);

  async function fetchMonthlyVoting() {
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed");
      const dashData = await res.json();

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Calculate days remaining in the month
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const daysRemaining = lastDay - now.getDate();

      // Get top 3 posts this month from the rankings data
      const topMeme = dashData.stats?.topMeme;

      // Also fetch top memes for the current month
      const memeRes = await fetch("/api/leaderboard?type=meme&limit=3");
      const memeData = await memeRes.json();
      const topPosts = (memeData.entries || []).slice(0, 3).map((e: any) => ({
        id: e.post.id,
        title: e.post.title,
        reactionCount: e.post.reactionCount || e.score || 0,
        imageUrl: e.post.images?.[0]?.originalUrl || null,
        author: e.post.author,
        country: null,
      }));

      setData({
        currentMonth,
        currentYear,
        topPosts,
        totalVotes: dashData.stats?.totalReactions || 0,
        daysRemaining,
      });
    } catch (e) {
      console.error("Failed to fetch monthly voting data:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-background-surface border border-border rounded-xl p-4 animate-pulse">
        <div className="h-4 w-32 bg-background-elevated rounded mb-3" />
        <div className="h-16 bg-background-elevated rounded" />
      </div>
    );
  }

  if (!data || data.topPosts.length === 0) return null;

  const monthName = MONTH_NAMES[data.currentMonth - 1];
  const maxScore = data.topPosts[0]?.reactionCount || 1;

  return (
    <div className="bg-background-surface border border-border rounded-xl p-4 overflow-hidden relative">
      {/* Gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#c9a84c]/60 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#c9a84c] w-5 h-5 rounded bg-[#c9a84c]/10 flex items-center justify-center">#</span>
          <h3 className="text-sm font-bold text-foreground">
            {t("monthly.votingStatus")}
          </h3>
          <span className="text-xs text-[#c9a84c] font-medium bg-[#c9a84c]/10 px-2 py-0.5 rounded-full">
            {monthName}
          </span>
        </div>
        {data.daysRemaining > 0 && (
          <span className="text-[10px] text-foreground-subtle flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {t("monthly.daysLeft", { days: data.daysRemaining })}
          </span>
        )}
      </div>

      {/* Top contenders */}
      <div className="space-y-2">
        {data.topPosts.map((post, i) => {
          const pct = Math.max(8, (post.reactionCount / maxScore) * 100);
          const medals = ["1st", "2nd", "3rd"];
          return (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="flex items-center gap-2.5 group"
            >
              <span className="text-[10px] font-bold w-5 text-center flex-shrink-0 text-foreground-muted">{medals[i]}</span>
              {post.imageUrl && (
                <div className="w-8 h-8 rounded-md overflow-hidden flex-shrink-0 border border-border">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs text-foreground truncate group-hover:text-[#c9a84c] transition-colors font-medium">
                    {post.title}
                  </span>
                </div>
                <div className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: i === 0 ? "#c9a84c" : i === 1 ? "#c0c0c0" : "#CD7F32",
                    }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-foreground-subtle tabular-nums flex-shrink-0 font-medium">
                {post.reactionCount.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Footer link */}
      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between">
        <span className="text-[10px] text-foreground-subtle">
          {t("monthly.totalVotesThisMonth", { count: data.totalVotes.toLocaleString() })}
        </span>
        <Link
          href="/leaderboard"
          className="text-[10px] text-[#c9a84c] hover:text-[#d4b65e] font-medium transition-colors"
        >
          {t("monthly.viewFullRankings")} →
        </Link>
      </div>
    </div>
  );
}
