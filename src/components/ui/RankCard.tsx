"use client";

import { calculateRank, formatRank } from "@/lib/levels";
import { useTranslation } from "@/i18n";

interface RankCardProps {
  totalXp: number;
  level: number;
  tier: string;
}

export default function RankCard({ totalXp, level, tier }: RankCardProps) {
  const { t } = useTranslation();
  const rank = calculateRank(totalXp);

  const displayName = formatRank(rank.tier, rank.division);

  return (
    <div className="bg-background-surface border border-border rounded-xl p-4">
      {/* Tier icon + name */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{rank.tierIcon}</span>
        <div>
          <div className="text-lg font-bold" style={{ color: rank.tierColor }}>
            {displayName}
          </div>
          <div className="text-sm text-foreground-subtle">
            {t("rank.level")} {rank.level}
          </div>
        </div>
      </div>

      {/* XP Progress bar */}
      <div className="mb-2">
        <div className="w-full h-2 bg-background-overlay rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${rank.progress}%`,
              background: "linear-gradient(90deg, #c9a84c, #e6c65a)",
            }}
          />
        </div>
      </div>

      {/* XP info */}
      <div className="flex items-center justify-between text-xs text-foreground-subtle">
        <span>{t("rank.totalXp")}: {totalXp.toLocaleString()}</span>
        <span>
          {rank.level < 99
            ? t("rank.xpToNext", { xp: String(rank.xpToNext - rank.currentXp) })
            : "MAX"}
        </span>
      </div>
    </div>
  );
}
