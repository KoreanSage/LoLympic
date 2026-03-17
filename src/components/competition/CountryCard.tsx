"use client";

import MedalBadge from "./MedalBadge";

interface CountryCardProps {
  flagEmoji: string;
  name: string;
  rank: number;
  score: number;
  medalCounts?: {
    gold: number;
    silver: number;
    bronze: number;
  };
  className?: string;
}

export default function CountryCard({
  flagEmoji,
  name,
  rank,
  score,
  medalCounts,
  className = "",
}: CountryCardProps) {
  return (
    <div
      className={`
        flex items-center gap-3 bg-background-surface border border-border rounded-xl px-4 py-3
        hover:border-border-active transition-colors ${className}
      `}
    >
      {/* Rank */}
      <span
        className={`text-sm font-mono w-6 text-right shrink-0 ${
          rank <= 3 ? "text-[#c9a84c] font-bold" : "text-foreground-subtle"
        }`}
      >
        {rank}
      </span>

      {/* Flag */}
      <span className="text-2xl shrink-0">{flagEmoji}</span>

      {/* Name + medals */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground block truncate">
          {name}
        </span>
        {medalCounts && (
          <div className="flex items-center gap-2 mt-0.5">
            {medalCounts.gold > 0 && (
              <span className="flex items-center gap-0.5">
                <MedalBadge type="GOLD" size="sm" />
                <span className="text-[10px] text-[#FFD700]">
                  {medalCounts.gold}
                </span>
              </span>
            )}
            {medalCounts.silver > 0 && (
              <span className="flex items-center gap-0.5">
                <MedalBadge type="SILVER" size="sm" />
                <span className="text-[10px] text-[#C0C0C0]">
                  {medalCounts.silver}
                </span>
              </span>
            )}
            {medalCounts.bronze > 0 && (
              <span className="flex items-center gap-0.5">
                <MedalBadge type="BRONZE" size="sm" />
                <span className="text-[10px] text-[#CD7F32]">
                  {medalCounts.bronze}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Score */}
      <span className="text-sm font-mono text-[#c9a84c] shrink-0">
        {score.toLocaleString()}
      </span>
    </div>
  );
}
