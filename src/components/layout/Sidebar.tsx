"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useTranslation } from "@/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const SIDEBAR_RANK_CACHE_KEY = "lolympic_sidebar_country_ranks";

interface CountryRanking {
  rank: number;
  id: string;
  flag: string;
  name: string;
  score: number;
  totalPosts: number;
  medal?: "GOLD" | "SILVER" | "BRONZE";
  rankChange?: "up" | "down" | "same";
}

interface TopCreator {
  rank: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  flag: string;
  score: number;
  totalPosts: number;
}

interface HotMeme {
  id: string;
  title: string;
  thumbnailUrl?: string;
  authorUsername: string;
  reactionCount: number;
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return (
    <div
      className={`h-4 ${width} rounded bg-background-overlay animate-pulse`}
    />
  );
}

function RankingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <SkeletonLine width="w-4" />
          <SkeletonLine width="w-5" />
          <SkeletonLine width="w-full" />
          <SkeletonLine width="w-12" />
        </div>
      ))}
    </div>
  );
}

function MemesSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-10 h-10 rounded bg-background-overlay animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <SkeletonLine width="w-3/4" />
            <SkeletonLine width="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Medal & rank helpers
// ---------------------------------------------------------------------------

const MEDAL_EMOJI: Record<string, string> = {
  GOLD: "\u{1F947}",
  SILVER: "\u{1F948}",
  BRONZE: "\u{1F949}",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const medal = ["GOLD", "SILVER", "BRONZE"][rank - 1];
    return <span className="text-base w-5 text-center">{MEDAL_EMOJI[medal]}</span>;
  }
  return (
    <span className="text-xs text-foreground-subtle w-5 text-center font-mono">
      {rank}
    </span>
  );
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.max(5, (score / maxScore) * 100) : 0;
  return (
    <div className="w-full h-1 rounded-full bg-background-overlay mt-1">
      <div
        className="h-1 rounded-full bg-gradient-to-r from-[#c9a84c] to-[#e8c84a]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const { t } = useTranslation();
  const [rankings, setRankings] = useState<CountryRanking[]>([]);
  const [creators, setCreators] = useState<TopCreator[]>([]);
  const [hotMemes, setHotMemes] = useState<HotMeme[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingMemes, setLoadingMemes] = useState(true);
  const [loadingTags, setLoadingTags] = useState(true);
  const [errorRankings, setErrorRankings] = useState(false);
  const [errorCreators, setErrorCreators] = useState(false);
  const [errorMemes, setErrorMemes] = useState(false);

  useEffect(() => {
    // Fetch country rankings with rank change detection
    fetch("/api/leaderboard?type=country&limit=5")
      .then((res) => res.json())
      .then((data) => {
        const entries = (data.entries ?? []) as Array<{
          rank: number;
          country: { id: string; nameEn: string; flagEmoji: string };
          medal: "GOLD" | "SILVER" | "BRONZE" | null;
          score: number;
          totalPosts: number;
        }>;

        // Load previous rankings from localStorage for rank change indicators
        let prevRanks: Record<string, number> = {};
        try {
          const cached = localStorage.getItem(SIDEBAR_RANK_CACHE_KEY);
          if (cached) prevRanks = JSON.parse(cached);
        } catch {}

        const mapped = entries.map((e) => {
          const prevRank = prevRanks[e.country.nameEn];
          let rankChange: "up" | "down" | "same" = "same";
          if (prevRank !== undefined && prevRank !== e.rank) {
            rankChange = e.rank < prevRank ? "up" : "down";
          }
          return {
            rank: e.rank,
            id: e.country.id,
            flag: e.country.flagEmoji,
            name: e.country.nameEn,
            score: e.score,
            totalPosts: e.totalPosts ?? 0,
            medal: e.medal ?? undefined,
            rankChange,
          };
        });

        setRankings(mapped);

        // Save current ranks to localStorage
        const newRanks: Record<string, number> = {};
        entries.forEach((e) => {
          newRanks[e.country.nameEn] = e.rank;
        });
        try {
          localStorage.setItem(SIDEBAR_RANK_CACHE_KEY, JSON.stringify(newRanks));
        } catch {}
      })
      .catch((err) => {
        console.error("Failed to fetch country rankings:", err);
        setErrorRankings(true);
      })
      .finally(() => setLoadingRankings(false));

    // Fetch top creators
    fetch("/api/leaderboard?type=creator&limit=5")
      .then((res) => res.json())
      .then((data) => {
        const entries = (data.entries ?? []) as Array<{
          rank: number;
          user: { username: string; displayName: string | null; avatarUrl: string | null };
          country: { flagEmoji: string } | null;
          score: number;
          totalPosts: number;
        }>;
        setCreators(
          entries.map((e) => ({
            rank: e.rank,
            username: e.user.username,
            displayName: e.user.displayName,
            avatarUrl: e.user.avatarUrl,
            flag: e.country?.flagEmoji ?? "",
            score: e.score,
            totalPosts: e.totalPosts ?? 0,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to fetch top creators:", err);
        setErrorCreators(true);
      })
      .finally(() => setLoadingCreators(false));

    // Fetch hot memes
    fetch("/api/leaderboard?type=meme&limit=3")
      .then((res) => res.json())
      .then((data) => {
        const entries = (data.entries ?? []) as Array<{
          post: {
            id: string;
            title: string;
            author: { username: string };
            images: Array<{ originalUrl: string }>;
            reactionCount: number;
          };
        }>;
        setHotMemes(
          entries.map((e) => ({
            id: e.post.id,
            title: e.post.title,
            thumbnailUrl: e.post.images?.[0]?.originalUrl,
            authorUsername: e.post.author.username,
            reactionCount: e.post.reactionCount ?? 0,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to fetch hot memes:", err);
        setErrorMemes(true);
      })
      .finally(() => setLoadingMemes(false));

    // Fetch trending posts and extract unique tags
    fetch("/api/posts?limit=20&sort=trending")
      .then((res) => res.json())
      .then((data) => {
        const posts = (data.posts ?? []) as Array<{ tags?: string[] }>;
        const allTags: string[] = [];
        for (const post of posts) {
          if (Array.isArray(post.tags)) {
            for (const tag of post.tags) {
              if (tag && !allTags.includes(tag)) {
                allTags.push(tag);
              }
            }
          }
        }
        setTrendingTags(allTags.slice(0, 8));
      })
      .catch((err) => console.error("Failed to fetch trending tags:", err))
      .finally(() => setLoadingTags(false));
  }, []);

  const maxCountryScore = rankings[0]?.score ?? 0;
  const maxCreatorScore = creators[0]?.score ?? 0;

  return (
    <aside className="sticky top-[7.5rem] space-y-4">
      {/* Country Rankings */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <span>🏆</span> {t("sidebar.countryRankings")}
          </h3>
          <Link
            href="/leaderboard"
            className="text-[10px] text-[#c9a84c] hover:text-[#d4b85c] transition-colors"
          >
            {t("sidebar.viewAll")}
          </Link>
        </div>
        {loadingRankings ? (
          <RankingSkeleton rows={5} />
        ) : errorRankings ? (
          <p className="text-xs text-red-400/80 text-center py-4">Failed to load rankings</p>
        ) : rankings.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-foreground-subtle">{t("sidebar.emptyCountry")}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {rankings.map((c) => (
              <Link
                key={c.id}
                href={`/?country=${c.id}`}
                className={`group block rounded-lg px-1 -mx-1 hover:bg-background-elevated transition-colors cursor-pointer ${
                  c.rank === 1
                    ? "bg-[#c9a84c]/10 border border-[#c9a84c]/20 hover:bg-[#c9a84c]/15"
                    : ""
                }`}
              >
                <div className="flex items-center gap-1.5 py-0.5">
                  <RankBadge rank={c.rank} />
                  <span className="text-sm">{c.flag}</span>
                  <span className="text-xs text-foreground-muted flex-1 truncate">
                    {c.rank === 1 && "👑 "}{c.name}
                  </span>
                  {/* Rank change indicator */}
                  {c.rankChange === "up" && (
                    <span className="text-[10px] text-emerald-400 font-bold">▲</span>
                  )}
                  {c.rankChange === "down" && (
                    <span className="text-[10px] text-red-400 font-bold">▼</span>
                  )}
                  <span className="text-[10px] text-foreground-subtle">
                    {c.totalPosts}p
                  </span>
                  <span className="text-xs font-semibold text-[#c9a84c] font-mono min-w-[32px] text-right">
                    {c.score.toLocaleString()}
                  </span>
                </div>
                <div className="ml-[26px]">
                  <ScoreBar score={c.score} maxScore={maxCountryScore} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Hot Memes */}
      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <span>🔥</span> {t("sidebar.hotMemes")}
        </h3>
        {loadingMemes ? (
          <MemesSkeleton />
        ) : errorMemes ? (
          <p className="text-xs text-red-400/80 text-center py-4">Failed to load memes</p>
        ) : hotMemes.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-foreground-subtle">{t("sidebar.emptyMemes")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hotMemes.map((meme, i) => (
              <Link
                key={meme.id}
                href={`/post/${meme.id}`}
                className="flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-lg hover:bg-background-elevated transition-colors group"
              >
                {meme.thumbnailUrl ? (
                  <img
                    src={meme.thumbnailUrl}
                    alt={meme.title}
                    className="w-10 h-10 rounded-lg object-cover bg-background-elevated flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-background-elevated flex-shrink-0 flex items-center justify-center text-foreground-subtle text-lg">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-[#c9a84c] transition-colors">
                    {meme.title}
                  </p>
                  <p className="text-[10px] text-foreground-subtle">
                    @{meme.authorUsername} · ❤️ {meme.reactionCount}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Top Creators */}
      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <span>⭐</span> {t("sidebar.topCreators")}
        </h3>
        {loadingCreators ? (
          <RankingSkeleton rows={5} />
        ) : errorCreators ? (
          <p className="text-xs text-red-400/80 text-center py-4">Failed to load creators</p>
        ) : creators.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-foreground-subtle">{t("sidebar.emptyCreators")}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {creators.map((creator) => (
              <Link
                key={creator.username}
                href={`/user/${creator.username}`}
                className="flex items-center gap-1.5 p-1 -mx-1 rounded-lg hover:bg-background-elevated transition-colors group"
              >
                <RankBadge rank={creator.rank} />
                {creator.avatarUrl ? (
                  <img
                    src={creator.avatarUrl}
                    alt={creator.username}
                    className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-background-elevated flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] text-foreground-subtle">
                      {(creator.displayName || creator.username)[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-foreground-muted truncate block group-hover:text-foreground transition-colors">
                    {creator.displayName || `@${creator.username}`}
                  </span>
                </div>
                <span className="text-[10px] text-foreground-subtle">
                  {creator.totalPosts}p
                </span>
                <span className="text-xs font-semibold text-[#c9a84c] font-mono min-w-[32px] text-right">
                  {creator.score.toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-border">
          <ScoreBar score={maxCreatorScore > 0 ? maxCreatorScore * 0.7 : 0} maxScore={maxCreatorScore} />
          <p className="text-[10px] text-foreground-subtle text-center mt-1.5">
            {t("sidebar.climbRanks")}
          </p>
        </div>
      </Card>

      {/* Trending Tags */}
      {!loadingTags && trendingTags.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <span>📈</span> {t("sidebar.trending")}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {trendingTags.map((tag) => (
              <Badge key={tag} variant="default">
                #{tag}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </aside>
  );
}
