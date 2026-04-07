"use client";

import React from "react";
import { useTranslation } from "@/i18n";

interface ScoreBreakdownProps {
  reactions: number;
  comments: number;
  shares: number;
  totalScore: number;
  rank: number;
  totalUsers: number;
}

export default function ScoreBreakdown({
  reactions,
  comments,
  shares,
  totalScore,
  rank,
  totalUsers,
}: ScoreBreakdownProps) {
  const { t } = useTranslation();
  const maxSegment = Math.max(reactions, comments * 2, shares * 3, 1);

  const segments = [
    { label: "Reactions", icon: "\uD83D\uDD25", value: reactions, weight: 1, score: reactions, color: "#c9a84c" },
    { label: "Comments", icon: "\uD83D\uDCAC", value: comments, weight: 2, score: comments * 2, color: "#d4b65c" },
    { label: "Shares", icon: "\uD83D\uDCE4", value: shares, weight: 3, score: shares * 3, color: "#e8c84a" },
  ];

  if (totalScore === 0) return null;

  return (
    <div className="bg-background-surface border border-[#c9a84c]/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span>{"\uD83C\uDFAF"}</span>
          {t("leaderboard.myScore") || "My Score"}
        </h3>
        <div className="text-right">
          <span className="text-lg font-bold text-[#c9a84c]">{totalScore.toLocaleString()}</span>
          <span className="text-xs text-foreground-subtle ml-2">
            #{rank} / {totalUsers}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="text-sm w-5 text-center">{seg.icon}</span>
            <span className="text-xs text-foreground-subtle w-16 truncate">{seg.label}</span>
            <div className="flex-1 h-3 bg-background-elevated rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max((seg.score / maxSegment) * 100, 2)}%`,
                  backgroundColor: seg.color,
                }}
              />
            </div>
            <span className="text-xs font-mono text-foreground-subtle w-12 text-right">
              {seg.score.toLocaleString()}
            </span>
            <span className="text-[9px] text-foreground-subtle/60 w-8">
              x{seg.weight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
