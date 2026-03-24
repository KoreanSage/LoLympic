"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import { useTranslation } from "@/i18n";

interface BattlePost {
  id: string;
  title: string;
  imageUrl: string;
  imageCount?: number;
  reactionCount: number;
  battleWins: number;
  battleLosses: number;
  author: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  country?: {
    id: string;
    flagEmoji: string;
    nameEn: string;
  } | null;
}

interface BattleCardProps {
  onDismiss: () => void;
}

// Streak milestone translation keys (index = streak count)
const STREAK_KEYS = [
  "", // 0
  "", // 1
  "battle.streak.nicePick",
  "battle.streak.onARoll",
  "battle.streak.hatTrick",
  "battle.streak.unstoppable",
  "battle.streak.domination",
  "battle.streak.legendary",
] as const;

// Streak emojis paired with each milestone
const STREAK_EMOJIS = ["", "", "🎯", "🔥", "🎩", "⚡", "💀", "👑"];

function getStreakMessage(streak: number, t: (key: any) => string): string {
  if (streak >= STREAK_KEYS.length) return `${t("battle.streak.godMode")} 🌟`;
  const key = STREAK_KEYS[streak];
  if (!key) return "";
  return `${t(key)} ${STREAK_EMOJIS[streak] || ""}`;
}

function BattleCardInner({ onDismiss }: BattleCardProps) {
  const { t } = useTranslation();
  const [left, setLeft] = useState<BattlePost | null>(null);
  const [right, setRight] = useState<BattlePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<"left" | "right" | null>(null);
  const [animating, setAnimating] = useState(false);
  const [noBattle, setNoBattle] = useState(false);

  // Engagement state
  const [winStreak, setWinStreak] = useState(0);
  const [streakSide, setStreakSide] = useState<"left" | "right" | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [showStreakFlash, setShowStreakFlash] = useState(false);
  const [challengerEntering, setChallengerEntering] = useState<"left" | "right" | null>(null);
  const [minimized, setMinimized] = useState(false);

  // Pre-fetched next battle for instant transition
  const nextBattleRef = useRef<{ left: BattlePost; right: BattlePost } | null>(null);

  const fetchBattle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/battle");
      const data = await res.json();
      if (data.noBattle) {
        setNoBattle(true);
        return;
      }
      setLeft(data.left);
      setRight(data.right);
    } catch (e) {
      console.error("Failed to fetch battle:", e);
      setNoBattle(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBattle();
  }, [fetchBattle]);

  const handleVote = useCallback(
    async (side: "left" | "right") => {
      if (!left || !right || voted || animating) return;
      setVoted(side);
      setAnimating(true);
      setTotalVotes((prev) => prev + 1);

      const chosenPostId = side === "left" ? left.id : right.id;
      const loserSide = side === "left" ? "right" : "left";

      try {
        const res = await fetch("/api/battle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leftPostId: left.id,
            rightPostId: right.id,
            chosenPostId,
          }),
        });
        const data = await res.json();

        // Update streak
        const newStreak = streakSide === side ? winStreak + 1 : 1;
        setStreakSide(side);
        setWinStreak(newStreak);

        // Flash effect for streaks ≥ 3
        if (newStreak >= 3) {
          setShowStreakFlash(true);
          setTimeout(() => setShowStreakFlash(false), 600);
        }

        // Store next battle data
        nextBattleRef.current = data.nextBattle || null;

        // Phase 1: Show winner result (800ms)
        // Phase 2: Slide out loser (300ms)
        // Phase 3: Slide in new challenger (300ms)
        setTimeout(() => {
          if (data.nextBattle) {
            const winner = side === "left" ? left : right;
            const updatedWinner = {
              ...winner,
              battleWins: winner.battleWins + 1,
              reactionCount: winner.reactionCount + 5,
            };

            // Start challenger exit animation
            setChallengerEntering(loserSide);

            setTimeout(() => {
              // Swap in new challenger
              const newChallenger =
                side === "left" ? data.nextBattle.right : data.nextBattle.left;

              if (side === "left") {
                setLeft(updatedWinner);
                setRight(newChallenger);
              } else {
                setRight(updatedWinner);
                setLeft(newChallenger);
              }

              // Phase 3: slide-in animation
              setTimeout(() => {
                setChallengerEntering(null);
                setVoted(null);
                setAnimating(false);
              }, 50);
            }, 250);
          } else {
            setNoBattle(true);
          }
        }, 900);
      } catch (e) {
        console.error("Failed to submit battle vote:", e);
        setVoted(null);
        setAnimating(false);
      }
    },
    [left, right, voted, animating, streakSide, winStreak]
  );

  if (noBattle) return null;

  // Minimized state — small "Resume Battle" bar
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="w-full py-3 px-4 bg-background-surface border border-[#c9a84c]/30 rounded-xl flex items-center justify-between hover:border-[#c9a84c]/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">⚔️</span>
          <span className="text-xs font-bold text-[#c9a84c]">
            {t("battle.title")}
          </span>
          {totalVotes > 0 && (
            <span className="text-[10px] text-foreground-subtle">
              {totalVotes} votes
            </span>
          )}
          {winStreak >= 2 && (
            <span className="text-[10px] text-[#c9a84c]">
              🔥 {winStreak} streak
            </span>
          )}
        </div>
        <span className="text-xs text-foreground-subtle">
          {t("battle.tapToContinue")} →
        </span>
      </button>
    );
  }

  // Loading state
  if (loading || !left || !right) {
    return (
      <Card noPadding>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚔️</span>
            <span className="text-sm font-bold text-[#c9a84c]">
              {t("battle.title")}
            </span>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 aspect-square bg-background-elevated rounded-xl animate-pulse" />
            <div className="flex items-center">
              <span className="text-xs font-bold text-foreground-subtle">VS</span>
            </div>
            <div className="flex-1 aspect-square bg-background-elevated rounded-xl animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  const streakMsg = getStreakMessage(winStreak, t);

  const streakBadgeClass = useMemo(() => {
    if (winStreak >= 5) return "bg-gradient-to-r from-[#c9a84c] to-[#FFD700] text-black animate-pulse";
    if (winStreak >= 3) return "bg-[#c9a84c]/20 text-[#c9a84c]";
    return "bg-background-elevated text-foreground-muted";
  }, [winStreak]);

  return (
    <Card noPadding>
      {/* Streak flash overlay */}
      {showStreakFlash && (
        <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl animate-pulse bg-[#c9a84c]/10" />
      )}

      <div className="p-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <span className="text-sm font-bold text-[#c9a84c]">
              {t("battle.title")}
            </span>
            {totalVotes > 0 && (
              <span className="text-[10px] bg-background-elevated text-foreground-subtle px-1.5 py-0.5 rounded-full">
                #{totalVotes + 1}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Minimize button */}
            <button
              onClick={() => setMinimized(true)}
              aria-label="Minimize battle"
              className="text-foreground-subtle hover:text-foreground-muted p-2 rounded-lg hover:bg-background-elevated transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
              </svg>
            </button>
            {/* Close button */}
            <button
              onClick={onDismiss}
              aria-label="Close battle"
              className="text-foreground-subtle hover:text-foreground-muted p-2 rounded-lg hover:bg-background-elevated transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Streak & status bar */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-foreground-subtle">
            {voted ? t("battle.nextChallenger") : t("battle.tapToVote")}
          </p>
          {winStreak >= 2 && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold transition-all duration-300 ${streakBadgeClass}`}>
              <span>🔥 {winStreak}</span>
              {streakMsg && <span className="ml-0.5">{streakMsg}</span>}
            </div>
          )}
        </div>

        {/* Battle arena */}
        <div className="flex gap-2 items-stretch">
          {/* Left meme */}
          <BattleSide
            post={left}
            side="left"
            voted={voted}
            isEntering={challengerEntering === "left"}
            onVote={handleVote}
            disabled={!!voted || animating}
          />

          {/* VS divider */}
          <div className="flex flex-col items-center justify-center gap-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
              voted
                ? "bg-[#c9a84c]/30 scale-110"
                : "bg-[#c9a84c]/15"
            }`}>
              <span className={`text-[11px] font-black transition-colors ${
                voted ? "text-[#c9a84c]" : "text-foreground-subtle"
              }`}>VS</span>
            </div>
          </div>

          {/* Right meme */}
          <BattleSide
            post={right}
            side="right"
            voted={voted}
            isEntering={challengerEntering === "right"}
            onVote={handleVote}
            disabled={!!voted || animating}
          />
        </div>

        {/* Session stats footer */}
        {totalVotes >= 3 && (
          <div className="mt-3 pt-2 border-t border-border flex items-center justify-center gap-4 text-[10px] text-foreground-subtle">
            <span>🗳️ {totalVotes} battles judged</span>
            {winStreak >= 2 && (
              <span>🏆 Best: {winStreak} streak</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

const BattleCard = React.memo(BattleCardInner);
export default BattleCard;

// ---------------------------------------------------------------------------
// Battle Side Component — one side of the VS card
// ---------------------------------------------------------------------------
const BattleSide = React.memo(function BattleSide({
  post,
  side,
  voted,
  isEntering,
  onVote,
  disabled,
}: {
  post: BattlePost;
  side: "left" | "right";
  voted: "left" | "right" | null;
  isEntering: boolean;
  onVote: (side: "left" | "right") => void;
  disabled: boolean;
}) {
  const isWinner = voted === side;
  const isLoser = voted !== null && voted !== side;

  return (
    <button
      onClick={() => onVote(side)}
      disabled={disabled}
      className={`flex-1 rounded-xl overflow-hidden border-2 relative
        transition-all duration-300 ease-out
        ${isEntering ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"}
        ${isWinner
          ? "border-[#c9a84c] scale-[1.03] shadow-lg shadow-[#c9a84c]/25 z-10"
          : isLoser
          ? "border-border opacity-40 scale-[0.96] grayscale-[30%]"
          : "border-border hover:border-[#c9a84c]/50 active:scale-[0.97]"
        }`}
    >
      {/* Image */}
      <div className="relative aspect-square">
        <Image
          src={post.imageUrl}
          alt={post.title}
          fill
          sizes="(max-width: 768px) 40vw, 200px"
          className="object-cover"
          unoptimized
        />
        {/* Multi-image badge */}
        {(post.imageCount ?? 0) > 1 && (
          <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            📸 {post.imageCount}
          </span>
        )}
      </div>

      {/* Info bar */}
      <div className="p-2 bg-background-surface">
        <p className="text-xs font-medium text-foreground truncate mb-0.5">
          {post.title}
        </p>
        <div className="flex items-center gap-1 mb-0.5">
          {post.country && (
            <span className="text-xs">{post.country.flagEmoji}</span>
          )}
          <span className="text-[11px] text-foreground-muted truncate">
            {post.author.displayName || post.author.username}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-foreground-subtle">
          <span>🔥 {formatCount(post.reactionCount)}</span>
          {post.battleWins > 0 && (
            <span className="text-[#c9a84c]">
              {post.battleWins}W
            </span>
          )}
        </div>
      </div>

      {/* Winner overlay */}
      {isWinner && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#c9a84c]/15 backdrop-blur-[1px] animate-in fade-in duration-200">
          <div className="text-center animate-in zoom-in-50 duration-300">
            <div className="text-4xl mb-1 drop-shadow-lg">👑</div>
            <span className="text-xs font-bold text-[#c9a84c] bg-black/70 px-2.5 py-1 rounded-full">
              WINNER +5🔥
            </span>
          </div>
        </div>
      )}

      {/* Loser overlay */}
      {isLoser && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 animate-in fade-in duration-200">
          <span className="text-2xl opacity-60">💀</span>
        </div>
      )}
    </button>
  );
});

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
