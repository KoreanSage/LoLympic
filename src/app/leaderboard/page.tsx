"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import LeaderboardTable from "@/components/competition/LeaderboardTable";
import SeasonBar from "@/components/competition/SeasonBar";
import ErrorState from "@/components/ui/ErrorState";
import ScoringExplanationModal from "@/components/competition/ScoringExplanationModal";

// ---------------------------------------------------------------------------
// Types matching the API response shapes
// ---------------------------------------------------------------------------

interface ApiCountryEntry {
  rank: number;
  country: { id: string; nameEn: string; flagEmoji: string };
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
  totalPosts: number;
  totalCreators: number;
}

interface ApiCreatorEntry {
  rank: number;
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  country: { flagEmoji: string } | null;
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
  totalPosts: number;
  tier: string | null;
  level: number | null;
}

interface ApiMemeEntry {
  rank: number;
  post: {
    id: string;
    title: string;
    author: { username: string };
    images: Array<{ originalUrl: string }>;
    reactionCount: number;
  };
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
}

interface ApiLeaderboardResponse {
  type: string;
  seasonId: string | null;
  entries: unknown[];
  message?: string;
}

// ---------------------------------------------------------------------------
// Mappers: API response -> LeaderboardTable prop format
// ---------------------------------------------------------------------------

function mapCountries(entries: ApiCountryEntry[]) {
  return entries.map((e) => ({
    rank: e.rank,
    countryId: e.country.id,
    flagEmoji: e.country.flagEmoji,
    name: e.country.nameEn,
    totalScore: e.score,
    medal: e.medal ?? undefined,
    totalPosts: e.totalPosts,
    totalCreators: e.totalCreators,
  }));
}

function mapCreators(entries: ApiCreatorEntry[]) {
  return entries.map((e) => ({
    rank: e.rank,
    username: e.user.username,
    displayName: e.user.displayName,
    avatarUrl: e.user.avatarUrl,
    countryFlag: e.country?.flagEmoji,
    totalScore: e.score,
    medal: e.medal ?? undefined,
    totalPosts: e.totalPosts,
    tier: e.tier ?? undefined,
    level: e.level ?? undefined,
  }));
}

function mapMemes(entries: ApiMemeEntry[]) {
  return entries.map((e) => ({
    rank: e.rank,
    postId: e.post.id,
    title: e.post.title,
    thumbnailUrl: e.post.images?.[0]?.originalUrl,
    authorUsername: e.post.author.username,
    totalScore: e.score,
    medal: e.medal ?? undefined,
    reactionCount: e.post.reactionCount ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const [showScoring, setShowScoring] = useState(false);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<ReturnType<typeof mapCountries>>(
    []
  );
  const [creators, setCreators] = useState<ReturnType<typeof mapCreators>>([]);
  const [memes, setMemes] = useState<ReturnType<typeof mapMemes>>([]);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [battleMemes, setBattleMemes] = useState<
    Array<{
      id: string;
      title: string;
      imageUrl: string;
      battleWins: number;
      battleLosses: number;
      author: { username: string; displayName: string | null };
      country: { flagEmoji: string } | null;
    }>
  >([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [countryRes, creatorRes, memeRes, battleRes] = await Promise.all([
        fetch("/api/leaderboard?type=country"),
        fetch("/api/leaderboard?type=creator"),
        fetch("/api/leaderboard?type=meme"),
        fetch("/api/leaderboard?type=battle&limit=5"),
      ]);

      const countryData: ApiLeaderboardResponse = await countryRes.json();
      const creatorData: ApiLeaderboardResponse = await creatorRes.json();
      const memeData: ApiLeaderboardResponse = await memeRes.json();
      const battleData = await battleRes.json().catch(() => ({ entries: [] }));

      // Check if data is from realtime fallback
      if ((countryData as any).source === "realtime") {
        setIsRealtime(true);
      }

      const mappedCountries = mapCountries(
        (countryData.entries ?? []) as ApiCountryEntry[]
      );
      const mappedCreators = mapCreators(
        (creatorData.entries ?? []) as ApiCreatorEntry[]
      );
      const mappedMemes = mapMemes(
        (memeData.entries ?? []) as ApiMemeEntry[]
      );

      setCountries(mappedCountries);
      setCreators(mappedCreators);
      setMemes(mappedMemes);
      if (battleData.entries?.length > 0) {
        setBattleMemes(battleData.entries);
      }

      if (
        mappedCountries.length === 0 &&
        mappedCreators.length === 0 &&
        mappedMemes.length === 0
      ) {
        setEmpty(true);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (error) {
    return (
      <MainLayout showSidebar={false}>
        <ErrorState message="Failed to load leaderboard" onRetry={fetchAll} />
      </MainLayout>
    );
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="py-6 space-y-6">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            {t("leaderboard.title")}
          </h1>
          <p className="text-sm text-foreground-subtle">
            {isRealtime ? t("leaderboard.allTimeRankings") : t("leaderboard.seasonRankings")}
          </p>
          <button
            onClick={() => setShowScoring(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 text-[#c9a84c] hover:bg-[#c9a84c]/20 hover:border-[#c9a84c]/50 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01" />
            </svg>
            {t("scoring.howItWorks")}
          </button>
        </div>

        {isRealtime && !loading && !empty && (
          <div className="mx-auto max-w-md bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-4 py-2.5 text-center">
            <p className="text-xs text-[#c9a84c]">
              📊 {t("leaderboard.realtimeNotice")}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-border-active border-t-[#c9a84c] rounded-full animate-spin" />
          </div>
        ) : empty ? (
          <div className="text-center py-20">
            <p className="text-lg mb-2">🎮</p>
            <p className="text-sm text-foreground-subtle">{t("leaderboard.noActivity")}</p>
          </div>
        ) : (
          <>
          {/* Country Competition Dashboard */}
          {countries.length >= 3 && (
            <div className="space-y-6">
              {/* Section Header */}
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <h2 className="text-lg font-bold text-foreground">{t("leaderboard.countryCompetition")}</h2>
              </div>

              {/* Live Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-background-surface border border-border rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-[#c9a84c]">{memes.length > 0 ? memes.reduce((sum, m) => sum + (m.reactionCount || 0), 0).toLocaleString() : '0'}</div>
                  <div className="text-[10px] text-foreground-subtle mt-0.5">{t("leaderboard.totalReactions")}</div>
                </div>
                <div className="bg-background-surface border border-border rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-[#c9a84c]">{countries.length}</div>
                  <div className="text-[10px] text-foreground-subtle mt-0.5">{t("leaderboard.countriesActive")}</div>
                </div>
                <div className="bg-background-surface border border-border rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-[#c9a84c]">{countries[0]?.flagEmoji}</div>
                  <div className="text-[10px] text-foreground-subtle mt-0.5 truncate">#1 {countries[0]?.name}</div>
                </div>
              </div>

              {/* Podium */}
              <div className="bg-background-surface border border-border rounded-xl p-6">
                <div className="flex items-end justify-center gap-3 mb-4">
                  {/* 2nd Place */}
                  <div className="flex flex-col items-center">
                    <span className="text-3xl mb-1">{countries[1]?.flagEmoji}</span>
                    <div className="w-20 bg-gradient-to-t from-[#8a8a8a] to-[#c0c0c0] rounded-t-lg flex flex-col items-center justify-end p-2" style={{ height: '100px' }}>
                      <span className="text-xs font-bold text-white">2nd</span>
                      <span className="text-[10px] text-white/80 truncate w-full text-center">{countries[1]?.name}</span>
                      <span className="text-xs font-bold text-white mt-0.5">{countries[1]?.totalScore?.toLocaleString()}</span>
                    </div>
                  </div>
                  {/* 1st Place */}
                  <div className="flex flex-col items-center">
                    <span className="text-4xl mb-1">{countries[0]?.flagEmoji}</span>
                    <div className="w-24 bg-gradient-to-t from-[#a07c1c] to-[#c9a84c] rounded-t-lg flex flex-col items-center justify-end p-2" style={{ height: '140px' }}>
                      <span className="text-sm font-bold text-white">1st</span>
                      <span className="text-[10px] text-white/80 truncate w-full text-center">{countries[0]?.name}</span>
                      <span className="text-sm font-bold text-white mt-0.5">{countries[0]?.totalScore?.toLocaleString()}</span>
                    </div>
                  </div>
                  {/* 3rd Place */}
                  <div className="flex flex-col items-center">
                    <span className="text-2xl mb-1">{countries[2]?.flagEmoji}</span>
                    <div className="w-20 bg-gradient-to-t from-[#8B4513] to-[#CD7F32] rounded-t-lg flex flex-col items-center justify-end p-2" style={{ height: '80px' }}>
                      <span className="text-xs font-bold text-white">3rd</span>
                      <span className="text-[10px] text-white/80 truncate w-full text-center">{countries[2]?.name}</span>
                      <span className="text-xs font-bold text-white mt-0.5">{countries[2]?.totalScore?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Country Score Bars */}
              <div className="bg-background-surface border border-border rounded-xl p-4 space-y-2.5">
                <h3 className="text-sm font-semibold text-foreground-muted mb-3">{t("leaderboard.scoreDistribution")}</h3>
                {countries.slice(0, 10).map((c, i) => {
                  const maxScore = countries[0]?.totalScore || 1;
                  const pct = Math.max(3, (c.totalScore / maxScore) * 100);
                  const barColor = i === 0 ? 'bg-[#c9a84c]' : i === 1 ? 'bg-[#c0c0c0]' : i === 2 ? 'bg-[#CD7F32]' : 'bg-foreground-subtle/30';
                  return (
                    <div key={c.countryId} className="flex items-center gap-2">
                      <span className="text-sm w-6 text-right">{c.flagEmoji}</span>
                      <span className="text-xs text-foreground-muted w-20 truncate">{c.name}</span>
                      <div className="flex-1 h-5 bg-background-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                          style={{ width: `${pct}%` }}
                        >
                          <span className="text-[10px] font-bold text-white">{c.totalScore?.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <LeaderboardTable
            countries={countries}
            creators={creators}
            memes={memes}
          />

          {/* Hot Battle Memes — at bottom */}
          {battleMemes.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-bold text-[#c9a84c] mb-3 flex items-center gap-2">
                <span>⚔️</span> {t("battle.hotBattle")}
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {battleMemes.map((meme: any, i: number) => (
                  <Link
                    key={meme.id}
                    href={`/post/${meme.id}`}
                    className="flex-shrink-0 w-32 rounded-xl overflow-hidden border border-border bg-background-surface hover:border-[#c9a84c] transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={meme.imageUrl}
                      alt={meme.title}
                      className="w-full aspect-square object-cover"
                    />
                    <div className="p-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        {meme.country && (
                          <span className="text-xs">{meme.country.flagEmoji}</span>
                        )}
                        <span className="text-[10px] text-foreground-muted truncate">
                          {meme.author?.displayName || meme.author?.username}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#c9a84c] font-medium">
                        ⚔️ {meme.battleWins}W / {meme.battleLosses}L
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          </>
        )}
      </div>
      <ScoringExplanationModal
        isOpen={showScoring}
        onClose={() => setShowScoring(false)}
      />
    </MainLayout>
  );
}
