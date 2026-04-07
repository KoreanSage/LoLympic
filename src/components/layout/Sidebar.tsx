"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import TierBadge from "@/components/ui/TierBadge";
import VsEventBanner from "@/components/competition/VsEventBanner";
import ChampionshipBanner from "@/components/championship/ChampionshipBanner";
import { useTranslation } from "@/i18n";
import { fetchCurrentUser } from "@/lib/user-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const SIDEBAR_RANK_CACHE_KEY = "mimzy_sidebar_country_ranks";

interface CountryRanking {
  rank: number;
  id: string;
  flag: string;
  name: string;
  score: number;
  totalScore: number;
  perUserScore: number;
  activeUsers: number;
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
  tier?: string;
}

interface HotMeme {
  id: string;
  title: string;
  translatedTitle?: string | null;
  thumbnailUrl?: string;
  authorUsername: string;
  reactionCount: number;
}

interface MonthlyContender {
  id: string;
  title: string;
  translatedTitle?: string | null;
  imageUrl: string | null;
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

const MEDAL_COLORS: Record<string, string> = {
  GOLD: "text-[#c9a84c]",
  SILVER: "text-[#c0c0c0]",
  BRONZE: "text-[#CD7F32]",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const medal = ["GOLD", "SILVER", "BRONZE"][rank - 1];
    return (
      <span className={`text-xs w-5 text-center font-bold ${MEDAL_COLORS[medal]}`}>
        {rank}
      </span>
    );
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
  const { data: session } = useSession();
  const [rankings, setRankings] = useState<CountryRanking[]>([]);
  const [creators, setCreators] = useState<TopCreator[]>([]);
  const [hotMemes, setHotMemes] = useState<HotMeme[]>([]);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [monthlyContenders, setMonthlyContenders] = useState<MonthlyContender[]>([]);
  const [monthlyDaysLeft, setMonthlyDaysLeft] = useState(0);
  const [loadingRankings, setLoadingRankings] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [loadingMemes, setLoadingMemes] = useState(true);
  const [loadingTags, setLoadingTags] = useState(true);
  const [errorRankings, setErrorRankings] = useState(false);
  const [errorCreators, setErrorCreators] = useState(false);
  const [errorMemes, setErrorMemes] = useState(false);

  // Get user's preferred language for translated titles (state so re-fetch works)
  const [preferredLang, setPreferredLang] = useState<string>("");
  const [myCountry, setMyCountry] = useState<{ flag: string; name: string; rank: number; score: number } | null>(null);
  const [myCountryInTop5, setMyCountryInTop5] = useState(false);
  const [uploadStreak, setUploadStreak] = useState<number>(0);
  const [championshipPhase, setChampionshipPhase] = useState<string | null>(null);
  const [championshipYear, setChampionshipYear] = useState<number>(new Date().getFullYear());

  // Initialize preferredLang from localStorage, then fall back to session
  useEffect(() => {
    const stored = localStorage.getItem("mimzy_preferredLanguage");
    if (stored) {
      setPreferredLang(stored);
    } else if (session?.user?.preferredLanguage) {
      setPreferredLang(session.user.preferredLanguage);
    }
  }, [session?.user?.preferredLanguage]);

  useEffect(() => {
    // Fetch country rankings with rank change detection
    fetch("/api/leaderboard?type=country&limit=10")
      .then((res) => res.json())
      .then((data) => {
        const entries = (data.entries ?? []) as Array<{
          rank: number;
          country: { id: string; nameEn: string; flagEmoji: string };
          medal: "GOLD" | "SILVER" | "BRONZE" | null;
          score: number;
          totalScore?: number;
          perUserScore?: number;
          activeUsers?: number;
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
            totalScore: e.totalScore ?? e.score,
            perUserScore: e.perUserScore ?? e.score,
            activeUsers: e.activeUsers ?? 0,
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
          user: { username: string; displayName: string | null; avatarUrl: string | null; tier?: string };
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
            tier: e.user.tier,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to fetch top creators:", err);
        setErrorCreators(true);
      })
      .finally(() => setLoadingCreators(false));

    // Fetch hot memes (with translated titles if user has a preferred language)
    const langParam = preferredLang ? `&lang=${preferredLang}` : "";
    fetch(`/api/leaderboard?type=meme&limit=3${langParam}`)
      .then((res) => res.json())
      .then((data) => {
        const entries = (data.entries ?? []) as Array<{
          post: {
            id: string;
            title: string;
            translatedTitle?: string | null;
            author: { username: string };
            images: Array<{ originalUrl: string }>;
            reactionCount: number;
          };
        }>;
        const mapped = entries.map((e) => ({
          id: e.post.id,
          title: e.post.title,
          translatedTitle: e.post.translatedTitle ?? null,
          thumbnailUrl: e.post.images?.[0]?.originalUrl,
          authorUsername: e.post.author.username,
          reactionCount: e.post.reactionCount ?? 0,
        }));
        // Deduplicate by id (same post can appear multiple times)
        const seen = new Set<string>();
        const deduped = mapped.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setHotMemes(deduped);
        setMonthlyContenders(
          mapped.slice(0, 3).map((m) => ({
            id: m.id,
            title: m.title,
            translatedTitle: m.translatedTitle,
            imageUrl: m.thumbnailUrl || null,
            reactionCount: m.reactionCount,
          }))
        );
      })
      .catch((err) => {
        console.error("Failed to fetch hot memes:", err);
        setErrorMemes(true);
      })
      .finally(() => setLoadingMemes(false));

    // Calculate monthly days left & fetch top contenders from meme leaderboard
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setMonthlyDaysLeft(lastDay - now.getDate());

    // Reuse meme leaderboard data for monthly contenders (already fetched above for hotMemes)
    // We set monthlyContenders from the same meme fetch result above — see hotMemes fetch

    // Fetch championship status
    fetch("/api/championship")
      .then((res) => res.json())
      .then((data) => {
        if (data.championship) {
          setChampionshipPhase(data.championship.phase);
          setChampionshipYear(data.championship.year);
        }
      })
      .catch(() => {});

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
  }, [preferredLang]);

  // Fetch user's country standing + streak
  useEffect(() => {
    if (!session?.user) return;
    fetchCurrentUser()
      .then((userData) => {
        if (!userData) return;
        // Set streak
        if (typeof userData.uploadStreakCount === "number") {
          setUploadStreak(userData.uploadStreakCount);
        }
        if (!userData?.countryId) return;
        const countryId = userData.countryId;
        const countryFlag = userData.country?.flagEmoji || "";
        const countryName = userData.country?.nameEn || "";

        // Check if user's country is in top 5
        const inTop5 = rankings.some((r) => r.id === countryId);
        setMyCountryInTop5(inTop5);

        if (!inTop5) {
          // Fetch full country leaderboard to find rank
          fetch("/api/leaderboard?type=country&limit=100")
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
              const entries = (data?.entries ?? []) as Array<{
                rank: number;
                country: { id: string; nameEn: string; flagEmoji: string };
                score: number;
              }>;
              const myEntry = entries.find((e) => e.country.id === countryId);
              if (myEntry) {
                setMyCountry({
                  flag: myEntry.country.flagEmoji || countryFlag,
                  name: myEntry.country.nameEn || countryName,
                  rank: myEntry.rank,
                  score: myEntry.score,
                });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [session?.user, rankings]);

  const maxCountryScore = rankings[0]?.score ?? 0;
  const maxCreatorScore = creators[0]?.score ?? 0;

  return (
    <aside className="sticky top-[7.5rem] max-h-[calc(100vh-8.5rem)] overflow-y-auto space-y-4 scrollbar-hide pr-0.5">
      {/* Upload Streak */}
      {session?.user && (
        <Link href="/upload" className="block bg-background-surface border border-border hover:border-[#c9a84c]/50 rounded-xl px-3 py-2.5 text-center transition-colors group">
          {uploadStreak > 0 ? (
            <p className="text-xs text-[#c9a84c] font-medium">
              {uploadStreak}-day upload streak
            </p>
          ) : (
            <p className="text-xs text-foreground-subtle group-hover:text-[#c9a84c] transition-colors">
              Upload today to start your streak
            </p>
          )}
        </Link>
      )}

      {/* VS Event Banner */}
      <VsEventBanner />

      {/* Championship Banner */}
      {championshipPhase && championshipPhase !== "COMPLETED" && (
        <ChampionshipBanner phase={championshipPhase} year={championshipYear} />
      )}

      {/* Country Rankings */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            {t("sidebar.countryRankings")}
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
            {rankings.slice(0, 8).map((c, idx) => (
              <div key={c.id}>
                <Link
                  href={`/?country=${c.id}`}
                  className={`group block rounded-lg px-1 -mx-1 hover:bg-background-elevated transition-colors cursor-pointer ${
                    c.rank === 1
                      ? "bg-[#c9a84c]/10 border border-[#c9a84c]/20 hover:bg-[#c9a84c]/15"
                      : ""
                  } ${c.rank > 8 ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-1.5 py-0.5">
                    <RankBadge rank={c.rank} />
                    <span className="text-sm">{c.flag}</span>
                    <span className="text-xs text-foreground-muted flex-1 truncate">
                      {c.name}
                    </span>
                    {/* Rank change indicator */}
                    {c.rankChange === "up" && (
                      <span className="text-[10px] text-emerald-400 font-bold">▲</span>
                    )}
                    {c.rankChange === "down" && (
                      <span className="text-[10px] text-red-400 font-bold">▼</span>
                    )}
                    <span className="text-[10px] text-foreground-subtle">
                      {c.activeUsers}u
                    </span>
                    <span className="text-xs font-semibold text-[#c9a84c] font-mono min-w-[32px] text-right" title={`Total: ${c.totalScore.toLocaleString()} / Per user: ${c.perUserScore}`}>
                      {typeof c.perUserScore === 'number' ? c.perUserScore.toLocaleString() : c.score.toLocaleString()}
                    </span>
                  </div>
                  <div className="ml-[26px]">
                    <ScoreBar score={c.score} maxScore={maxCountryScore} />
                  </div>
                </Link>
                {/* Top 8 qualification line */}
                {idx === 7 && rankings.length > 8 && (
                  <div className="flex items-center gap-2 my-1.5 px-1">
                    <div className="flex-1 border-t border-dashed border-[#c9a84c]/30" />
                    <span className="text-[9px] text-[#c9a84c]/60 font-medium whitespace-nowrap">
                      {t("sidebar.top8Line")}
                    </span>
                    <div className="flex-1 border-t border-dashed border-[#c9a84c]/30" />
                  </div>
                )}
              </div>
            ))}
            {/* Show user's country qualification status */}
            {session?.user && myCountry && !myCountryInTop5 && myCountry.rank <= 8 && (
              <div className="mt-1 text-center">
                <span className="text-[10px] text-[#c9a84c] font-medium">
                  {t("sidebar.qualified")}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Championship Widget (December) */}
      {championshipPhase && championshipPhase !== "COMPLETED" && (
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-[#c9a84c]">{t("sidebar.championshipWidget")}</h3>
          </div>
          <p className="text-xs text-foreground-muted mb-2">
            {t(`championship.banner.${championshipPhase.toLowerCase()}` as never)}
          </p>
          <Link
            href="/championship"
            className="block w-full text-center py-1.5 rounded-lg text-xs font-medium bg-[#c9a84c]/15 text-[#c9a84c] hover:bg-[#c9a84c]/25 transition-colors border border-[#c9a84c]/20"
          >
            {t("sidebar.viewChampionship")}
          </Link>
        </Card>
      )}

      {/* My Country Standing (only if logged in and country NOT in top 5) */}
      {session?.user && myCountry && !myCountryInTop5 && (
        <Card>
          <div className="text-center space-y-1.5">
            <p className="text-xs text-foreground-muted">
              {t("sidebar.yourCountry", {
                flag: myCountry.flag,
                name: myCountry.name,
                rank: String(myCountry.rank),
                score: myCountry.score.toLocaleString(),
              })}
            </p>
            <p className="text-[10px] text-[#c9a84c]">
              {t("sidebar.uploadToClimb")}
            </p>
          </div>
        </Card>
      )}

      {/* Rank nudge: show pts needed to overtake the country above */}
      {session?.user && myCountry && rankings.length > 0 && (() => {
        const myRank = myCountry.rank;
        const above = rankings.find((r) => r.rank === myRank - 1);
        if (!above) return null;
        const diff = above.score - myCountry.score;
        if (diff <= 0) return null;
        return (
          <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-[#c9a84c] font-medium">
              Only <strong>{diff.toLocaleString()} pts</strong> behind {above.flag} {above.name}
            </p>
            <p className="text-[10px] text-foreground-subtle mt-0.5">Post more to climb to #{myRank - 1}</p>
          </div>
        );
      })()}

      {/* Hot Memes */}
      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          {t("sidebar.hotMemes")}
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
                  <div className="w-10 h-10 rounded-lg bg-background-elevated flex-shrink-0 flex items-center justify-center text-foreground-subtle text-xs font-bold">
                    #{i + 1}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate group-hover:text-[#c9a84c] transition-colors">
                    {meme.translatedTitle ?? meme.title}
                  </p>
                  <p className="text-[10px] text-foreground-subtle">
                    @{meme.authorUsername} · {meme.reactionCount}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Monthly Voting */}
      {monthlyContenders.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              {t("monthly.votingStatus")}
            </h3>
            {monthlyDaysLeft > 0 && (
              <span className="text-[10px] text-foreground-subtle flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {t("monthly.daysLeft", { days: monthlyDaysLeft })}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {monthlyContenders.map((post, i) => {
              const maxScore = monthlyContenders[0]?.reactionCount || 1;
              const pct = Math.max(8, (post.reactionCount / maxScore) * 100);
              const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
              const barColors = ["#c9a84c", "#c0c0c0", "#CD7F32"];
              return (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="block rounded-lg p-1 -mx-1 hover:bg-background-elevated transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm w-5 text-center flex-shrink-0">{medals[i]}</span>
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-7 h-7 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <span className="text-xs text-foreground-muted truncate flex-1 group-hover:text-foreground transition-colors">
                      {post.translatedTitle ?? post.title}
                    </span>
                    <span className="text-[10px] text-foreground-subtle tabular-nums flex-shrink-0">
                      {post.reactionCount}
                    </span>
                  </div>
                  <div className="ml-[26px] mt-0.5">
                    <div className="h-1 bg-background-overlay rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: barColors[i] }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-border flex justify-end">
            <Link
              href="/leaderboard"
              className="text-[10px] text-[#c9a84c] hover:text-[#d4b65c] transition-colors"
            >
              {t("monthly.viewFullRankings")} {"\u2192"}
            </Link>
          </div>
        </Card>
      )}

      {/* Top Creators */}
      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          {t("sidebar.topCreators")}
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
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-foreground-muted truncate group-hover:text-foreground transition-colors">
                      {creator.displayName || `@${creator.username}`}
                    </span>
                    {creator.tier && <TierBadge tier={creator.tier} size="xs" />}
                  </div>
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
            {t("sidebar.trending")}
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
