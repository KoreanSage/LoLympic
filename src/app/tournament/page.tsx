"use client";

import { useEffect, useState } from "react";
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
const ROUND_DATES = ["", "Dec 29", "Dec 30", "Dec 31"];

const ROUND_KEYS = ["", "tournament.quarterfinals", "tournament.semifinals", "tournament.final"] as const;

export default function TournamentPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [seasonName, setSeasonName] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/tournament");
      const data = await res.json();
      setMatches(data.matches || []);
      setUserVotes(data.userVotes || {});
      setSeasonName(data.season?.name || "");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    } catch {
      // ignore
    } finally {
      setVoting(null);
    }
  };

  // Group matches by round
  const rounds = [1, 2, 3].map((round) => ({
    round,
    name: t(ROUND_KEYS[round] as any),
    emoji: ROUND_EMOJI[round],
    date: ROUND_DATES[round],
    matches: matches.filter((m) => m.round === round),
  }));

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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            🏆 {seasonName} — {t("tournament.title")}
          </h1>
          <p className="text-sm text-foreground-subtle">
            {t("tournament.subtitle")}
          </p>
        </div>

        {/* Champion banner */}
        {champion && (
          <div className="mb-8 p-6 bg-gradient-to-r from-[#c9a84c]/20 via-[#FFD700]/10 to-[#c9a84c]/20 border border-[#c9a84c]/30 rounded-2xl text-center">
            <div className="text-4xl mb-2">👑</div>
            <h2 className="text-lg font-bold text-[#c9a84c] mb-3">{t("tournament.memeOfTheYear")}</h2>
            <div className="w-48 mx-auto rounded-xl overflow-hidden border-2 border-[#c9a84c] mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={champion.imageUrl} alt={champion.title} className="w-full aspect-square object-cover" />
            </div>
            <p className="text-sm font-medium text-foreground">{champion.title}</p>
            <p className="text-xs text-foreground-muted mt-1">
              {champion.country?.flagEmoji} {champion.author.displayName || champion.author.username}
            </p>
          </div>
        )}

        {/* Rounds */}
        <div className="space-y-8">
          {rounds.map(({ round, name, emoji, date, matches: roundMatches }) => {
            if (roundMatches.length === 0) {
              // Show placeholder for upcoming rounds
              const prevRound = rounds.find((r) => r.round === round - 1);
              if (!prevRound?.matches.length) return null;

              return (
                <div key={round} className="opacity-40">
                  <h2 className="text-sm font-bold text-foreground-subtle mb-3 flex items-center gap-2">
                    <span>{emoji}</span> {name}
                    <span className="text-xs font-normal text-foreground-subtle">({date})</span>
                  </h2>
                  <div className="border border-border border-dashed rounded-xl p-8 text-center">
                    <p className="text-sm text-foreground-subtle">
                      {t("tournament.waitingFor", { round: t(ROUND_KEYS[round - 1] as any) })}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={round}>
                <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <span>{emoji}</span> {name}
                  <span className="text-xs font-normal text-foreground-subtle">({date})</span>
                  {roundMatches.some((m) => m.isActive) && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                      {t("tournament.live")}
                    </span>
                  )}
                </h2>

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
    <div className={`bg-background-surface border rounded-xl overflow-hidden ${
      match.isActive ? "border-[#c9a84c]/50" : "border-border"
    }`}>
      <div className="flex items-stretch">
        {/* Post 1 */}
        <button
          onClick={() => match.isActive && isLoggedIn && onVote(match.id, match.post1.id)}
          disabled={!match.isActive || voting || !isLoggedIn}
          className={`flex-1 p-3 transition-all ${
            match.winnerId === match.post1.id
              ? "bg-[#c9a84c]/10"
              : match.winnerId === match.post2.id
              ? "opacity-40"
              : myVote === match.post1.id
              ? "bg-[#c9a84c]/5"
              : match.isActive ? "hover:bg-background-elevated" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={match.post1.imageUrl}
              alt={match.post1.title}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1 mb-0.5">
                {match.post1.country && (
                  <span className="text-xs">{match.post1.country.flagEmoji}</span>
                )}
                <span className="text-xs text-foreground-muted truncate">
                  {match.post1.author.displayName || match.post1.author.username}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">{match.post1.title}</p>
              {(match.isCompleted || myVote) && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-background-overlay rounded-full overflow-hidden w-20">
                    <div
                      className={`h-full rounded-full ${match.winnerId === match.post1.id ? "bg-[#c9a84c]" : "bg-foreground-subtle/30"}`}
                      style={{ width: `${p1Percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-foreground-subtle">{p1Percent}%</span>
                </div>
              )}
            </div>
          </div>
          {match.winnerId === match.post1.id && (
            <div className="mt-1 text-center">
              <span className="text-xs font-bold text-[#c9a84c]">👑 Winner</span>
            </div>
          )}
          {myVote === match.post1.id && !match.isCompleted && (
            <div className="mt-1 text-center">
              <span className="text-[10px] text-[#c9a84c]">Your vote ✓</span>
            </div>
          )}
        </button>

        {/* VS */}
        <div className="flex items-center px-2 bg-background-elevated">
          <span className="text-[10px] font-black text-foreground-subtle">VS</span>
        </div>

        {/* Post 2 */}
        <button
          onClick={() => match.isActive && isLoggedIn && onVote(match.id, match.post2.id)}
          disabled={!match.isActive || voting || !isLoggedIn}
          className={`flex-1 p-3 transition-all ${
            match.winnerId === match.post2.id
              ? "bg-[#c9a84c]/10"
              : match.winnerId === match.post1.id
              ? "opacity-40"
              : myVote === match.post2.id
              ? "bg-[#c9a84c]/5"
              : match.isActive ? "hover:bg-background-elevated" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={match.post2.imageUrl}
              alt={match.post2.title}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            />
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1 mb-0.5">
                {match.post2.country && (
                  <span className="text-xs">{match.post2.country.flagEmoji}</span>
                )}
                <span className="text-xs text-foreground-muted truncate">
                  {match.post2.author.displayName || match.post2.author.username}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">{match.post2.title}</p>
              {(match.isCompleted || myVote) && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-background-overlay rounded-full overflow-hidden w-20">
                    <div
                      className={`h-full rounded-full ${match.winnerId === match.post2.id ? "bg-[#c9a84c]" : "bg-foreground-subtle/30"}`}
                      style={{ width: `${p2Percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-foreground-subtle">{p2Percent}%</span>
                </div>
              )}
            </div>
          </div>
          {match.winnerId === match.post2.id && (
            <div className="mt-1 text-center">
              <span className="text-xs font-bold text-[#c9a84c]">👑 Winner</span>
            </div>
          )}
          {myVote === match.post2.id && !match.isCompleted && (
            <div className="mt-1 text-center">
              <span className="text-[10px] text-[#c9a84c]">Your vote ✓</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
