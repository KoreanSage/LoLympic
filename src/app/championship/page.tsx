"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import ChampionshipTimeline from "@/components/championship/ChampionshipTimeline";
import CandidateCard from "@/components/championship/CandidateCard";
import ChampionshipBattleGrid from "@/components/championship/ChampionshipBattleGrid";
import ChampionshipResultCard from "@/components/championship/ChampionshipResultCard";

interface Championship {
  id: string;
  year: number;
  phase: string;
  schedule: {
    nominationStartAt: string;
    nominationEndAt: string;
    representativeStartAt: string;
    representativeEndAt: string;
    uploadStartAt: string;
    uploadEndAt: string;
    battleStartAt: string;
    battleEndAt: string;
    resultAt: string;
  };
  remainingMs: number;
  championUserId?: string | null;
  championCountryId?: string | null;
  championPostId?: string | null;
}

interface Candidate {
  id: string;
  userId: string;
  countryId: string;
  rank: number;
  status: string;
  seasonScore: number;
  voteCount: number;
  weightedVoteScore: number;
  autoElected: boolean;
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

interface CountryLeaderboardEntry {
  rank: number;
  country: { id: string; nameEn: string; flagEmoji: string };
  score: number;
  perUserScore?: number;
  activeUsers?: number;
  totalScore?: number;
}

export default function ChampionshipPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();

  const [championship, setChampionship] = useState<Championship | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [posts, setPosts] = useState<BattlePost[]>([]);
  const [results, setResults] = useState<Array<{
    rank: number | null;
    championshipPostId: string;
    postId: string;
    battleVoteCount: number;
    post: { id: string; title: string; images: Array<{ originalUrl: string }>; reactionCount: number };
    user: { id: string; username: string; displayName?: string | null; avatarUrl?: string | null };
    country: { id: string; nameEn: string; flagEmoji: string };
  }>>([]);
  const [votedCountries, setVotedCountries] = useState<Set<string>>(new Set());
  const [votedBattlePosts, setVotedBattlePosts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [battleVoting, setBattleVoting] = useState<string | null>(null);
  const [userCountryId, setUserCountryId] = useState<string | null>(null);
  const [top8Countries, setTop8Countries] = useState<CountryLeaderboardEntry[]>([]);
  const [lastYearResults, setLastYearResults] = useState<Array<{
    rank: number | null;
    championshipPostId: string;
    postId: string;
    battleVoteCount: number;
    post: { id: string; title: string; images: Array<{ originalUrl: string }>; reactionCount: number };
    user: { id: string; username: string; displayName?: string | null; avatarUrl?: string | null };
    country: { id: string; nameEn: string; flagEmoji: string };
  }>>([]);

  // Fetch championship data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/championship");
        const data = await res.json();
        if (data.championship) {
          setChampionship(data.championship);
        } else {
          // No active championship - fetch top 8 countries for preview
          const lbRes = await fetch("/api/leaderboard?type=country&limit=8");
          const lbData = await lbRes.json();
          setTop8Countries(lbData.entries ?? []);

          // Try to fetch last year's results
          const currentYear = new Date().getFullYear();
          try {
            const resultRes = await fetch(`/api/championship/results?year=${currentYear - 1}`);
            const resultData = await resultRes.json();
            if (resultData.rankings?.length > 0) {
              setLastYearResults(resultData.rankings);
            }
          } catch {
            // No last year results
          }
        }
      } catch (e) {
        console.error("Failed to fetch championship:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch candidates when in nomination/representative phase
  useEffect(() => {
    if (!championship) return;
    if (!["NOMINATION", "REPRESENTATIVE", "UPLOAD"].includes(championship.phase)) return;

    fetch("/api/championship/candidates")
      .then((r) => r.json())
      .then((data) => setCandidates(data.candidates ?? []))
      .catch(console.error);
  }, [championship]);

  // Fetch battle posts when in championship/completed phase
  useEffect(() => {
    if (!championship) return;
    if (!["CHAMPIONSHIP", "UPLOAD"].includes(championship.phase)) return;

    fetch("/api/championship/posts")
      .then((r) => r.json())
      .then((data) => setPosts(data.posts ?? []))
      .catch(console.error);
  }, [championship]);

  // Fetch results when completed
  useEffect(() => {
    if (!championship || championship.phase !== "COMPLETED") return;

    fetch(`/api/championship/results?year=${championship.year}`)
      .then((r) => r.json())
      .then((data) => setResults(data.rankings ?? []))
      .catch(console.error);
  }, [championship]);

  // Fetch user's vote status
  useEffect(() => {
    if (!session?.user || !championship) return;

    // Get user country
    fetch("/api/users/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.countryId) setUserCountryId(data.countryId);
      })
      .catch(() => {});

    // Representative votes
    if (championship.phase === "REPRESENTATIVE") {
      fetch("/api/championship/vote/representative")
        .then((r) => r.json())
        .then((data) => {
          const countries = new Set<string>();
          for (const v of data.votes ?? []) {
            if (v.candidate?.countryId) countries.add(v.candidate.countryId);
          }
          setVotedCountries(countries);
        })
        .catch(() => {});
    }

    // Battle votes
    if (championship.phase === "CHAMPIONSHIP") {
      fetch("/api/championship/vote/battle")
        .then((r) => r.json())
        .then((data) => {
          const postIds = new Set<string>();
          for (const v of data.votes ?? []) {
            postIds.add(v.championshipPostId);
          }
          setVotedBattlePosts(postIds);
        })
        .catch(() => {});
    }
  }, [session?.user, championship]);

  const handleRepresentativeVote = useCallback(async (candidateId: string) => {
    setVoting(true);
    try {
      const res = await fetch("/api/championship/vote/representative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const data = await res.json();
      if (data.success) {
        const candidate = candidates.find((c) => c.id === candidateId);
        if (candidate) {
          setVotedCountries((prev) => { const next = new Set(Array.from(prev)); next.add(candidate.countryId); return next; });
          setCandidates((prev) =>
            prev.map((c) =>
              c.id === candidateId ? { ...c, voteCount: c.voteCount + 1 } : c
            )
          );
        }
      } else {
        alert(data.error || "Failed to vote");
      }
    } catch (e) {
      console.error("Vote error:", e);
    } finally {
      setVoting(false);
    }
  }, [candidates]);

  const handleBattleVote = useCallback(async (championshipPostId: string) => {
    setBattleVoting(championshipPostId);
    try {
      const res = await fetch("/api/championship/vote/battle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ championshipPostId }),
      });
      const data = await res.json();
      if (data.success) {
        setVotedBattlePosts((prev) => { const next = new Set(Array.from(prev)); next.add(championshipPostId); return next; });
        setPosts((prev) =>
          prev.map((p) =>
            p.id === championshipPostId
              ? { ...p, battleVoteCount: p.battleVoteCount + 1 }
              : p
          )
        );
      } else {
        alert(data.error || "Failed to vote");
      }
    } catch (e) {
      console.error("Battle vote error:", e);
    } finally {
      setBattleVoting(null);
    }
  }, []);

  // Group candidates by country
  const candidatesByCountry = candidates.reduce<Record<string, Candidate[]>>((acc, c) => {
    if (!acc[c.countryId]) acc[c.countryId] = [];
    acc[c.countryId].push(c);
    return acc;
  }, {});

  // Upload phase: count uploaded posts
  const electedCandidates = candidates.filter((c) => c.status === "ELECTED" || c.status === "SUBSTITUTE");
  const uploadedCount = posts.length;
  const totalReps = electedCandidates.length || 8;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Inactive state (no championship running)
  if (!championship) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <span className="text-5xl mb-4 block">🏆</span>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("championship.title")}</h1>
          <p className="text-foreground-subtle">{t("championship.comingDecember")}</p>
        </div>

        {/* Current Top 8 Preview */}
        {top8Countries.length > 0 && (
          <div className="bg-background-surface border border-border rounded-xl p-6 mb-6">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <span>🎯</span>
              {t("championship.projectedTop8")}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {top8Countries.map((entry, i) => (
                <div
                  key={entry.country.id}
                  className="flex flex-col items-center p-3 rounded-xl bg-background-elevated border border-border"
                >
                  <span className="text-2xl mb-1">{entry.country.flagEmoji}</span>
                  <span className="text-xs font-medium text-foreground truncate w-full text-center">
                    {entry.country.nameEn}
                  </span>
                  <span className="text-[10px] text-foreground-subtle mt-0.5">
                    #{i + 1} - {typeof entry.score === 'number' ? entry.score.toLocaleString() : '0'} pts/user
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border text-center">
              <p className="text-[11px] text-foreground-subtle">
                {t("championship.top8Explanation")}
              </p>
            </div>
          </div>
        )}

        {/* Last Year Results */}
        {lastYearResults.length > 0 && (
          <div className="bg-background-surface border border-border rounded-xl p-6">
            <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <span>👑</span>
              {t("championship.lastYearResults")}
            </h2>
            <ChampionshipResultCard
              rankings={lastYearResults}
              championUserId={lastYearResults.find(r => r.rank === 1)?.user.id}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <span className="text-4xl mb-2 block">🏆</span>
        <h1 className="text-2xl font-bold text-foreground">
          {championship.year} {t("championship.title")}
        </h1>
        <p className="text-sm text-foreground-subtle mt-1">{t("championship.subtitle")}</p>
      </div>

      {/* Timeline */}
      <div className="mb-8">
        <ChampionshipTimeline
          phase={championship.phase}
          schedule={championship.schedule}
          remainingMs={championship.remainingMs}
        />
      </div>

      {/* Phase 1: Representative Voting */}
      {(championship.phase === "NOMINATION" || championship.phase === "REPRESENTATIVE") && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span>🗳️</span>
            {championship.phase === "NOMINATION"
              ? t("championship.nominations")
              : t("championship.voteForRep")}
          </h2>

          {Object.entries(candidatesByCountry).map(([countryId, countryCandidates]) => {
            const country = countryCandidates[0]?.country;
            const hasVotedHere = votedCountries.has(countryId);
            const totalVotes = countryCandidates.reduce((sum, c) => sum + c.voteCount, 0);

            return (
              <div key={countryId} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{country?.flagEmoji}</span>
                  <h3 className="text-sm font-semibold text-foreground">
                    {country?.nameEn}
                  </h3>
                  <span className="text-[11px] text-foreground-subtle">
                    ({countryCandidates.length} {t("championship.candidatesCount")})
                  </span>
                  {hasVotedHere && (
                    <span className="ml-auto text-[10px] text-[#c9a84c] font-medium px-2 py-0.5 rounded-full bg-[#c9a84c]/10">
                      {t("championship.voted")}
                    </span>
                  )}
                </div>

                {/* Vote progress bar */}
                {totalVotes > 0 && (
                  <div className="flex gap-0.5 mb-3 h-2 rounded-full overflow-hidden bg-background-elevated">
                    {countryCandidates.map((c) => {
                      const pct = totalVotes > 0 ? (c.voteCount / totalVotes) * 100 : 0;
                      return (
                        <div
                          key={c.id}
                          className="h-full bg-[#c9a84c] transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                          style={{ width: `${Math.max(pct, 2)}%`, opacity: 0.4 + (pct / 100) * 0.6 }}
                          title={`${c.user.displayName || c.user.username}: ${c.voteCount} votes (${Math.round(pct)}%)`}
                        />
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {countryCandidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      totalVotesInCountry={totalVotes}
                      canVote={championship.phase === "REPRESENTATIVE" && !!session?.user}
                      hasVotedInCountry={hasVotedHere}
                      isMyCountry={c.countryId === userCountryId}
                      onVote={handleRepresentativeVote}
                      voting={voting}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {candidates.length === 0 && (
            <div className="text-center py-12 bg-background-surface border border-border rounded-xl">
              <p className="text-foreground-subtle">{t("championship.noCandidates")}</p>
            </div>
          )}
        </div>
      )}

      {/* Phase 2: Upload Waiting */}
      {championship.phase === "UPLOAD" && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span>📤</span>
            {t("championship.uploadPhase")}
          </h2>

          {/* Progress indicator */}
          <div className="bg-background-surface border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-foreground-muted">{t("championship.uploadProgress")}</p>
              <span className="text-sm font-bold text-[#c9a84c]">{uploadedCount}/{totalReps}</span>
            </div>
            <div className="w-full h-2 bg-background-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#c9a84c] to-[#e8c84a] rounded-full transition-all duration-500"
                style={{ width: `${(uploadedCount / totalReps) * 100}%` }}
              />
            </div>
          </div>

          {/* Elected representatives grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {electedCandidates.map((c) => {
              const hasUploaded = posts.some((p) => p.userId === c.userId);
              const isMe = session?.user?.id === c.userId;
              return (
                <div
                  key={c.id}
                  className={`relative flex flex-col items-center p-4 rounded-xl border transition-all ${
                    hasUploaded
                      ? "border-[#c9a84c]/40 bg-[#c9a84c]/5"
                      : "border-border bg-background-surface"
                  }`}
                >
                  <div className="relative">
                    {c.user.avatarUrl ? (
                      <img src={c.user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-background-elevated flex items-center justify-center text-foreground-subtle text-lg">
                        {(c.user.displayName || c.user.username)[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 text-sm">
                      {hasUploaded ? "✅" : "⏳"}
                    </span>
                  </div>
                  <span className="text-lg mt-1">{c.country.flagEmoji}</span>
                  <span className="text-xs font-medium text-foreground text-center truncate w-full mt-1">
                    {c.user.displayName || `@${c.user.username}`}
                  </span>
                  <span className="text-[10px] text-foreground-subtle">{c.country.nameEn}</span>
                  {isMe && !hasUploaded && (
                    <Link
                      href="/upload?championship=true"
                      className="mt-2 px-3 py-1 rounded-lg text-[10px] font-bold bg-[#c9a84c] text-black hover:bg-[#b8963f] transition-colors"
                    >
                      {t("championship.uploadCta")}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {/* Already submitted posts */}
          {posts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground-muted mb-3">
                {t("championship.submittedPosts")} ({posts.length})
              </h3>
              <ChampionshipBattleGrid
                posts={posts}
                votedPostIds={new Set()}
                canVote={false}
                onVote={() => {}}
                voting={null}
              />
            </div>
          )}
        </div>
      )}

      {/* Phase 3: Championship Battle */}
      {championship.phase === "CHAMPIONSHIP" && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
            <span>⚔️</span>
            {t("championship.battlePhase")}
          </h2>
          <p className="text-sm text-foreground-subtle mb-4">{t("championship.battleDesc")}</p>

          {/* Vote progress */}
          {posts.length > 0 && (
            <div className="bg-background-surface border border-border rounded-xl p-3 mb-4">
              <div className="flex items-center justify-between text-xs text-foreground-subtle mb-1">
                <span>{t("championship.totalVoteCast")}</span>
                <span className="font-bold text-[#c9a84c]">
                  {posts.reduce((sum, p) => sum + p.battleVoteCount, 0)} {t("championship.votes")}
                </span>
              </div>
            </div>
          )}

          <ChampionshipBattleGrid
            posts={[...posts].sort((a, b) => b.battleVoteCount - a.battleVoteCount)}
            votedPostIds={votedBattlePosts}
            canVote={!!session?.user}
            onVote={handleBattleVote}
            voting={battleVoting}
          />
        </div>
      )}

      {/* Phase 4: Results */}
      {championship.phase === "COMPLETED" && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
            <span>👑</span>
            {t("championship.results")}
          </h2>

          {results.length > 0 ? (
            <ChampionshipResultCard
              rankings={results}
              championUserId={championship.championUserId}
            />
          ) : (
            <div className="text-center py-12 bg-background-surface border border-border rounded-xl">
              <p className="text-foreground-subtle">{t("championship.noResults")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
