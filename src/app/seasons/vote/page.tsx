"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";

interface VoteResult {
  id: string;
  month: number;
  year: number;
  likeCount: number;
  voteCount: number;
  isChampion: boolean;
  post: {
    id: string;
    title: string;
    reactionCount: number;
    images: { originalUrl: string }[];
  };
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isChampion: boolean;
  };
  country: { id: string; nameEn: string; flagEmoji: string } | null;
}

interface SeasonInfo {
  id: string;
  name: string;
  status: string;
  votingStartAt: string | null;
  votingEndAt: string | null;
  championPostId: string | null;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function VotePage() {
  const { data: session } = useSession();
  const [results, setResults] = useState<VoteResult[]>([]);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [myVoteId, setMyVoteId] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [resultsRes, voteRes] = await Promise.all([
        fetch("/api/seasons/vote/results"),
        session ? fetch("/api/seasons/vote") : Promise.resolve(null),
      ]);

      const resultsData = await resultsRes.json();
      setResults(resultsData.results || []);
      setSeason(resultsData.season || null);
      setTotalVotes(resultsData.totalVotes || 0);

      if (voteRes) {
        const voteData = await voteRes.json();
        setMyVoteId(voteData.vote?.monthlyWinnerId || null);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVote = async (monthlyWinnerId: string) => {
    if (!session || voting) return;
    setVoting(true);

    try {
      const res = await fetch("/api/seasons/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyWinnerId }),
      });

      if (res.ok) {
        setMyVoteId(monthlyWinnerId);
        // Show confetti celebration
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
        await fetchData(); // refresh counts
      }
    } catch {
      // ignore
    } finally {
      setVoting(false);
    }
  };

  const isCompleted = season?.status === "COMPLETED";
  const isJudging = season?.status === "JUDGING";
  const maxVotes = Math.max(...results.map((r) => r.voteCount), 1);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-background-elevated rounded w-64" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-background-elevated rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!season || results.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <p className="text-4xl mb-4">🗳️</p>
        <h1 className="text-xl font-bold text-foreground mb-2">No Active Vote</h1>
        <p className="text-sm text-foreground-subtle">
          Final voting opens at the end of each season.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 relative">
      {/* Confetti celebration overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-start justify-center">
          <div className="text-center mt-32 animate-bounce">
            <div className="text-6xl mb-2">🎉</div>
            <div className="bg-[#c9a84c] text-black text-sm font-bold px-4 py-2 rounded-full shadow-lg">
              Vote Cast!
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isCompleted ? `${season.name} — Results` : `${season.name} — Final Vote`}
        </h1>
        <p className="text-sm text-foreground-subtle">
          {isCompleted
            ? "The people have spoken! Here are the final results."
            : "Vote for the best meme of the year. One vote per person."}
        </p>
        {totalVotes > 0 && (
          <p className="text-xs text-foreground-subtle mt-2">
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""} cast
          </p>
        )}
      </div>

      {/* Vote Cards */}
      <div className="space-y-3">
        {results
          .sort((a, b) => isCompleted ? b.voteCount - a.voteCount : a.month - b.month)
          .map((entry) => {
            const isMyVote = myVoteId === entry.id;
            const isWinner = entry.isChampion;
            const votePercent = totalVotes > 0 ? Math.round((entry.voteCount / totalVotes) * 100) : 0;

            return (
              <div
                key={entry.id}
                className={`relative bg-background-surface border rounded-xl overflow-hidden transition-all duration-200 ${
                  isWinner
                    ? "border-[#c9a84c] ring-2 ring-[#c9a84c]/30 shadow-[0_0_24px_rgba(201,168,76,0.15)]"
                    : isMyVote
                      ? "border-[#c9a84c]/50 ring-1 ring-[#c9a84c]/20"
                      : "border-border hover:border-border-active hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                {/* Champion top bar with glow */}
                {isWinner && (
                  <div className="relative">
                    <div className="h-1 bg-gradient-to-r from-[#c9a84c] via-[#FFD700] to-[#c9a84c]" />
                    <div className="absolute inset-0 h-1 bg-gradient-to-r from-[#c9a84c] via-[#FFD700] to-[#c9a84c] blur-sm" />
                  </div>
                )}

                {/* "Your Vote" badge */}
                {isMyVote && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="inline-flex items-center gap-1 bg-[#c9a84c] text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Your Vote
                    </span>
                  </div>
                )}

                <div className="flex items-stretch">
                  {/* Thumbnail */}
                  <div className={`w-24 sm:w-32 flex-shrink-0 bg-background-elevated relative ${
                    isWinner ? "ring-1 ring-inset ring-[#c9a84c]/20" : ""
                  }`}>
                    {entry.post.images[0]?.originalUrl && (
                      <img
                        src={entry.post.images[0].originalUrl}
                        alt={entry.post.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {/* Champion crown overlay on image */}
                    {isWinner && (
                      <div className="absolute inset-0 bg-gradient-to-t from-[#c9a84c]/30 to-transparent flex items-end justify-center pb-1">
                        <span className="text-2xl drop-shadow-lg">👑</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-[#c9a84c] bg-[#c9a84c]/10 px-1.5 py-0.5 rounded">
                            {MONTH_NAMES[entry.month - 1]}
                          </span>
                          {isWinner && (
                            <span className="text-xs font-black text-[#c9a84c] uppercase tracking-wide">
                              👑 Champion
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {entry.post.title}
                        </h3>
                      </div>

                      {/* Vote button or count */}
                      {isJudging && session ? (
                        <button
                          onClick={() => handleVote(entry.id)}
                          disabled={voting}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                            isMyVote
                              ? "bg-[#c9a84c] text-black shadow-[0_0_10px_rgba(201,168,76,0.3)]"
                              : "bg-background-elevated border border-border hover:border-[#c9a84c]/50 hover:bg-[#c9a84c]/5 text-foreground-muted"
                          }`}
                        >
                          {isMyVote ? "Voted ✓" : "Vote"}
                        </button>
                      ) : (
                        <span className="text-lg font-bold text-[#c9a84c] flex-shrink-0">
                          {entry.voteCount}
                        </span>
                      )}
                    </div>

                    {/* Author */}
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar
                        src={entry.author.avatarUrl}
                        alt={entry.author.displayName || entry.author.username}
                        size="xs"
                        isChampion={entry.author.isChampion}
                      />
                      <span className="text-xs text-foreground-muted">
                        {entry.author.displayName || entry.author.username}
                      </span>
                      {entry.country && (
                        <span className="text-xs text-foreground-subtle">
                          {entry.country.flagEmoji}
                        </span>
                      )}
                    </div>

                    {/* Vote bar */}
                    {(isCompleted || isJudging) && totalVotes > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-background-overlay rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              isWinner ? "bg-gradient-to-r from-[#c9a84c] to-[#FFD700]" : "bg-foreground-subtle/30"
                            }`}
                            style={{ width: `${(entry.voteCount / maxVotes) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-foreground-subtle w-8 text-right">
                          {votePercent}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
