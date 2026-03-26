"use client";

import { TIER_COLORS, TIER_ICONS, type Tier } from "@/lib/levels";

interface TierBadgeProps {
  tier: string;
  level?: number;
  size?: "xs" | "sm" | "md";
}

export default function TierBadge({ tier, level, size = "sm" }: TierBadgeProps) {
  const tierKey = tier as Tier;
  const color = TIER_COLORS[tierKey] || TIER_COLORS.IRON;
  const icon = TIER_ICONS[tierKey] || TIER_ICONS.IRON;

  // Calculate division from level if provided, otherwise just show tier name
  let label = "";
  if (size === "xs") {
    // Just icon
    label = "";
  } else if (size === "sm") {
    // Icon + tier name
    const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();
    label = tierName;
  } else {
    // md: Icon + tier name + division
    if (level !== undefined) {
      const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();
      const division = getDivisionFromLevel(tierKey, level);
      label = division ? `${tierName} ${division}` : tierName;
    } else {
      const tierName = tier.charAt(0) + tier.slice(1).toLowerCase();
      label = tierName;
    }
  }

  return (
    <span
      className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: color, color }}
    >
      <span>{icon}</span>
      {label && <span>{label}</span>}
    </span>
  );
}

function getDivisionFromLevel(tier: Tier, level: number): string | null {
  const TIER_RANGES: Record<Tier, { start: number; end: number }> = {
    IRON: { start: 1, end: 10 },
    BRONZE: { start: 11, end: 20 },
    SILVER: { start: 21, end: 30 },
    GOLD: { start: 31, end: 40 },
    PLATINUM: { start: 41, end: 50 },
    DIAMOND: { start: 51, end: 60 },
    MASTER: { start: 61, end: 75 },
    CHALLENGER: { start: 76, end: 99 },
  };

  if (tier === "MASTER" || tier === "CHALLENGER") return null;

  const range = TIER_RANGES[tier];
  if (!range) return null;

  const tierLevels = range.end - range.start + 1;
  const levelInTier = level - range.start;
  const divisionSize = tierLevels / 4;
  const divIndex = Math.min(3, Math.floor(levelInTier / divisionSize));
  const DIVISIONS = ["IV", "III", "II", "I"];
  return DIVISIONS[divIndex];
}
