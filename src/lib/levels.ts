// ============================================================================
// LoLympic — User Level & Tier System (LoL-style ranks)
// ============================================================================

export const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "MASTER",
  "CHALLENGER",
] as const;

export type Tier = (typeof TIERS)[number];

export const DIVISIONS = ["IV", "III", "II", "I"] as const;
export type Division = (typeof DIVISIONS)[number];

// ---------------------------------------------------------------------------
// Tier visual config
// ---------------------------------------------------------------------------

export const TIER_COLORS: Record<Tier, string> = {
  IRON: "#696969",
  BRONZE: "#CD7F32",
  SILVER: "#C0C0C0",
  GOLD: "#c9a84c",
  PLATINUM: "#00CED1",
  DIAMOND: "#b9f2ff",
  MASTER: "#9b59b6",
  CHALLENGER: "#ff4444",
};

export const TIER_ICONS: Record<Tier, string> = {
  IRON: "\u2699\uFE0F",      // ⚙️
  BRONZE: "\uD83E\uDD49",    // 🥉
  SILVER: "\uD83E\uDD48",    // 🥈
  GOLD: "\uD83E\uDD47",      // 🥇
  PLATINUM: "\uD83D\uDC8E",  // 💎
  DIAMOND: "\uD83D\uDCA0",   // 💠
  MASTER: "\uD83D\uDC51",    // 👑
  CHALLENGER: "\uD83D\uDD25", // 🔥
};

// ---------------------------------------------------------------------------
// XP thresholds — each tier spans a level range
// ---------------------------------------------------------------------------
// Iron:       Lv  1-10  (100 XP per level  →    0 -  1,000 XP)
// Bronze:     Lv 11-20  (200 XP per level  →  1,000 -  3,000 XP)
// Silver:     Lv 21-30  (300 XP per level  →  3,000 -  6,000 XP)
// Gold:       Lv 31-40  (500 XP per level  →  6,000 - 11,000 XP)
// Platinum:   Lv 41-50  (700 XP per level  → 11,000 - 18,000 XP)
// Diamond:    Lv 51-60  (1000 XP per level → 18,000 - 28,000 XP)
// Master:     Lv 61-75  (1500 XP per level → 28,000 - 50,500 XP)
// Challenger: Lv 76-99  (2000 XP per level → 50,500 - 98,500 XP)

interface TierRange {
  tier: Tier;
  startLevel: number;
  endLevel: number;
  xpPerLevel: number;
}

const TIER_RANGES: TierRange[] = [
  { tier: "IRON", startLevel: 1, endLevel: 10, xpPerLevel: 100 },
  { tier: "BRONZE", startLevel: 11, endLevel: 20, xpPerLevel: 200 },
  { tier: "SILVER", startLevel: 21, endLevel: 30, xpPerLevel: 300 },
  { tier: "GOLD", startLevel: 31, endLevel: 40, xpPerLevel: 500 },
  { tier: "PLATINUM", startLevel: 41, endLevel: 50, xpPerLevel: 700 },
  { tier: "DIAMOND", startLevel: 51, endLevel: 60, xpPerLevel: 1000 },
  { tier: "MASTER", startLevel: 61, endLevel: 75, xpPerLevel: 1500 },
  { tier: "CHALLENGER", startLevel: 76, endLevel: 99, xpPerLevel: 2000 },
];

/** Total XP required to reach the start of a given level */
export function xpForLevel(level: number): number {
  let totalXp = 0;
  for (const range of TIER_RANGES) {
    if (level <= range.startLevel) break;
    const levelsInRange = Math.min(level, range.endLevel + 1) - range.startLevel;
    totalXp += levelsInRange * range.xpPerLevel;
    if (level <= range.endLevel) break;
  }
  return totalXp;
}

export interface RankInfo {
  level: number;
  tier: Tier;
  division: Division | null; // null for Master/Challenger
  tierIcon: string;
  tierColor: string;
  currentXp: number;        // XP within current level
  xpToNext: number;         // XP needed for next level
  totalXp: number;
  progress: number;         // 0-100 percentage to next level
}

/** Given totalXp, compute the full rank breakdown */
export function calculateRank(totalXp: number): RankInfo {
  // Find level from XP
  let level = 1;
  for (let l = 2; l <= 99; l++) {
    if (xpForLevel(l) > totalXp) break;
    level = l;
  }

  // Find tier
  let tier: Tier = "IRON";
  for (const range of TIER_RANGES) {
    if (level >= range.startLevel && level <= range.endLevel) {
      tier = range.tier;
      break;
    }
  }

  // Find division (IV → I within tier, null for Master/Challenger)
  let division: Division | null = null;
  if (tier !== "MASTER" && tier !== "CHALLENGER") {
    const range = TIER_RANGES.find((r) => r.tier === tier)!;
    const tierLevels = range.endLevel - range.startLevel + 1; // 10
    const levelInTier = level - range.startLevel; // 0-9
    const divisionSize = tierLevels / 4; // 2.5
    const divIndex = Math.min(3, Math.floor(levelInTier / divisionSize));
    division = DIVISIONS[divIndex];
  }

  // XP progress within current level
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = level < 99 ? xpForLevel(level + 1) : currentLevelXp;
  const currentXp = totalXp - currentLevelXp;
  const xpToNext = nextLevelXp - currentLevelXp;
  const progress = xpToNext > 0 ? Math.min(100, Math.round((currentXp / xpToNext) * 100)) : 100;

  return {
    level,
    tier,
    division,
    tierIcon: TIER_ICONS[tier],
    tierColor: TIER_COLORS[tier],
    currentXp,
    xpToNext,
    totalXp,
    progress,
  };
}

/** Format rank display string, e.g. "Gold II" or "Master" */
export function formatRank(tier: Tier, division: Division | null): string {
  const name = tier.charAt(0) + tier.slice(1).toLowerCase();
  return division ? `${name} ${division}` : name;
}

// ---------------------------------------------------------------------------
// XP award amounts
// ---------------------------------------------------------------------------
export const XP_AWARDS = {
  POST_CREATED: 10,
  REACTION_RECEIVED: 2,
  COMMENT_RECEIVED: 3,
  SHARE_RECEIVED: 5,
  BATTLE_WON: 5,
  SUGGESTION_APPROVED: 10,
} as const;
