"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import { useTranslation } from "@/i18n";

interface BattlePost {
  id: string;
  title: string;
  imageUrl: string;
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

export default function BattleCard({ onDismiss }: BattleCardProps) {
  const { t } = useTranslation();
  const [left, setLeft] = useState<BattlePost | null>(null);
  const [right, setRight] = useState<BattlePost | null>(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState<"left" | "right" | null>(null);
  const [animating, setAnimating] = useState(false);
  const [noBattle, setNoBattle] = useState(false);
  const [winStreak, setWinStreak] = useState(0);
  const [streakSide, setStreakSide] = useState<"left" | "right" | null>(null);

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
    } catch {
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

      const chosenPostId = side === "left" ? left.id : right.id;

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
        if (streakSide === side) {
          setWinStreak((prev) => prev + 1);
        } else {
          setStreakSide(side);
          setWinStreak(1);
        }

        // Show result briefly, then load next
        setTimeout(() => {
          if (data.nextBattle) {
            // Winner stays, loser is replaced
            const winner = side === "left" ? left : right;
            const newChallenger =
              side === "left" ? data.nextBattle.right : data.nextBattle.left;

            // Update winner's stats locally
            const updatedWinner = {
              ...winner,
              battleWins: winner.battleWins + 1,
              reactionCount: winner.reactionCount + 5,
            };

            if (side === "left") {
              setLeft(updatedWinner);
              setRight(newChallenger);
            } else {
              setRight(updatedWinner);
              setLeft(newChallenger);
            }
            setVoted(null);
            setAnimating(false);
          } else {
            setNoBattle(true);
          }
        }, 1200);
      } catch {
        setVoted(null);
        setAnimating(false);
      }
    },
    [left, right, voted, animating, streakSide]
  );

  if (noBattle) return null;

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

  return (
    <Card noPadding>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            <span className="text-sm font-bold text-[#c9a84c]">
              {t("battle.title")}
            </span>
            {winStreak > 1 && (
              <span className="text-xs bg-[#c9a84c]/20 text-[#c9a84c] px-2 py-0.5 rounded-full font-medium">
                🔥 {winStreak} streak
              </span>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="text-foreground-subtle hover:text-foreground-muted p-1 rounded-lg hover:bg-background-elevated transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-foreground-subtle mb-3">
          {t("battle.tapToVote")}
        </p>

        {/* Battle arena */}
        <div className="flex gap-2 items-stretch">
          {/* Left meme */}
          <button
            onClick={() => handleVote("left")}
            disabled={!!voted}
            className={`flex-1 rounded-xl overflow-hidden border-2 transition-all duration-300 relative ${
              voted === "left"
                ? "border-[#c9a84c] scale-[1.02] shadow-lg shadow-[#c9a84c]/20"
                : voted === "right"
                ? "border-border opacity-50 scale-[0.98]"
                : "border-border hover:border-[#c9a84c]/50 active:scale-[0.98]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={left.imageUrl}
              alt={left.title}
              className="w-full aspect-square object-cover"
            />
            <div className="p-2 bg-background-surface">
              <div className="flex items-center gap-1 mb-1">
                {left.country && (
                  <span className="text-xs">{left.country.flagEmoji}</span>
                )}
                <span className="text-xs text-foreground-muted truncate">
                  {left.author.displayName || left.author.username}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-subtle">
                <span>🔥 {formatCount(left.reactionCount)}</span>
                {left.battleWins > 0 && (
                  <span className="text-[#c9a84c]">⚔️ {left.battleWins}W</span>
                )}
              </div>
            </div>
            {/* Winner overlay */}
            {voted === "left" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#c9a84c]/20 backdrop-blur-[1px]">
                <div className="text-center">
                  <div className="text-3xl mb-1">👑</div>
                  <span className="text-xs font-bold text-[#c9a84c] bg-black/60 px-2 py-1 rounded-full">
                    +5 🔥
                  </span>
                </div>
              </div>
            )}
          </button>

          {/* VS divider */}
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-[#c9a84c]/20 flex items-center justify-center">
              <span className="text-[10px] font-black text-[#c9a84c]">VS</span>
            </div>
          </div>

          {/* Right meme */}
          <button
            onClick={() => handleVote("right")}
            disabled={!!voted}
            className={`flex-1 rounded-xl overflow-hidden border-2 transition-all duration-300 relative ${
              voted === "right"
                ? "border-[#c9a84c] scale-[1.02] shadow-lg shadow-[#c9a84c]/20"
                : voted === "left"
                ? "border-border opacity-50 scale-[0.98]"
                : "border-border hover:border-[#c9a84c]/50 active:scale-[0.98]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={right.imageUrl}
              alt={right.title}
              className="w-full aspect-square object-cover"
            />
            <div className="p-2 bg-background-surface">
              <div className="flex items-center gap-1 mb-1">
                {right.country && (
                  <span className="text-xs">{right.country.flagEmoji}</span>
                )}
                <span className="text-xs text-foreground-muted truncate">
                  {right.author.displayName || right.author.username}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-subtle">
                <span>🔥 {formatCount(right.reactionCount)}</span>
                {right.battleWins > 0 && (
                  <span className="text-[#c9a84c]">⚔️ {right.battleWins}W</span>
                )}
              </div>
            </div>
            {/* Winner overlay */}
            {voted === "right" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#c9a84c]/20 backdrop-blur-[1px]">
                <div className="text-center">
                  <div className="text-3xl mb-1">👑</div>
                  <span className="text-xs font-bold text-[#c9a84c] bg-black/60 px-2 py-1 rounded-full">
                    +5 🔥
                  </span>
                </div>
              </div>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}
