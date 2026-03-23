"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslation } from "@/i18n";
import MainLayout from "@/components/layout/MainLayout";

interface TournamentPost {
  id: string;
  title: string;
  imageUrl: string;
  imageCount?: number;
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

type ViewTab = "vote" | "bracket";

const ROUND_EMOJI = ["", "8️⃣", "4️⃣", "🏆"];
const ROUND_LABEL_KEYS = ["", "tournament.roundOf8", "tournament.semiFinals", "tournament.grandFinal"] as const;
const ROUND_KEYS = ["", "tournament.quarterfinals", "tournament.semifinals", "tournament.final"] as const;

// ---------------------------------------------------------------------------
// Countdown Timer
// ---------------------------------------------------------------------------
function CountdownTimer({ targetDate }: { targetDate: string }) {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function update() {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft(t("tournament.started")); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    }
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [targetDate, t]);

  if (!timeLeft) return null;
  return (
    <span className="text-[10px] text-foreground-subtle bg-background-elevated px-2 py-0.5 rounded-full">
      {timeLeft === t("tournament.started") ? t("tournament.liveNow") : t("tournament.startsIn", { time: timeLeft })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function TournamentPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const [seasonName, setSeasonName] = useState("");
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("vote");
  const [currentVoteIdx, setCurrentVoteIdx] = useState(0);

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

  useEffect(() => { fetchData(); }, [fetchData]);

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

  // Group matches by round
  const rounds = [1, 2, 3].map((round) => {
    const roundMatches = matches.filter((m) => m.round === round);
    let date = "";
    if (roundMatches.length > 0 && roundMatches[0].startAt) {
      date = new Date(roundMatches[0].startAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return { round, name: t(ROUND_KEYS[round] as any), emoji: ROUND_EMOJI[round], date, label: t(ROUND_LABEL_KEYS[round] as any), matches: roundMatches };
  });

  // Votable matches (active first, then pending)
  const activeMatches = matches.filter((m) => m.isActive);
  const pendingMatches = matches.filter((m) => !m.isCompleted && !m.isActive);
  const votableMatches = [...activeMatches, ...pendingMatches];

  // Champion
  const finalMatch = matches.find((m) => m.round === 3 && m.winnerId);
  const champion = finalMatch
    ? finalMatch.winnerId === finalMatch.post1.id ? finalMatch.post1 : finalMatch.post2
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
          <p className="text-sm text-foreground-subtle">{t("tournament.subtitle")}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showSidebar={false}>
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Champion Banner */}
        {champion && (
          <div className="mb-8 relative">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />
            <div className="py-8 px-6 bg-gradient-to-b from-[#c9a84c]/15 via-[#FFD700]/5 to-[#c9a84c]/15 border border-[#c9a84c]/30 rounded-2xl text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#c9a84c]/5 to-transparent animate-pulse" />
              <div className="relative">
                <div className="text-5xl mb-3">👑</div>
                <div className="inline-block px-6 py-1.5 bg-[#c9a84c]/20 border border-[#c9a84c]/40 rounded-full mb-4">
                  <h2 className="text-sm font-black uppercase tracking-widest text-[#c9a84c]">{t("tournament.memeOfTheYear")}</h2>
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
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">🏆 {seasonName} — {t("tournament.title")}</h1>
          <p className="text-sm text-foreground-subtle">{t("tournament.subtitle")}</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center gap-1 mb-6 bg-background-elevated p-1 rounded-xl w-fit mx-auto">
          <button
            onClick={() => setActiveTab("vote")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "vote"
                ? "bg-[#c9a84c] text-black shadow-sm"
                : "text-foreground-subtle hover:text-foreground"
            }`}
          >
            ⚔️ Vote
          </button>
          <button
            onClick={() => setActiveTab("bracket")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === "bracket"
                ? "bg-[#c9a84c] text-black shadow-sm"
                : "text-foreground-subtle hover:text-foreground"
            }`}
          >
            🏆 Bracket
          </button>
        </div>

        {/* Vote View */}
        {activeTab === "vote" && (
          <VoteView
            matches={matches}
            votableMatches={votableMatches}
            currentVoteIdx={currentVoteIdx}
            setCurrentVoteIdx={setCurrentVoteIdx}
            userVotes={userVotes}
            handleVote={handleVote}
            voting={voting}
            isLoggedIn={!!session}
            t={t}
          />
        )}

        {/* Bracket View */}
        {activeTab === "bracket" && (
          <BracketView
            rounds={rounds}
            matches={matches}
            userVotes={userVotes}
            handleVote={handleVote}
            voting={voting}
            isLoggedIn={!!session}
            t={t}
          />
        )}
      </div>
    </MainLayout>
  );
}

// =============================================================================
// Vote View — One match at a time, battle-card style
// =============================================================================
function VoteView({
  matches,
  votableMatches,
  currentVoteIdx,
  setCurrentVoteIdx,
  userVotes,
  handleVote,
  voting,
  isLoggedIn,
  t,
}: {
  matches: Match[];
  votableMatches: Match[];
  currentVoteIdx: number;
  setCurrentVoteIdx: (n: number) => void;
  userVotes: Record<string, string>;
  handleVote: (matchId: string, postId: string) => void;
  voting: string | null;
  isLoggedIn: boolean;
  t: (key: any, opts?: any) => string;
}) {
  if (votableMatches.length === 0) {
    const completedCount = matches.filter((m) => m.isCompleted).length;
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-foreground font-medium mb-1">All matches voted!</p>
        <p className="text-sm text-foreground-subtle">
          {completedCount}/{matches.length} matches completed
        </p>
        <p className="text-xs text-foreground-subtle mt-2">Switch to Bracket view to see the full picture</p>
      </div>
    );
  }

  const safeIdx = Math.min(currentVoteIdx, votableMatches.length - 1);
  const match = votableMatches[safeIdx];
  const totalVotes = match.post1Votes + match.post2Votes;
  const p1Pct = totalVotes > 0 ? Math.round((match.post1Votes / totalVotes) * 100) : 50;
  const p2Pct = 100 - p1Pct;
  const myVote = userVotes[match.id];
  const roundLabel = ROUND_LABEL_KEYS[match.round] ? t(ROUND_LABEL_KEYS[match.round] as any) : "";

  return (
    <div className="max-w-lg mx-auto">
      {/* Match header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{ROUND_EMOJI[match.round]}</span>
          <span className="text-sm font-bold text-foreground">{roundLabel}</span>
          {match.isActive && (
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-semibold animate-pulse">LIVE</span>
          )}
          {!match.isActive && !match.isCompleted && match.startAt && (
            <CountdownTimer targetDate={match.startAt} />
          )}
        </div>
        <span className="text-xs text-foreground-subtle">
          {safeIdx + 1} / {votableMatches.length}
        </span>
      </div>

      {/* Battle Card */}
      <div className={`bg-background-surface border rounded-2xl overflow-hidden ${
        match.isActive ? "border-[#c9a84c]/50 shadow-[0_0_20px_rgba(201,168,76,0.15)]" : "border-border"
      }`}>
        <div className="flex items-stretch">
          {/* Post 1 */}
          <VoteSide
            post={match.post1}
            isWinner={match.winnerId === match.post1.id}
            isLoser={!!match.winnerId && match.winnerId !== match.post1.id}
            isMyVote={myVote === match.post1.id}
            percent={p1Pct}
            showPercent={!!myVote || match.isCompleted}
            canVote={match.isActive && isLoggedIn && !voting}
            onVote={() => handleVote(match.id, match.post1.id)}
          />

          {/* VS */}
          <div className="flex flex-col items-center justify-center px-3 bg-background-elevated relative">
            <div className="absolute inset-y-0 left-0 w-px bg-border" />
            <div className="absolute inset-y-0 right-0 w-px bg-border" />
            <div className="w-10 h-10 rounded-full bg-[#c9a84c]/15 flex items-center justify-center">
              <span className="text-xs font-black text-[#c9a84c]">VS</span>
            </div>
          </div>

          {/* Post 2 */}
          <VoteSide
            post={match.post2}
            isWinner={match.winnerId === match.post2.id}
            isLoser={!!match.winnerId && match.winnerId !== match.post2.id}
            isMyVote={myVote === match.post2.id}
            percent={p2Pct}
            showPercent={!!myVote || match.isCompleted}
            canVote={match.isActive && isLoggedIn && !voting}
            onVote={() => handleVote(match.id, match.post2.id)}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => setCurrentVoteIdx(Math.max(0, safeIdx - 1))}
          disabled={safeIdx === 0}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-background-elevated text-foreground-subtle hover:text-foreground disabled:opacity-30 transition-all"
        >
          ← Prev
        </button>
        <div className="flex gap-1">
          {votableMatches.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentVoteIdx(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === safeIdx ? "bg-[#c9a84c] w-4" : "bg-border hover:bg-foreground-subtle"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentVoteIdx(Math.min(votableMatches.length - 1, safeIdx + 1))}
          disabled={safeIdx === votableMatches.length - 1}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-background-elevated text-foreground-subtle hover:text-foreground disabled:opacity-30 transition-all"
        >
          Next →
        </button>
      </div>

      {/* Progress */}
      <div className="mt-4 text-center">
        <span className="text-[10px] text-foreground-subtle">
          🗳️ {Object.keys(userVotes).length}/{matches.length} matches voted
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VoteSide — one side of a tournament battle card (vote view)
// ---------------------------------------------------------------------------
function VoteSide({
  post,
  isWinner,
  isLoser,
  isMyVote,
  percent,
  showPercent,
  canVote,
  onVote,
}: {
  post: TournamentPost;
  isWinner: boolean;
  isLoser: boolean;
  isMyVote: boolean;
  percent: number;
  showPercent: boolean;
  canVote: boolean;
  onVote: () => void;
}) {
  return (
    <button
      onClick={onVote}
      disabled={!canVote}
      className={`flex-1 p-3 transition-all duration-300 ${
        isWinner ? "bg-[#c9a84c]/10" : isLoser ? "opacity-40" : isMyVote ? "bg-[#c9a84c]/5" : canVote ? "hover:bg-background-elevated" : ""
      }`}
    >
      {/* Image */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-2 border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
        {(post.imageCount ?? 0) > 1 && (
          <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            📸 {post.imageCount}
          </span>
        )}
        {isWinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#c9a84c]/20 backdrop-blur-[1px]">
            <div className="text-center">
              <div className="text-3xl drop-shadow-lg">👑</div>
              <span className="text-[10px] font-bold text-[#c9a84c] bg-black/70 px-2 py-0.5 rounded-full">WINNER</span>
            </div>
          </div>
        )}
        {isMyVote && !isWinner && (
          <div className="absolute top-1.5 left-1.5 bg-[#c9a84c] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-md">
            ✓ Your vote
          </div>
        )}
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-foreground truncate mb-0.5">{post.title}</p>

      {/* Author */}
      <div className="flex items-center gap-1 mb-1">
        {post.country && <span className="text-[11px]">{post.country.flagEmoji}</span>}
        <span className="text-[11px] text-foreground-muted truncate">
          {post.author.displayName || post.author.username}
        </span>
      </div>

      {/* Vote bar */}
      {showPercent && (
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex-1 h-1.5 bg-background-overlay rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-[#c9a84c]" : "bg-foreground-subtle/30"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[10px] text-foreground-subtle font-medium">{percent}%</span>
        </div>
      )}
    </button>
  );
}

// =============================================================================
// Bracket View — Full bracket tree (horizontal columns)
// =============================================================================
function BracketView({
  rounds,
  matches: _matches,
  userVotes,
  handleVote,
  voting,
  isLoggedIn,
  t,
}: {
  rounds: { round: number; name: string; emoji: string; date: string; label: string; matches: Match[] }[];
  matches: Match[];
  userVotes: Record<string, string>;
  handleVote: (matchId: string, postId: string) => void;
  voting: string | null;
  isLoggedIn: boolean;
  t: (key: any, opts?: any) => string;
}) {
  return (
    <div>
      {/* Mobile scroll hint */}
      <div className="flex items-center justify-center gap-2 mb-2 sm:hidden">
        <span className="text-[10px] text-foreground-subtle">← Scroll to see full bracket →</span>
      </div>

      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-6 min-w-[720px] items-start">
          {rounds.map(({ round, name, emoji, date, label, matches: roundMatches }) => {
            // Vertical spacing grows with each round to align with previous round's pairs
            const matchPadding = round === 2 ? "pt-[3.25rem]" : round === 3 ? "pt-[8.5rem]" : "";
            const matchGap = round === 1 ? "gap-3" : round === 2 ? "gap-[6.75rem]" : "";

            return (
              <div key={round} className="flex-1 min-w-[210px]">
                {/* Round header */}
                <div className={`flex items-center gap-2 mb-1 ${round === 3 ? "text-[#c9a84c]" : ""}`}>
                  <span className="text-sm">{emoji}</span>
                  <span className={`text-xs font-bold ${round === 3 ? "text-[#c9a84c]" : "text-foreground"}`}>{name}</span>
                  <span className="text-[10px] text-foreground-subtle">{label}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {date && <span className="text-[10px] text-foreground-subtle">{date}</span>}
                  {roundMatches.some((m) => m.isActive) && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold animate-pulse">LIVE</span>
                  )}
                </div>

                {/* Matches */}
                <div className={`flex flex-col ${matchGap} ${matchPadding}`}>
                  {roundMatches.length > 0 ? (
                    roundMatches.map((match) => (
                      <BracketMatchCard
                        key={match.id}
                        match={match}
                        myVote={userVotes[match.id]}
                        onVote={handleVote}
                        voting={voting === match.id}
                        isLoggedIn={isLoggedIn}
                        isGrandFinal={round === 3}
                      />
                    ))
                  ) : (
                    <div className="border border-border border-dashed rounded-xl p-6 text-center opacity-50">
                      <p className="text-[10px] text-foreground-subtle">
                        {t("tournament.waitingFor", { round: t(ROUND_KEYS[round - 1] as any) })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BracketMatchCard — compact card for bracket view
// ---------------------------------------------------------------------------
function BracketMatchCard({
  match,
  myVote,
  onVote,
  voting,
  isLoggedIn,
  isGrandFinal,
}: {
  match: Match;
  myVote?: string;
  onVote: (matchId: string, postId: string) => void;
  voting: boolean;
  isLoggedIn: boolean;
  isGrandFinal: boolean;
}) {
  const totalVotes = match.post1Votes + match.post2Votes;
  const p1Pct = totalVotes > 0 ? Math.round((match.post1Votes / totalVotes) * 100) : 50;
  const p2Pct = 100 - p1Pct;

  return (
    <div className={`bg-background-surface border rounded-xl overflow-hidden ${
      isGrandFinal
        ? "border-[#c9a84c]/50 shadow-[0_0_15px_rgba(201,168,76,0.15)]"
        : match.isActive
        ? "border-[#c9a84c]/30"
        : "border-border"
    }`}>
      {/* Post 1 */}
      <BracketPostRow
        post={match.post1}
        isWinner={match.winnerId === match.post1.id}
        isLoser={!!match.winnerId && match.winnerId !== match.post1.id}
        isMyVote={myVote === match.post1.id}
        percent={p1Pct}
        showPercent={!!myVote || match.isCompleted}
        canVote={match.isActive && isLoggedIn && !voting}
        onClick={() => onVote(match.id, match.post1.id)}
      />

      {/* Divider */}
      <div className="h-px bg-border relative">
        <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-black text-foreground-subtle bg-background-surface px-1.5 py-0.5 rounded">
          VS
        </span>
      </div>

      {/* Post 2 */}
      <BracketPostRow
        post={match.post2}
        isWinner={match.winnerId === match.post2.id}
        isLoser={!!match.winnerId && match.winnerId !== match.post2.id}
        isMyVote={myVote === match.post2.id}
        percent={p2Pct}
        showPercent={!!myVote || match.isCompleted}
        canVote={match.isActive && isLoggedIn && !voting}
        onClick={() => onVote(match.id, match.post2.id)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BracketPostRow — single post row in bracket card
// ---------------------------------------------------------------------------
function BracketPostRow({
  post,
  isWinner,
  isLoser,
  isMyVote,
  percent,
  showPercent,
  canVote,
  onClick,
}: {
  post: TournamentPost | null;
  isWinner: boolean;
  isLoser: boolean;
  isMyVote: boolean;
  percent: number;
  showPercent: boolean;
  canVote: boolean;
  onClick: () => void;
}) {
  if (!post) {
    return (
      <div className="flex items-center gap-2.5 p-2.5 opacity-40">
        <div className="w-10 h-10 rounded-lg bg-background-elevated border border-dashed border-border flex items-center justify-center">
          <span className="text-[10px] text-foreground-subtle">?</span>
        </div>
        <span className="text-[10px] text-foreground-subtle italic">TBD</span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={!canVote}
      className={`w-full flex items-center gap-2.5 p-2.5 transition-all ${
        isWinner ? "bg-[#c9a84c]/10" : isLoser ? "opacity-40" : isMyVote ? "bg-[#c9a84c]/5" : canVote ? "hover:bg-background-elevated" : ""
      }`}
    >
      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
        {(post.imageCount ?? 0) > 1 && (
          <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[7px] font-bold px-1 rounded-tl">
            {post.imageCount}
          </span>
        )}
        {isWinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#c9a84c]/30">
            <span className="text-sm">👑</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1">
          {post.country && <span className="text-[10px]">{post.country.flagEmoji}</span>}
          <span className="text-[11px] font-medium text-foreground truncate">{post.title}</span>
        </div>
        <span className="text-[10px] text-foreground-muted truncate block">
          {post.author.displayName || post.author.username}
        </span>
      </div>

      {/* Vote percent */}
      {showPercent && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-12 h-1 bg-background-overlay rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${isWinner ? "bg-[#c9a84c]" : "bg-foreground-subtle/30"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[10px] text-foreground-subtle w-7 text-right">{percent}%</span>
        </div>
      )}

      {/* My vote indicator */}
      {isMyVote && !isWinner && (
        <span className="text-[9px] text-[#c9a84c] font-bold flex-shrink-0">✓</span>
      )}
    </button>
  );
}
