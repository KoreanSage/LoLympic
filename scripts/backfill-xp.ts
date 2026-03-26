/**
 * Backfill XP for all existing users based on their activity.
 *
 * Calculates totalXp from:
 * - Posts created: count * 10
 * - Reactions received on their posts: count * 2
 * - Comments received on their posts: count * 3
 * - Battle wins on their posts: count * 5
 *
 * Then updates totalXp, level, tier for each user.
 *
 * Usage: npx tsx scripts/backfill-xp.ts
 */

import { PrismaClient } from "@prisma/client";

// Inline the level calculation so we don't need path aliases in scripts
const TIER_RANGES = [
  { tier: "IRON", startLevel: 1, endLevel: 10, xpPerLevel: 100 },
  { tier: "BRONZE", startLevel: 11, endLevel: 20, xpPerLevel: 200 },
  { tier: "SILVER", startLevel: 21, endLevel: 30, xpPerLevel: 300 },
  { tier: "GOLD", startLevel: 31, endLevel: 40, xpPerLevel: 500 },
  { tier: "PLATINUM", startLevel: 41, endLevel: 50, xpPerLevel: 700 },
  { tier: "DIAMOND", startLevel: 51, endLevel: 60, xpPerLevel: 1000 },
  { tier: "MASTER", startLevel: 61, endLevel: 75, xpPerLevel: 1500 },
  { tier: "CHALLENGER", startLevel: 76, endLevel: 99, xpPerLevel: 2000 },
];

function xpForLevel(level: number): number {
  let totalXp = 0;
  for (const range of TIER_RANGES) {
    if (level <= range.startLevel) break;
    const levelsInRange = Math.min(level, range.endLevel + 1) - range.startLevel;
    totalXp += levelsInRange * range.xpPerLevel;
    if (level <= range.endLevel) break;
  }
  return totalXp;
}

function calculateRank(totalXp: number): { level: number; tier: string } {
  let level = 1;
  for (let l = 2; l <= 99; l++) {
    if (xpForLevel(l) > totalXp) break;
    level = l;
  }

  let tier = "IRON";
  for (const range of TIER_RANGES) {
    if (level >= range.startLevel && level <= range.endLevel) {
      tier = range.tier;
      break;
    }
  }

  return { level, tier };
}

const XP_PER_POST = 10;
const XP_PER_REACTION_RECEIVED = 2;
const XP_PER_COMMENT_RECEIVED = 3;
const XP_PER_BATTLE_WIN = 5;

async function main() {
  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true },
    });

    console.log(`Found ${users.length} users to process...`);

    let updated = 0;

    for (const user of users) {
      // Count posts created
      const postCount = await prisma.post.count({
        where: { authorId: user.id, status: "PUBLISHED" },
      });

      // Count reactions received on their posts
      const reactionCount = await prisma.postReaction.count({
        where: {
          post: { authorId: user.id },
          userId: { not: user.id }, // exclude self-reactions
        },
      });

      // Count comments received on their posts (excluding self-comments)
      const commentCount = await prisma.comment.count({
        where: {
          post: { authorId: user.id },
          authorId: { not: user.id }, // exclude self-comments
          status: "VISIBLE",
        },
      });

      // Count battle wins on their posts
      const battleWins = await prisma.post.aggregate({
        where: { authorId: user.id, status: "PUBLISHED" },
        _sum: { battleWins: true },
      });
      const totalBattleWins = battleWins._sum.battleWins ?? 0;

      // Calculate total XP
      const totalXp =
        postCount * XP_PER_POST +
        reactionCount * XP_PER_REACTION_RECEIVED +
        commentCount * XP_PER_COMMENT_RECEIVED +
        totalBattleWins * XP_PER_BATTLE_WIN;

      const { level, tier } = calculateRank(totalXp);

      // Update user
      await prisma.user.update({
        where: { id: user.id },
        data: { totalXp, level, tier },
      });

      updated++;
      if (totalXp > 0) {
        console.log(
          `  @${user.username}: ${totalXp} XP -> Level ${level} (${tier}) ` +
          `[${postCount} posts, ${reactionCount} reactions, ${commentCount} comments, ${totalBattleWins} wins]`
        );
      }
    }

    console.log(`\nDone! Updated ${updated} users.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
