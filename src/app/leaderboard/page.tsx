"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";
import LeaderboardTable from "@/components/competition/LeaderboardTable";
import ScoreBreakdown from "@/components/competition/ScoreBreakdown";
import ActivityFeed from "@/components/competition/ActivityFeed";
import ErrorState from "@/components/ui/ErrorState";
import ScoringExplanationModal from "@/components/competition/ScoringExplanationModal";
import Avatar from "@/components/ui/Avatar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiCountryEntry {
  rank: number;
  country: { id: string; nameEn: string; flagEmoji: string };
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
  totalScore?: number;
  perUserScore?: number;
  activeUsers?: number;
  totalPosts: number;
  totalCreators: number;
}

interface ApiCreatorEntry {
  rank: number;
  user: { username: string; displayName: string | null; avatarUrl: string | null };
  country: { flagEmoji: string } | null;
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
  totalPosts: number;
  tier: string | null;
  level: number | null;
}

interface ApiMemeEntry {
  rank: number;
  post: { id: string; title: string; translatedTitle?: string | null; author: { username: string }; images: Array<{ originalUrl: string }>; reactionCount: number };
  medal: "GOLD" | "SILVER" | "BRONZE" | null;
  score: number;
}

interface ApiLeaderboardResponse { type: string; seasonId: string | null; entries: unknown[]; message?: string }

interface MonthlyWinnerData {
  id: string;
  month: number;
  year: number;
  likeCount: number;
  post: { id: string; title: string; translatedTitle?: string | null; reactionCount: number; images: { originalUrl: string }[] };
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null; isChampion: boolean } | null;
  country: { id: string; nameEn: string; flagEmoji: string } | null;
}

const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapCountries(entries: ApiCountryEntry[]) {
  return entries.map((e) => ({
    rank: e.rank, countryId: e.country.id, flagEmoji: e.country.flagEmoji,
    name: e.country.nameEn, totalScore: e.totalScore ?? e.score,
    perUserScore: e.perUserScore ?? e.score,
    activeUsers: e.activeUsers ?? e.totalCreators,
    medal: e.medal ?? undefined,
    totalPosts: e.totalPosts, totalCreators: e.totalCreators,
  }));
}

function mapCreators(entries: ApiCreatorEntry[]) {
  return entries.map((e) => ({
    rank: e.rank, username: e.user.username, displayName: e.user.displayName,
    avatarUrl: e.user.avatarUrl, countryFlag: e.country?.flagEmoji,
    totalScore: e.score, medal: e.medal ?? undefined, totalPosts: e.totalPosts,
    tier: e.tier ?? undefined, level: e.level ?? undefined,
  }));
}

function mapMemes(entries: ApiMemeEntry[]) {
  return entries.map((e) => ({
    rank: e.rank, postId: e.post.id, title: e.post.translatedTitle || e.post.title,
    thumbnailUrl: e.post.images?.[0]?.originalUrl, authorUsername: e.post.author.username,
    totalScore: e.score, medal: e.medal ?? undefined, reactionCount: e.post.reactionCount ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LeaderboardPage() {
  const { t, locale } = useTranslation();
  const { data: session } = useSession();
  const [showScoring, setShowScoring] = useState(false);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<ReturnType<typeof mapCountries>>([]);
  const [creators, setCreators] = useState<ReturnType<typeof mapCreators>>([]);
  const [memes, setMemes] = useState<ReturnType<typeof mapMemes>>([]);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState(false);
  const [isRealtime, setIsRealtime] = useState(false);
  const [battleMemes, setBattleMemes] = useState<Array<{
    id: string; title: string; imageUrl: string; battleWins: number; battleLosses: number;
    author: { username: string; displayName: string | null }; country: { flagEmoji: string } | null;
  }>>([]);
  const [monthlyWinners, setMonthlyWinners] = useState<MonthlyWinnerData[]>([]);
  const [myScore, setMyScore] = useState<{ reactions: number; comments: number; shares: number; totalScore: number; rank: number; totalUsers: number } | null>(null);
  const [mvpData, setMvpData] = useState<{ weeklyMvp: { username: string; displayName?: string | null; avatarUrl?: string | null; countryFlag?: string; reactionCount: number } | null; monthlyMvp: { username: string; displayName?: string | null; avatarUrl?: string | null; countryFlag?: string; reactionCount: number } | null } | null>(null);
  const [matchup, setMatchup] = useState<Array<{ country: { id: string; nameEn: string; flagEmoji: string }; weeklyReactions: number }> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [countryRes, creatorRes, memeRes, battleRes, winnersRes] = await Promise.all([
        fetch("/api/leaderboard?type=country"),
        fetch("/api/leaderboard?type=creator"),
        fetch(`/api/leaderboard?type=meme&lang=${locale}`),
        fetch("/api/leaderboard?type=battle&limit=5"),
        fetch(`/api/seasons/monthly-winner?lang=${locale}`),
      ]);

      const countryData: ApiLeaderboardResponse = await countryRes.json();
      const creatorData: ApiLeaderboardResponse = await creatorRes.json();
      const memeData: ApiLeaderboardResponse = await memeRes.json();
      const battleData = await battleRes.json().catch(() => ({ entries: [] }));
      const winnersData = await winnersRes.json().catch(() => ({ winners: [] }));

      // Check if data is from realtime fallback
      if ((countryData as ApiLeaderboardResponse & { source?: string }).source === "realtime") {
        setIsRealtime(true);
      }

      const mappedCountries = mapCountries((countryData.entries ?? []) as ApiCountryEntry[]);
      const mappedCreators = mapCreators((creatorData.entries ?? []) as ApiCreatorEntry[]);
      const mappedMemes = mapMemes((memeData.entries ?? []) as ApiMemeEntry[]);

      setCountries(mappedCountries);
      setCreators(mappedCreators);
      setMemes(mappedMemes);
      if (battleData.entries?.length > 0) setBattleMemes(battleData.entries);
      if (winnersData.winners?.length > 0) setMonthlyWinners(winnersData.winners);
      if (mappedCountries.length === 0 && mappedCreators.length === 0 && mappedMemes.length === 0) setEmpty(true);
    } catch (err) {
      console.error("Failed to fetch leaderboard data:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Fetch my score, MVP, and matchup data
  useEffect(() => {
    if (session?.user) {
      fetch("/api/leaderboard?type=my-score")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data && !data.error) setMyScore(data); })
        .catch(() => {});
    }
    fetch("/api/leaderboard?type=mvp")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setMvpData(data); })
      .catch(() => {});
    fetch("/api/leaderboard?type=country-matchup")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.matchup) setMatchup(data.matchup); })
      .catch(() => {});
  }, [session?.user]);

  if (error) {
    return (<MainLayout showSidebar={false}><ErrorState message="Failed to load leaderboard" onRetry={fetchAll} /></MainLayout>);
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="py-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-foreground">{t("leaderboard.title")}</h1>
          <p className="text-sm text-foreground-subtle">
            {isRealtime ? t("leaderboard.allTimeRankings") : t("leaderboard.seasonRankings")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowScoring(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#c9a84c]/30 bg-[#c9a84c]/10 text-[#c9a84c] hover:bg-[#c9a84c]/20 hover:border-[#c9a84c]/50 transition-all text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01" />
              </svg>
              {t("scoring.howItWorks")}
            </button>
            <Link
              href="/championship"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background-surface hover:border-[#c9a84c]/30 transition-all text-sm font-medium text-foreground-subtle hover:text-[#c9a84c]"
            >
              {"\u{1F3C6}"} {t("nav.championship")}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>

        {isRealtime && !loading && !empty && (
          <div className="mx-auto max-w-md bg-[#c9a84c]/10 border border-[#c9a84c]/20 rounded-xl px-4 py-2.5 text-center">
            <p className="text-xs text-[#c9a84c]">{t("leaderboard.realtimeNotice")}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-border-active border-t-[#c9a84c] rounded-full animate-spin" />
          </div>
        ) : (
          <>
          {/* Country Competition — always show structure */}
            <div className="space-y-4">
              {/* Podium — shows real data when available, placeholders for missing slots */}
              {(() => {
                const podiumSlots = [
                  { pos: "2nd", idx: 1, height: 100, from: "#8a8a8a", to: "#c0c0c0", textSize: "text-xs", flagSize: "text-3xl", w: "w-20" },
                  { pos: "1st", idx: 0, height: 140, from: "#a07c1c", to: "#c9a84c", textSize: "text-sm", flagSize: "text-4xl", w: "w-24" },
                  { pos: "3rd", idx: 2, height: 80,  from: "#8B4513", to: "#CD7F32", textSize: "text-xs", flagSize: "text-2xl", w: "w-20" },
                ];
                return (
                  <div className="bg-background-surface border border-border rounded-xl p-6">
                    <div className="flex items-end justify-center gap-3">
                      {podiumSlots.map(({ pos, idx, height, from, to, textSize, flagSize, w }) => {
                        const c = countries[idx];
                        return c ? (
                          <Link key={pos} href={`/?country=${c.countryId}`} className="flex flex-col items-center hover:opacity-80 transition-opacity">
                            <span className={`${flagSize} mb-1`}>{c.flagEmoji}</span>
                            <div className={`${w} rounded-t-lg flex flex-col items-center justify-end p-2`} style={{ height, background: `linear-gradient(to top, ${from}, ${to})` }}>
                              <span className={`${textSize} font-bold text-white`}>{pos}</span>
                              <span className="text-[10px] text-white/80 truncate w-full text-center">{c.name.replace("United States", "USA").replace("United Kingdom", "UK").replace("South Korea", "S. Korea")}</span>
                              <span className={`${textSize} font-bold text-white mt-0.5`}>{(c.perUserScore ?? c.totalScore)?.toLocaleString()}</span>
                              <span className="text-[8px] text-white/60">pts/user</span>
                            </div>
                          </Link>
                        ) : (
                          <div key={pos} className="flex flex-col items-center opacity-25">
                            <span className={`${flagSize} mb-1`}>🏳️</span>
                            <div className={`${w} rounded-t-lg flex items-center justify-center p-2`} style={{ height, background: `linear-gradient(to top, ${from}40, ${to}40)` }}>
                              <span className={`${textSize} text-foreground-subtle`}>{pos}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {countries.length < 3 && (
                      <p className="text-xs text-foreground-subtle text-center mt-4">{t("leaderboard.noActivity")}</p>
                    )}
                  </div>
                );
              })()}

            </div>

          {/* My Score Breakdown (logged-in only) */}
          {myScore && myScore.totalScore > 0 && (
            <ScoreBreakdown
              reactions={myScore.reactions}
              comments={myScore.comments}
              shares={myScore.shares}
              totalScore={myScore.totalScore}
              rank={myScore.rank}
              totalUsers={myScore.totalUsers}
            />
          )}

          {/* Weekly/Monthly MVP Cards */}
          {mvpData && (mvpData.weeklyMvp || mvpData.monthlyMvp) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mvpData.weeklyMvp && (
                <Link href={`/user/${mvpData.weeklyMvp.username}`} className="bg-background-surface border border-[#c9a84c]/20 rounded-xl p-4 hover:border-[#c9a84c]/50 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{"\u2B50"}</span>
                    <span className="text-xs font-bold text-[#c9a84c] uppercase">{t("leaderboard.weeklyMvp") || "Weekly MVP"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {mvpData.weeklyMvp.avatarUrl ? (
                      <img src={mvpData.weeklyMvp.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-background-elevated flex items-center justify-center text-foreground-subtle">{(mvpData.weeklyMvp.displayName || mvpData.weeklyMvp.username)[0]?.toUpperCase()}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {mvpData.weeklyMvp.countryFlag && <span className="text-sm">{mvpData.weeklyMvp.countryFlag}</span>}
                        <span className="text-sm font-medium text-foreground truncate">{mvpData.weeklyMvp.displayName || mvpData.weeklyMvp.username}</span>
                      </div>
                      <span className="text-xs text-foreground-subtle">{mvpData.weeklyMvp.reactionCount.toLocaleString()} {"\uD83D\uDD25"}</span>
                    </div>
                  </div>
                </Link>
              )}
              {mvpData.monthlyMvp && (
                <Link href={`/user/${mvpData.monthlyMvp.username}`} className="bg-background-surface border border-[#c9a84c]/20 rounded-xl p-4 hover:border-[#c9a84c]/50 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{"\uD83C\uDFC5"}</span>
                    <span className="text-xs font-bold text-[#c9a84c] uppercase">{t("leaderboard.monthlyMvp") || "Monthly MVP"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {mvpData.monthlyMvp.avatarUrl ? (
                      <img src={mvpData.monthlyMvp.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-background-elevated flex items-center justify-center text-foreground-subtle">{(mvpData.monthlyMvp.displayName || mvpData.monthlyMvp.username)[0]?.toUpperCase()}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {mvpData.monthlyMvp.countryFlag && <span className="text-sm">{mvpData.monthlyMvp.countryFlag}</span>}
                        <span className="text-sm font-medium text-foreground truncate">{mvpData.monthlyMvp.displayName || mvpData.monthlyMvp.username}</span>
                      </div>
                      <span className="text-xs text-foreground-subtle">{mvpData.monthlyMvp.reactionCount.toLocaleString()} {"\uD83D\uDD25"}</span>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Country vs Country Matchup */}
          {matchup && matchup.length === 2 && (
            <div className="bg-background-surface border border-border rounded-xl p-4">
              <h3 className="text-xs font-bold text-[#c9a84c] uppercase text-center mb-3">
                {"\u2694\uFE0F"} {t("leaderboard.countryMatchup") || "Country vs Country"} - {t("leaderboard.thisWeek") || "This Week"}
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-center">
                  <span className="text-3xl block mb-1">{matchup[0].country.flagEmoji}</span>
                  <span className="text-xs font-medium text-foreground block truncate">{matchup[0].country.nameEn}</span>
                  <span className="text-sm font-bold text-[#c9a84c]">{matchup[0].weeklyReactions.toLocaleString()}</span>
                </div>
                <div className="text-lg font-bold text-foreground-subtle">VS</div>
                <div className="flex-1 text-center">
                  <span className="text-3xl block mb-1">{matchup[1].country.flagEmoji}</span>
                  <span className="text-xs font-medium text-foreground block truncate">{matchup[1].country.nameEn}</span>
                  <span className="text-sm font-bold text-[#c9a84c]">{matchup[1].weeklyReactions.toLocaleString()}</span>
                </div>
              </div>
              {/* Progress bar */}
              {(() => {
                const total = matchup[0].weeklyReactions + matchup[1].weeklyReactions;
                const pct = total > 0 ? (matchup[0].weeklyReactions / total) * 100 : 50;
                return (
                  <div className="mt-3 flex gap-0.5 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-[#c9a84c] rounded-l-full transition-all" style={{ width: `${pct}%` }} />
                    <div className="h-full bg-foreground-subtle/30 rounded-r-full transition-all" style={{ width: `${100 - pct}%` }} />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Rankings Table — always show, even empty */}
          <LeaderboardTable countries={countries} creators={creators} memes={memes} currentUsername={session?.user?.username} />

          {empty && (
            <div className="text-center py-8">
              <span className="text-3xl mb-3 block">{"\u{1F30D}"}</span>
              <p className="text-sm text-foreground-subtle mb-4">{t("leaderboard.noActivity")}</p>
              <Link href="/upload" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#c9a84c] hover:bg-[#d4b65c] text-black font-medium text-sm transition-colors">
                {t("nav.upload")}
              </Link>
            </div>
          )}

          {/* Monthly Winners Gallery */}
          {monthlyWinners.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#c9a84c] mb-3 flex items-center gap-2">
                <span>{"\uD83C\uDFC6"}</span> {t("season.monthlyWinners")}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {monthlyWinners.map((winner) => (
                  <Link
                    key={winner.id}
                    href={`/post/${winner.post.id}`}
                    className="group bg-background-surface border-2 border-[#c9a84c]/30 rounded-xl overflow-hidden hover:border-[#c9a84c] transition-colors shadow-[0_0_8px_rgba(201,168,76,0.08)] hover:shadow-[0_0_16px_rgba(201,168,76,0.15)]"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-background-elevated">
                      {winner.post.images[0]?.originalUrl && (
                        <img
                          src={winner.post.images[0].originalUrl}
                          alt={winner.post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg">
                        <span className="text-xs font-bold text-[#c9a84c]">{MONTH_ABBREV[winner.month - 1]}</span>
                      </div>
                      <div className="absolute top-2 right-2">
                        <span className="text-lg drop-shadow-lg">{"\uD83D\uDC51"}</span>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                        <span className="text-[10px]">{"\uD83D\uDD25"}</span>
                        <span className="text-[10px] text-white font-medium">{winner.likeCount}</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-foreground truncate mb-1.5">{winner.post.translatedTitle || winner.post.title}</p>
                      <div className="flex items-center gap-1.5">
                        <Avatar
                          src={winner.author?.avatarUrl}
                          alt={winner.author?.displayName || winner.author?.username || ""}
                          size="sm"
                          isChampion={winner.author?.isChampion}
                        />
                        <span className="text-[11px] text-foreground-muted truncate">
                          {winner.author?.displayName || winner.author?.username || "Unknown"}
                        </span>
                        {winner.country && <span className="text-xs ml-auto">{winner.country.flagEmoji}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Live Activity Feed */}
          <ActivityFeed />

          {/* Hot Battle Memes */}
          {battleMemes.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#c9a84c] mb-3 flex items-center gap-2">
                <span>{"\u2694\uFE0F"}</span> {t("battle.hotBattle")}
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {battleMemes.map((meme) => (
                  <Link key={meme.id} href={`/post/${meme.id}`} className="flex-shrink-0 w-32 rounded-xl overflow-hidden border border-border bg-background-surface hover:border-[#c9a84c] transition-colors">
                    <img src={meme.imageUrl} alt={meme.title} className="w-full aspect-square object-cover" />
                    <div className="p-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        {meme.country && <span className="text-xs">{meme.country.flagEmoji}</span>}
                        <span className="text-[10px] text-foreground-muted truncate">{meme.author?.displayName || meme.author?.username}</span>
                      </div>
                      <div className="text-[10px] text-[#c9a84c] font-medium">{"\u2694\uFE0F"} {meme.battleWins}W / {meme.battleLosses}L</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          </>
        )}
      </div>
      <ScoringExplanationModal isOpen={showScoring} onClose={() => setShowScoring(false)} />
    </MainLayout>
  );
}
