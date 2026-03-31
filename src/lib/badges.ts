import prisma from "./prisma";

export const BADGE_DEFS = {
  FIRST_TRANSLATION: { emoji: "🌐", nameKey: "badge.FIRST_TRANSLATION" },
  UPLOAD_10:         { emoji: "📸", nameKey: "badge.UPLOAD_10" },
  UPLOAD_50:         { emoji: "🏆", nameKey: "badge.UPLOAD_50" },
  REACTION_100:      { emoji: "❤️", nameKey: "badge.REACTION_100" },
  BATTLE_10W:        { emoji: "⚔️", nameKey: "badge.BATTLE_10W" },
  STREAK_7:          { emoji: "🔥", nameKey: "badge.STREAK_7" },
  STREAK_30:         { emoji: "💎", nameKey: "badge.STREAK_30" },
} as const;

export type BadgeKey = keyof typeof BADGE_DEFS;

export async function awardBadgeIfNotEarned(userId: string, badgeKey: BadgeKey): Promise<boolean> {
  try {
    await prisma.userBadge.create({ data: { userId, badgeKey } });
    // Fire notification
    await prisma.notification.create({
      data: {
        recipientId: userId,
        type: "BADGE_EARNED",
        metadata: { badgeKey },
      },
    });
    return true;
  } catch {
    return false; // unique constraint = already earned
  }
}

export async function checkAndAwardBadges(userId: string) {
  const [badges, postCount, battleWins, user] = await Promise.all([
    prisma.userBadge.findMany({ where: { userId }, select: { badgeKey: true } }),
    prisma.post.count({ where: { authorId: userId, status: "PUBLISHED" } }),
    prisma.post.aggregate({ where: { authorId: userId }, _sum: { battleWins: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { uploadStreakCount: true },
    }),
  ]);
  if (!user) return;

  const earned = new Set(badges.map((b) => b.badgeKey));
  const totalBattleWins = battleWins._sum.battleWins ?? 0;
  const streak = user.uploadStreakCount ?? 0;

  if (postCount >= 10 && !earned.has("UPLOAD_10"))
    await awardBadgeIfNotEarned(userId, "UPLOAD_10");
  if (postCount >= 50 && !earned.has("UPLOAD_50"))
    await awardBadgeIfNotEarned(userId, "UPLOAD_50");
  if (streak >= 7 && !earned.has("STREAK_7"))
    await awardBadgeIfNotEarned(userId, "STREAK_7");
  if (streak >= 30 && !earned.has("STREAK_30"))
    await awardBadgeIfNotEarned(userId, "STREAK_30");
  if (totalBattleWins >= 10 && !earned.has("BATTLE_10W"))
    await awardBadgeIfNotEarned(userId, "BATTLE_10W");
}
