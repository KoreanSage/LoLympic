"use client";

import { BADGE_DEFS, BadgeKey } from "@/lib/badges";

interface Badge { badgeKey: string; earnedAt: string }

export default function BadgeShowcase({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => {
        const def = BADGE_DEFS[b.badgeKey as BadgeKey];
        if (!def) return null;
        return (
          <div
            key={b.badgeKey}
            title={new Date(b.earnedAt).toLocaleDateString()}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/20 text-xs text-[#c9a84c]"
          >
            <span>{def.emoji}</span>
            <span className="font-medium">{b.badgeKey.replace(/_/g, " ")}</span>
          </div>
        );
      })}
    </div>
  );
}
