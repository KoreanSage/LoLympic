/**
 * Seed script: Adds comments and likes (reactions/votes) to existing posts
 * using virtual accounts.
 *
 * Usage: npx tsx scripts/seed-engagement.ts
 *
 * Creates ~30 virtual users and adds moderate engagement to existing posts.
 */

import { PrismaClient, LanguageCode } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

// ── Config ──────────────────────────────────────────────
const VIRTUAL_USER_COUNT = 30;

// ── Country distribution ────────────────────────────────
const COUNTRIES: { id: string; weight: number; lang: LanguageCode }[] = [
  { id: "KR", weight: 25, lang: "ko" },
  { id: "US", weight: 20, lang: "en" },
  { id: "JP", weight: 15, lang: "ja" },
  { id: "CN", weight: 8, lang: "zh" },
  { id: "ES", weight: 5, lang: "es" },
  { id: "MX", weight: 5, lang: "es" },
  { id: "IN", weight: 6, lang: "hi" },
  { id: "GB", weight: 4, lang: "en" },
  { id: "SA", weight: 3, lang: "ar" },
  { id: "AU", weight: 3, lang: "en" },
];

const USERNAMES = [
  "meme_fan01", "dank_viewer", "짤_좋아", "meme_lover", "ミーム好き",
  "funny_guy22", "lol_watcher", "밈_수집", "fun_seeker", "梗图粉",
  "ha_ha_meme", "just_laugh", "밈_구경", "meme_addict", "笑い好き",
  "chill_memer", "vibes_only", "짤_감상", "meme_scroll", "搞笑达人",
  "daily_meme", "meme_react", "밈_리액트", "quick_laugh", "ネタ見る人",
  "top_memer", "meme_surfer", "짤_서핑", "meme_hunter", "梗王子",
];

const DISPLAY_NAMES = [
  "Meme Fan", "Dank Viewer", "짤 좋아하는 사람", "Meme Lover", "ミーム好き",
  "Funny Guy", "LOL Watcher", "밈 수집가", "Fun Seeker", "梗图粉丝",
  "하하밈", "Just Laugh", "밈 구경꾼", "Meme Addict", "笑い好きさん",
  "Chill Memer", "Vibes Only", "짤 감상러", "Meme Scroll", "搞笑达人",
  "Daily Meme", "Meme React", "밈 리액터", "Quick Laugh", "ネタ見る人",
  "Top Memer", "Meme Surfer", "짤 서퍼", "Meme Hunter", "梗王子",
];

// ── Comment templates ───────────────────────────────────
const COMMENTS: Record<string, string[]> = {
  en: [
    "LMAO 😂", "This is gold", "So accurate lol", "Bro 💀",
    "Sent this to my friend", "Why is this so funny", "W meme",
    "Dead 😭", "Peak comedy", "This is art fr", "Crying rn 😂",
    "Adding to collection", "Best thing today", "Too real",
    "I can't 💀💀", "Facts", "The accuracy 😂", "Relatable",
    "This hits different", "Global meme energy 🌍",
  ],
  ko: [
    "ㅋㅋㅋㅋ", "아 진짜 웃겨", "이거 레전드", "공감 ㅋㅋ",
    "미쳤다 ㅋㅋ", "ㅇㅈ", "와 이건 인정", "저장함 ㅋ",
    "찐이다", "실화? ㅋㅋ", "대박 ㅋㅋ", "한국인 특",
    "ㅋㅋ 나만 그런 줄", "번역 퀄 미쳤다", "진짜 웃기네",
    "공감 100%", "아 개웃겨", "이거 보내야지", "ㅋㅋㅋ 인정",
  ],
  ja: [
    "草www", "やばいw", "わかる", "全世界共通で草",
    "面白い", "保存した", "神ミーム", "ワロタ",
    "これは伝説", "翻訳すごい", "笑った",
  ],
  zh: [
    "哈哈哈笑死", "太真实了", "收藏了", "绝了",
    "笑到停不下来", "翻译太好了", "全球通用",
  ],
  es: [
    "JAJAJA 😂", "Demasiado real", "Genial", "No puedo más 💀",
    "Arte puro", "Lo mejor del día", "Me siento atacado",
  ],
  hi: [
    "😂😂 bhai", "Too relatable", "Hahaha true", "Best meme",
    "Global energy", "Mast hai 🔥",
  ],
  ar: [
    "😂😂 والله", "حقيقي جدا", "ضحكت كثير", "ممتاز",
    "اعتمد ✅", "ميم عالمي",
  ],
};

const REACTION_TYPES: string[] = ["FIRE", "LAUGH", "SKULL", "HEART", "CRY"];

// ── Helpers ─────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of items) {
    r -= w.weight;
    if (r <= 0) return w;
  }
  return items[0];
}

function randomDateWithin(daysBack: number): Date {
  const now = Date.now();
  return new Date(now - Math.random() * daysBack * 24 * 60 * 60 * 1000);
}

// ── Main ────────────────────────────────────────────────
async function main() {
  console.log("🎯 Seed Engagement: Adding comments and likes to existing posts\n");

  // 1. Create virtual users
  console.log(`👤 Creating ${VIRTUAL_USER_COUNT} virtual users...`);
  const virtualUsers: { id: string; lang: LanguageCode }[] = [];

  for (let i = 0; i < VIRTUAL_USER_COUNT; i++) {
    const country = weightedPick(COUNTRIES);
    const username = `${USERNAMES[i]}_${crypto.randomBytes(2).toString("hex")}`;

    const user = await prisma.user.create({
      data: {
        email: `${username}@seed.mimzy.local`,
        username,
        displayName: DISPLAY_NAMES[i] || username,
        countryId: country.id,
        preferredLanguage: country.lang,
        uiLanguage: country.lang,
        level: rand(1, 8),
        totalXp: rand(0, 500),
      },
    });
    virtualUsers.push({ id: user.id, lang: country.lang });
  }
  console.log(`  ✅ Created ${virtualUsers.length} virtual users\n`);

  // 2. Fetch all existing published posts
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED", visibility: "PUBLIC" },
    select: { id: true, sourceLanguage: true, createdAt: true },
  });
  console.log(`📝 Found ${posts.length} published posts\n`);

  if (posts.length === 0) {
    console.log("No posts found. Run seed-memes.ts first.");
    return;
  }

  let totalComments = 0;
  let totalReactions = 0;
  let totalVotes = 0;
  let totalCommentLikes = 0;

  for (const post of posts) {
    // Decide engagement level per post (moderate — not too much)
    const numComments = rand(2, 12);
    const numReactions = rand(3, 20);
    const numVotes = rand(2, 15);

    // Shuffle users for this post
    const shuffledUsers = [...virtualUsers].sort(() => Math.random() - 0.5);

    // 3. Add comments
    const createdCommentIds: string[] = [];
    for (let c = 0; c < Math.min(numComments, shuffledUsers.length); c++) {
      const commenter = shuffledUsers[c];
      const langComments = COMMENTS[commenter.lang] || COMMENTS.en;
      const commentBody = pick(langComments);

      try {
        const comment = await prisma.comment.create({
          data: {
            postId: post.id,
            authorId: commenter.id,
            body: commentBody,
            language: commenter.lang,
            createdAt: randomDateWithin(14),
          },
        });
        createdCommentIds.push(comment.id);
        totalComments++;
      } catch {
        // skip duplicate or error
      }
    }

    // Add some replies to existing comments (20% of comments get a reply)
    for (const commentId of createdCommentIds) {
      if (Math.random() < 0.2) {
        const replier = pick(shuffledUsers);
        const langComments = COMMENTS[replier.lang] || COMMENTS.en;
        try {
          await prisma.comment.create({
            data: {
              postId: post.id,
              authorId: replier.id,
              parentId: commentId,
              body: pick(langComments),
              language: replier.lang,
              createdAt: randomDateWithin(7),
            },
          });
          totalComments++;
          // Increment parent replyCount
          await prisma.comment.update({
            where: { id: commentId },
            data: { replyCount: { increment: 1 } },
          });
        } catch {
          // skip
        }
      }
    }

    // 4. Add reactions (fire, laugh, skull, etc.)
    for (let r = 0; r < Math.min(numReactions, shuffledUsers.length); r++) {
      const reactor = shuffledUsers[r];
      const type = pick(REACTION_TYPES);
      try {
        await prisma.postReaction.create({
          data: {
            postId: post.id,
            userId: reactor.id,
            type: type as any,
          },
        });
        totalReactions++;
      } catch {
        // skip unique constraint
      }
    }

    // 5. Add votes (upvotes mostly, some downvotes)
    for (let v = 0; v < Math.min(numVotes, shuffledUsers.length); v++) {
      const voter = shuffledUsers[numReactions + v] || shuffledUsers[v];
      const value = Math.random() < 0.85 ? 1 : -1; // 85% upvote
      try {
        await prisma.postVote.create({
          data: {
            postId: post.id,
            userId: voter.id,
            value,
          },
        });
        totalVotes++;
      } catch {
        // skip unique constraint
      }
    }

    // 6. Add comment likes (some users like some comments)
    if (createdCommentIds.length > 0) {
      const likersCount = rand(1, Math.min(6, shuffledUsers.length));
      for (let l = 0; l < likersCount; l++) {
        const liker = shuffledUsers[l];
        const commentId = pick(createdCommentIds);
        try {
          await prisma.commentLike.create({
            data: {
              commentId,
              userId: liker.id,
            },
          });
          await prisma.comment.update({
            where: { id: commentId },
            data: { likeCount: { increment: 1 } },
          });
          totalCommentLikes++;
        } catch {
          // skip unique constraint
        }
      }
    }

    // 7. Update post cached counts
    const [reactionCount, commentCount, voteAgg] = await Promise.all([
      prisma.postReaction.count({ where: { postId: post.id } }),
      prisma.comment.count({ where: { postId: post.id, status: "VISIBLE" } }),
      prisma.postVote.aggregate({ where: { postId: post.id }, _sum: { value: true } }),
    ]);

    await prisma.post.update({
      where: { id: post.id },
      data: {
        reactionCount,
        commentCount,
        voteScore: voteAgg._sum.value || 0,
      },
    });
  }

  console.log("📊 Engagement Summary:");
  console.log(`  💬 Comments: ${totalComments}`);
  console.log(`  🔥 Reactions: ${totalReactions}`);
  console.log(`  👍 Votes: ${totalVotes}`);
  console.log(`  ❤️ Comment likes: ${totalCommentLikes}`);
  console.log("\n✅ Done!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
