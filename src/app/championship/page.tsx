"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
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

  // Fetch championship data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/championship");
        const data = await res.json();
        if (data.championship) {
          setChampionship(data.championship);
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
        // Find the candidate to get its countryId
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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!championship) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-20">
          <span className="text-5xl mb-4 block">🏆</span>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("championship.title")}</h1>
          <p className="text-foreground-subtle">{t("championship.notActive")}</p>
          <p className="text-sm text-foreground-subtle mt-2">{t("championship.comingDecember")}</p>
        </div>
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
      <div className="mb-8 bg-background-surface border border-border rounded-xl">
        <ChampionshipTimeline
          phase={championship.phase}
          schedule={championship.schedule}
          remainingMs={championship.remainingMs}
        />
      </div>

      {/* Phase-specific content */}
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

            return (
              <div key={countryId} className="mb-6">
                <h3 className="text-sm font-semibold text-foreground-muted mb-3 flex items-center gap-2">
                  <span className="text-lg">{country?.flagEmoji}</span>
                  {country?.nameEn}
                  <span className="text-[11px] text-foreground-subtle">
                    ({countryCandidates.length} {t("championship.candidatesCount")})
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {countryCandidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
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

      {championship.phase === "UPLOAD" && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span>📤</span>
            {t("championship.uploadPhase")}
          </h2>
          <p className="text-sm text-foreground-subtle mb-4">{t("championship.uploadDesc")}</p>

          {/* Show elected representatives */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidates
              .filter((c) => c.status === "ELECTED" || c.status === "SUBSTITUTE")
              .map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  canVote={false}
                  hasVotedInCountry={false}
                  isMyCountry={c.countryId === userCountryId}
                />
              ))}
          </div>

          {/* Show already submitted posts */}
          {posts.length > 0 && (
            <div className="mt-6">
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

      {championship.phase === "CHAMPIONSHIP" && (
        <div>
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <span>⚔️</span>
            {t("championship.battlePhase")}
          </h2>
          <p className="text-sm text-foreground-subtle mb-4">{t("championship.battleDesc")}</p>

          <ChampionshipBattleGrid
            posts={posts}
            votedPostIds={votedBattlePosts}
            canVote={!!session?.user}
            onVote={handleBattleVote}
            voting={battleVoting}
          />
        </div>
      )}

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
