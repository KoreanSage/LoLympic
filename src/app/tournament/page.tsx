"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";

interface TournamentPost {
  id: string;
  title: string;
  imageUrl: string;
  reactionCount: number;
  author: { username: string; displayName: string | null; avatarUrl: string | null };
  country: { id: string; flagEmoji: string; nameEn: string } | null;
}

interface Match {
  id: string;
  round: number;
  matchIndex: number;
  post1: TournamentPost;
  post2: TournamentPost;
  post1Votes: number;
  post2Votes: number;
  winnerId: string | null;
  startAt: string;
  endAt: string;
  isActive: boolean;
  isCompleted: boolean;
}

const ROUND_EMOJI = ["", "8\uFE0F\u20E3", "4\uFE0F\u20E3", "\uD83C\uDFC6"];
const ROUND_LABEL_KEYS = ["", "tournament.roundOf8", "tournament.semiFinals", "tournament.grandFinal"] as const;

const ROUND_KEYS = ["", "tournament.quarterfinals", "tournament.semifinals", "tournament.final"] as const;

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft(t("tournament.started"));
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m`);
      } else {
        setTimeLeft(`${mins}m`);
      }
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <span className="text-[10px] text-foreground-subtle bg-background-elevated px-2 py-0.5 rounded-full">
      {timeLeft === t("tournament.started") ? t("tournament.liveNow") : t("tournament.startsIn", { time: timeLeft })}
    </span>
  );
}

export default function TournamentPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [seasonName, setSeasonName] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/tournament");
      const data = await res.json();
      setMatches(data.matches || []);
      setUserVotes(data.userVotes || {});
      setSeasonName(data.season?.name || "");
    } catch (e) {
      console.error("Failed to fetch tournament data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVote = async (matchId: string, postId: string) => {
    if (!session || voting) return;
    setVoting(matchId);

    try {
      const res = await fetch("/api/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", matchId, postId }),
      });

      if (res.ok) {
        setUserVotes((prev) => ({ ...prev, [matchId]: postId }));
        await fetchData();
      }
    } catch (e) {
      console.error("Failed to submit tournament vote:", e);
    } finally {
      setVoting(null);
    }
  };

  // Group matches by round, deriving dates from match data
  const rounds = [1, 2, 3].map((round) => {
    const roundMatches = matches.filter((m) => m.round === round);
    // Derive the display date from the first match's startAt
    let date = "";
    if (roundMatches.length > 0 && roundMatches[0].startAt) {
      const d = new Date(roundMatches[0].startAt);
      date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return {
      round,
      name: t(ROUND_KEYS[round] as any),
      emoji: ROUND_EMOJI[round],
      date,
      label: t(ROUND_LABEL_KEYS[round] as any),
      matches: roundMatches,
    };
  });

  // Find champion
  const finalMatch = matches.find((m) => m.round === 3 && m.winnerId);
  const champion = finalMatch
    ? finalMatch.winnerId === finalMatch.post1.id
      ? finalMatch.post1
      : finalMatch.post2
    : null;

  if (loading) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-4xl mx-auto py-8 px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-background-elevated rounded w-64 mx-auto" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 bg-background-elevated rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (matches.length === 0) {
    return (
      <MainLayout showSidebar={false}>
        <div className="max-w-4xl mx-auto py-16 px-4 text-center">
          <p className="text-5xl mb-4">🏆</p>
          <h1 className="text-2xl font-bold text-foreground mb-2">🏆 {t("tournament.title")}</h1>
          <p className="text-sm text-foreground-subtle">
            {t("tournament.subtitle")}
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Champion Banner */}
        {champion && (
          <div className="mb-10 relative">
            {/* Decorative gold lines */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

            <div className="py-8 px-6 bg-gradient-to-b from-[#c9a84c]/15 via-[#FFD700]/5 to-[#c9a84c]/15 border border-[#c9a84c]/30 rounded-2xl text-center relative overflow-hidden">
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c9a84c]/5 to-transparent animate-pulse" />

              <div className="relative">
                <div className="text-5xl mb-3">👑</div>
                <div className="inline-block px-6 py-1.5 bg-[#c9a84c]/20 border border-[#c9a84c]/40 rounded-full mb-4">
                  <h2 className="text-sm font-black uppercase tracking-widest text-[#c9a84c]">
                    {t("tournament.memeOfTheYear")}
                  </h2>
                </div>
                <div className="w-52 mx-auto rounded-xl overflow-hidden border-2 border-[#c9a84c] shadow-[0_0_30px_rgba(201,168,76,0.3)] mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={champion.imageUrl} alt={champion.title} className="w-full aspect-square object-cover" />
                </div>
                <p className="text-base font-bold text-foreground">{champion.title}</p>
                <p className="text-sm text-foreground-muted mt-1">
                  {champion.country?.flagEmoji} {champion.author.displayName || champion.author.username}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            🏆 {seasonName} — {t("tournament.title")}
          </h1>
          <p className="text-sm text-foreground-subtle">
            {t("tournament.subtitle")}
          </p>
        </div>

        {/* Scroll hint for mobile */}
        <div className="flex items-center justify-center gap-2 mb-2 sm:hidden">
          <span className="text-[10px] text-foreground-subtle">← Scroll to see full bracket →</span>
        </div>

        {/* Bracket with connector lines */}
        <div className="space-y-2 overflow-x-auto pb-4 -mx-4 px-4">
          {rounds.map(({ round, name, emoji, date, label, matches: roundMatches }, roundIdx) => {
            const prevRound = rounds[roundIdx - 1];
            const hasConnector = roundIdx > 0 && prevRound?.matches.length > 0;

            if (roundMatches.length === 0) {
              // Show placeholder for upcoming rounds
              if (!prevRound?.matches.length) return null;

              return (
                <div key={round}>
                  {/* Bracket connector */}
                  {hasConnector && (
                    <div className="flex justify-center py-2">
                      <div className="flex flex-col items-center">
                        <div className="w-px h-4 bg-border" />
                        <div className="w-3 h-3 rounded-full border-2 border-border bg-background-surface" />
                        <div className="w-px h-4 bg-border" />
                      </div>
                    </div>
                  )}

                  <div className="opacity-50">
                    {/* Round header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2 bg-background-elevated px-4 py-2 rounded-full">
                        <span className="text-base">{emoji}</span>
                        <div>
                          <span className="text-sm font-bold text-foreground">{name}</span>
                          <span className="text-xs text-foreground-subtle ml-2">{label}</span>
                        </div>
                      </div>
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-foreground-subtle">{date}</span>
                    </div>

                    <div className="border border-border border-dashed rounded-xl p-8 text-center">
                      <p className="text-sm text-foreground-subtle">
                        {t("tournament.waitingFor", { round: t(ROUND_KEYS[round - 1] as any) })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={round}>
                {/* Bracket connector lines */}
                {hasConnector && (
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-[#c9a84c]/40" />
                      <div className="w-3 h-3 rounded-full border-2 border-[#c9a84c]/50 bg-[#c9a84c]/10" />
                      <div className="w-px h-4 bg-[#c9a84c]/40" />
                    </div>
                  </div>
                )}

                {/* Round header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                    round === 3
                      ? "bg-[#c9a84c]/15 border border-[#c9a84c]/30"
                      : "bg-background-elevated"
                  }`}>
                    <span className="text-base">{emoji}</span>
                    <div>
                      <span className={`text-sm font-bold ${round === 3 ? "text-[#c9a84c]" : "text-foreground"}`}>
                        {name}
                      </span>
                      <span className="text-xs text-foreground-subtle ml-2">{label}</span>
                    </div>
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground-subtle">{date}</span>
                    {roundMatches.some((m) => m.isActive) && (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                        {t("tournament.live")}
                      </span>
                    )}
                    {roundMatches.every((m) => !m.isActive && !m.isCompleted) && roundMatches[0] && (
                      <CountdownTimer targetDate={roundMatches[0].startAt} />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {roundMatches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      myVote={userVotes[match.id]}
                      onVote={handleVote}
                      voting={voting === match.id}
                      isLoggedIn={!!session}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}

function PostSide({
  post,
  match,
  side,
  myVote,
  onVote,
  voting,
  isLoggedIn,
  percent,
}: {
  post: TournamentPost | null;
  match: Match;
  side: "post1" | "post2";
  myVote?: string;
  onVote: (matchId: string, postId: string) => void;
  voting: boolean;
  isLoggedIn: boolean;
  percent: number;
}) {
  if (!post) {
    return (
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-lg bg-background-elevated border border-border border-dashed mx-auto mb-2 flex items-center justify-center">
            <span className="text-foreground-subtle text-xs">?</span>
          </div>
          <span className="text-xs text-foreground-subtle italic">TBD</span>
        </div>
      </div>
    );
  }

  const isWinner = match.winnerId === post.id;
  const otherSide = side === "post1" ? "post2" : "post1";
  const otherWon = match.winnerId === match[otherSide].id;
  const isMyVote = myVote === post.id;

  return (
    <button
      onClick={() => match.isActive && isLoggedIn && onVote(match.id, post.id)}
      disabled={!match.isActive || voting || !isLoggedIn}
      className={`flex-1 min-w-[140px] p-3 transition-all ${
        isWinner
          ? "bg-[#c9a84c]/10"
          : otherWon
          ? "opacity-40"
          : isMyVote
          ? "bg-[#c9a84c]/5"
          : match.isActive ? "hover:bg-background-elevated" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.imageUrl}
          alt={post.title}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-1 mb-0.5">
            {post.country && (
              <span className="text-xs">{post.country.flagEmoji}</span>
            )}
            <span className="text-xs text-foreground-muted truncate">
              {post.author.displayName || post.author.username}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
          {(match.isCompleted || myVote) && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-background-overlay rounded-full overflow-hidden w-20">
                <div
                  className={`h-full rounded-full ${isWinner ? "bg-[#c9a84c]" : "bg-foreground-subtle/30"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[10px] text-foreground-subtle">{percent}%</span>
            </div>
          )}
        </div>
      </div>
      {isWinner && (
        <div className="mt-1 text-center">
          <span className="text-xs font-bold text-[#c9a84c]">👑 Winner</span>
        </div>
      )}
      {isMyVote && !match.isCompleted && (
        <div className="mt-1 text-center">
          <span className="text-[10px] text-[#c9a84c]">Your vote ✓</span>
        </div>
      )}
    </button>
  );
}

function MatchCard({
  match,
  myVote,
  onVote,
  voting,
  isLoggedIn,
}: {
  match: Match;
  myVote?: string;
  onVote: (matchId: string, postId: string) => void;
  voting: boolean;
  isLoggedIn: boolean;
}) {
  const totalVotes = match.post1Votes + match.post2Votes;
  const p1Percent = totalVotes > 0 ? Math.round((match.post1Votes / totalVotes) * 100) : 50;
  const p2Percent = 100 - p1Percent;

  return (
    <div className={`bg-background-surface border rounded-xl overflow-hidden min-w-[340px] ${
      match.isActive ? "border-[#c9a84c]/50 shadow-[0_0_12px_rgba(201,168,76,0.1)]" : "border-border"
    }`}>
      <div className="flex items-stretch overflow-x-auto">
        {/* Post 1 */}
        <PostSide
          post={match.post1}
          match={match}
          side="post1"
          myVote={myVote}
          onVote={onVote}
          voting={voting}
          isLoggedIn={isLoggedIn}
          percent={p1Percent}
        />

        {/* VS divider */}
        <div className="flex items-center px-2 bg-background-elevated relative">
          <div className="absolute inset-y-0 left-0 w-px bg-border" />
          <div className="absolute inset-y-0 right-0 w-px bg-border" />
          <span className="text-[10px] font-black text-foreground-subtle">VS</span>
        </div>

        {/* Post 2 */}
        <PostSide
          post={match.post2}
          match={match}
          side="post2"
          myVote={myVote}
          onVote={onVote}
          voting={voting}
          isLoggedIn={isLoggedIn}
          percent={p2Percent}
        />
      </div>
    </div>
  );
}
