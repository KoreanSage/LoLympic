/**
 * Update reaction counts on existing posts to have realistic, varied numbers.
 * This script can be re-run on an existing database without re-seeding everything.
 *
 * Usage: npx tsx scripts/update-reaction-counts.ts
 *
 * What it does:
 * - Recounts actual PostReaction rows per post
 * - Updates reactionCount, commentCount, viewCount, voteScore, rankingScore
 * - If actual reaction count is 0 or very low, generates additional reactions
 *   using existing seed users to create varied engagement levels.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Power-law engagement tiers
const ENGAGEMENT_TIERS = [
  { weight: 10, reactionsMin: 2,   reactionsMax: 15   },  // low
  { weight: 25, reactionsMin: 15,  reactionsMax: 50   },  // modest
  { weight: 30, reactionsMin: 50,  reactionsMax: 120  },  // solid
  { weight: 20, reactionsMin: 120, reactionsMax: 250  },  // popular
  { weight: 10, reactionsMin: 250, reactionsMax: 500  },  // hot
  { weight: 5,  reactionsMin: 500, reactionsMax: 1200 },  // viral
];

function pickTier() {
  const total = ENGAGEMENT_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of ENGAGEMENT_TIERS) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return ENGAGEMENT_TIERS[0];
}

function randomDate(daysBack: number) {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

async function main() {
  // Get all seed users (identified by @seed.lolympic.com email)
  const seedUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@seed.lolympic.com" } },
    select: { id: true },
  });

  if (seedUsers.length === 0) {
    console.error("No seed users found. Run seed-memes.ts first.");
    process.exit(1);
  }
  console.log(`Found ${seedUsers.length} seed users`);

  // Get all posts
  const posts = await prisma.post.findMany({
    select: { id: true, authorId: true },
  });
  console.log(`Found ${posts.length} posts to update\n`);

  let totalNewReactions = 0;

  for (const post of posts) {
    const existingReactions = await prisma.postReaction.count({
      where: { postId: post.id },
    });

    const tier = pickTier();
    const targetReactions = rand(tier.reactionsMin, tier.reactionsMax);
    const needed = Math.max(0, targetReactions - existingReactions);

    // Add more reactions if current count is below the target
    if (needed > 0) {
      const existingReactorIds = new Set(
        (await prisma.postReaction.findMany({
          where: { postId: post.id },
          select: { userId: true },
        })).map(r => r.userId)
      );

      let added = 0;
      for (let i = 0; i < needed && i < seedUsers.length; i++) {
        const reactor = pick(seedUsers);
        if (existingReactorIds.has(reactor.id) || reactor.id === post.authorId) continue;
        existingReactorIds.add(reactor.id);

        const types: ("FIRE" | "LAUGH" | "SKULL" | "HEART" | "CRY")[] = ["FIRE", "LAUGH", "SKULL", "HEART", "CRY"];
        try {
          await prisma.postReaction.create({
            data: {
              postId: post.id,
              userId: reactor.id,
              type: pick(types),
              createdAt: randomDate(30),
            },
          });
          added++;
          totalNewReactions++;
        } catch {
          // Duplicate — skip
        }
      }
    }

    // Recount and update cached fields
    const finalReactionCount = await prisma.postReaction.count({ where: { postId: post.id } });
    const finalCommentCount = await prisma.comment.count({ where: { postId: post.id } });
    const viewMultiplier = rand(3, 12);

    await prisma.post.update({
      where: { id: post.id },
      data: {
        reactionCount: finalReactionCount,
        commentCount: finalCommentCount,
        viewCount: rand(finalReactionCount * viewMultiplier, finalReactionCount * viewMultiplier * 2),
        voteScore: Math.max(0, finalReactionCount - rand(0, Math.floor(finalReactionCount * 0.15))),
        rankingScore: finalReactionCount * 10 + finalCommentCount * 5 + rand(0, 100),
      },
    });

    console.log(`  ${post.id.substring(0, 8)}... → ${finalReactionCount} reactions, ${finalCommentCount} comments (tier ${tier.reactionsMin}-${tier.reactionsMax})`);
  }

  console.log(`\nDone! Added ${totalNewReactions} new reactions across ${posts.length} posts.`);
}

main()
  .catch((e) => {
    console.error("Update failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
