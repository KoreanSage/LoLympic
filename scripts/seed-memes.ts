/**
 * Seed script: Creates fake users, uploads memes, generates engagement
 * Usage: npx tsx scripts/seed-memes.ts "/path/to/meme/folder"
 *
 * Creates ~200 users, uploads all memes from the folder,
 * and generates reactions/comments to look like an active community.
 */

import { PrismaClient, LanguageCode } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const prisma = new PrismaClient();

// ── Config ──────────────────────────────────────────────
const TOTAL_USERS = 200;
const COMMENTS_PER_POST_MIN = 3;
const COMMENTS_PER_POST_MAX = 25;
const REACTIONS_PER_POST_MIN = 10;
const REACTIONS_PER_POST_MAX = 300;

// ── Country distribution (weighted for realism) ─────────
const COUNTRY_WEIGHTS: { id: string; weight: number; lang: LanguageCode }[] = [
  { id: "KR", weight: 25, lang: "ko" },
  { id: "US", weight: 20, lang: "en" },
  { id: "JP", weight: 15, lang: "ja" },
  { id: "CN", weight: 8, lang: "zh" },
  { id: "TW", weight: 4, lang: "zh" },
  { id: "ES", weight: 5, lang: "es" },
  { id: "MX", weight: 5, lang: "es" },
  { id: "IN", weight: 6, lang: "hi" },
  { id: "GB", weight: 4, lang: "en" },
  { id: "SA", weight: 3, lang: "ar" },
  { id: "EG", weight: 2, lang: "ar" },
  { id: "AU", weight: 3, lang: "en" },
];

// ── Meme titles (based on actual images) ────────────────
const MEME_TITLES: Record<string, { title: string; lang: LanguageCode; tags: string[] }> = {
  "교수님 랩탑.jpg": { title: "교수님 맥북 충전 안 돼서 수업 일찍 끝남 ㅋㅋ 학생들 아무도 충전기 안 빌려줌", lang: "ko", tags: ["university", "professor", "laptop"] },
  "말실수.jpg": { title: "인턴 첫날 '감사합니다 인터넷입니다' 라고 함... 다들 못 들은 척", lang: "ko", tags: ["work", "mistake", "intern"] },
  "미키마우스.jpg": { title: "이거 본 이후로 밤에 잠이 안 옴... 나만 당할 수는 없지 ㅋㅎ", lang: "ko", tags: ["cursed", "disney", "mickey"] },
  "시험지.jpg": { title: "시험지 받으면 1번부터 모르는 거라 10초 동안 교수님 이렇게 봄", lang: "ko", tags: ["exam", "university", "lion"] },
  "어쨌든 기말은 보러 감.jpg": { title: "공부 1도 안 했지만 어쨌든 기말은 보러 감 (자신감)", lang: "ko", tags: ["finals", "bodybuilder", "confidence"] },
  "초등학교 가면 이렇게 생긴 남자애들 개많음.jpg": { title: "초등학교 가면 이렇게 생긴 남자애들 개많음", lang: "ko", tags: ["elementary", "cat", "kids"] },
  "Mcdonald's.jpg": { title: "McDonald's went from a happy child to a depressed middle-aged adult", lang: "en", tags: ["mcdonalds", "nostalgia", "growing-up"] },
  "Me Trying to explain a meme template without knowing it's name.jpg": { title: "Me trying to explain a meme template without knowing its name vs Google trying to understand", lang: "en", tags: ["memes", "google", "relatable"] },
  "My dad.jpg": { title: "Dad showed me a 30-min PowerPoint on why to always wear protection. All slides were just pictures of me", lang: "en", tags: ["dad", "savage", "xavier"] },
  "Underneath.jpg": { title: "Come underneath the blanket, I got something to show you... 🦕✨", lang: "en", tags: ["wholesome", "dinosaurs", "couple"] },
  "Nihongo-Wakarimasen-768x832.png": { title: "When someone speaks Japanese to you and all you know is 'nihongo wakarimasen'", lang: "en", tags: ["japanese", "language", "anime"] },
  "YABAI-768x764.png": { title: "When the situation is absolutely YABAI but you can only describe it as yabai", lang: "en", tags: ["japanese", "yabai", "reaction"] },
  "めちゃくちゃやばい-768x957.png": { title: "めちゃくちゃやばい moment when you realize it's Monday tomorrow", lang: "en", tags: ["japanese", "monday", "reaction"] },
  "46-46-2136-x-…--768x864.png": { title: "That one friend who always has the most chaotic energy in the group", lang: "en", tags: ["friend", "chaos", "relatable"] },
};

// ── Fallback titles for unnamed memes ───────────────────
const FALLBACK_TITLES_EN = [
  "When you finally understand the meme after 3 days",
  "POV: Your mom finds your search history",
  "Nobody: ... Absolutely nobody: ... My brain at 3am:",
  "This hits different at 2am ngl",
  "I showed this to my therapist and she cried",
  "Why is this so accurate it hurts 😭",
  "Sending this to the group chat with zero context",
  "The accuracy of this meme is concerning",
  "My last brain cell during finals week",
  "Tell me you're a millennial without telling me",
  "This meme lives rent free in my head",
  "Every country has THIS person",
  "When the WiFi drops for 0.5 seconds",
  "Bro thought he was the main character 💀",
  "The universal experience no one talks about",
  "My ancestors watching me eat cereal at 4am",
  "This is peak comedy and I'm tired of pretending it's not",
  "Average Monday vs Average Friday energy",
  "POV: You're trying to adult but failing spectacularly",
  "Global meme energy transcends all languages fr fr",
];

const FALLBACK_TITLES_KO = [
  "한국인이면 100% 공감하는 짤",
  "이거 보고 안 웃으면 거짓말",
  "새벽 3시에 보면 더 웃김",
  "엄마한테 보여줬더니 '뭐가 웃기냐' 함",
  "전세계 공통 짤.jpg",
  "이거 실화냐고 ㅋㅋㅋ",
  "아 진짜 이거 너무 공감되는데",
  "수업시간에 이거 보다가 걸림",
  "친구한테 카톡으로 보냈는데 씹힘",
  "외국인도 공감한다는 한국 밈",
];

const FALLBACK_TITLES_JP = [
  "日本人なら絶対わかるやつ",
  "深夜3時に見ると余計面白い",
  "これ見て笑わない人いないでしょ",
  "全世界共通ミーム",
  "草すぎるんだが",
];

// ── Fake usernames per country ──────────────────────────
const USERNAME_PATTERNS: Record<string, string[]> = {
  KR: ["meme_왕", "짤_마스터", "밈_사냥꾼", "레전드_짤러", "한국밈", "서울_시민", "부산_사람", "밈_장인", "웃김_담당", "짤_수집가", "대학생_일상", "한국인_특", "김밈", "이짤", "박웃김", "최레전드", "정밈러", "강짤장", "조밈왕", "윤짤러"],
  US: ["meme_lord", "dank_dealer", "chad_memer", "sigma_memes", "based_posts", "reddit_king", "tiktok_repost", "vine_energy", "gen_z_memes", "boomer_humor", "florida_man", "nyc_vibes", "la_memes", "texas_yall", "midwest_emo", "college_memes", "office_humor", "dad_jokes_inc", "cursed_content", "blessed_memes"],
  JP: ["ミーム職人", "草生える", "日本のミーム", "面白画像", "ネタ師", "2ch民", "草大量", "meme_samurai", "tokyo_memer", "osaka_neta", "anime_memes", "otaku_humor", "neko_meme", "jp_dank", "nihon_meme"],
  CN: ["梗王", "沙雕网友", "表情包达人", "段子手", "meme大师", "中国梗", "搞笑日常", "网络冲浪", "梗图制造", "段子王"],
  TW: ["台灣迷因", "梗圖王", "搞笑台灣", "meme_tw"],
  ES: ["meme_español", "humor_latino", "momazo_mx", "jaja_memes", "el_memero"],
  MX: ["memes_mx", "el_shitposter", "naco_memes", "taquero_memer", "mexico_memes"],
  IN: ["desi_memer", "indian_memes", "chai_and_memes", "bollywood_memes", "jugaad_memer", "mumbai_humor"],
  GB: ["british_humour", "innit_memes", "cheeky_memer", "london_lad", "uk_banter"],
  SA: ["ميمز_عربي", "الضحك_العربي", "نكت_سعودية"],
  EG: ["نكت_مصرية", "ميمز_مصر"],
  AU: ["straya_memes", "aussie_humor", "outback_memer"],
};

// ── Comment templates ───────────────────────────────────
const COMMENTS: Record<string, string[]> = {
  en: [
    "LMAOOO 💀💀", "This is so accurate", "I feel personally attacked", "Sent this to everyone I know",
    "Why is this the funniest thing I've seen today", "BRO 😭😭", "The accuracy tho", "W meme",
    "I can't unsee this now", "Peak comedy right here", "This deserves more upvotes", "Crying rn",
    "My sense of humor is broken because this is hilarious", "Global meme supremacy 🌍",
    "As an American, I approve this message", "Every country relates to this fr",
    "Adding this to my collection", "Bro 💀💀 I'm dead", "This is art", "Chef's kiss 🤌",
  ],
  ko: [
    "ㅋㅋㅋㅋㅋ 진짜", "아 개웃기네 ㅋㅋ", "이거 레전드다", "공감 100%", "미친 ㅋㅋㅋㅋ",
    "ㅇㅈ", "와 이건 좀...", "아 진짜 웃겨서 저장함", "찐이다", "이거 실화?",
    "한국인 특 ㅋㅋ", "ㅋㅋㅋ 나만 그런 줄", "이거 보는 사람 다 공감 가능",
    "전세계 사람들이 다 웃기네", "번역 퀄 미쳤다 ㅋㅋ", "ㅋㅋ 대박",
  ],
  ja: [
    "草www", "これはやばいw", "わかりすぎて辛い", "全世界共通で草",
    "日本人として同意", "めちゃくちゃ面白い", "保存した", "神ミーム",
    "翻訳すごい", "ワロタ", "これは伝説",
  ],
  zh: [
    "哈哈哈哈笑死", "太真实了", "全球通用表情包", "收藏了", "绝了",
    "笑到停不下来", "这翻译也太好了", "万国共通的快乐",
  ],
  es: [
    "JAJAJAJA 😂", "Demasiado real", "Me siento atacado", "Meme global verificado",
    "No puedo más 💀", "Genial la traducción", "Esto es arte",
  ],
  hi: [
    "😂😂 bhai", "Too relatable yaar", "Hahaha so true", "India approved ✅",
    "Global meme energy", "Best meme today",
  ],
  ar: [
    "😂😂😂 والله", "هذا حقيقي جدا", "ميم عالمي", "ضحكت كثير",
    "ترجمة ممتازة", "اعتمد ✅",
  ],
};

// ── Helpers ──────────────────────────────────────────────
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(weights: { id: string; weight: number; lang: LanguageCode }[]) {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w;
  }
  return weights[0];
}

function randomDate(daysBack: number) {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

function hashPassword(pw: string) {
  // Simple hash for fake users — not bcrypt since these are fake accounts
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function getAllImageFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllImageFiles(fullPath));
    } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// ── Main ────────────────────────────────────────────────
async function main() {
  const memeDir = process.argv[2];
  if (!memeDir) {
    console.error("Usage: npx tsx scripts/seed-memes.ts <meme-folder-path>");
    process.exit(1);
  }

  const imageFiles = getAllImageFiles(memeDir);
  console.log(`Found ${imageFiles.length} meme images`);

  // 1. Create upload directory
  const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
  fs.mkdirSync(uploadDir, { recursive: true });

  // 2. Create ~200 users across countries
  console.log("\n📌 Creating users...");
  const users: { id: string; countryId: string; lang: LanguageCode }[] = [];

  for (let i = 0; i < TOTAL_USERS; i++) {
    const country = weightedPick(COUNTRY_WEIGHTS);
    const countryUsernames = USERNAME_PATTERNS[country.id] || USERNAME_PATTERNS["US"];
    const baseUsername = pick(countryUsernames);
    const username = `${baseUsername}_${rand(1, 999)}`;
    const displayName = baseUsername.replace(/_/g, " ").replace(/\d+/g, "").trim();

    try {
      const user = await prisma.user.create({
        data: {
          email: `${username}@seed.lolympic.com`,
          username,
          displayName: displayName || username,
          passwordHash: hashPassword("seedpassword123"),
          countryId: country.id,
          preferredLanguage: country.lang,
          role: "USER",
          emailVerified: randomDate(90),
          createdAt: randomDate(90),
        },
      });
      users.push({ id: user.id, countryId: country.id, lang: country.lang });
    } catch {
      // Username/email collision — skip
      i--;
      continue;
    }

    if ((i + 1) % 50 === 0) console.log(`  Created ${i + 1}/${TOTAL_USERS} users`);
  }
  console.log(`✅ Created ${users.length} users`);

  // 3. Upload memes and create posts
  console.log("\n📌 Creating posts...");
  const posts: { id: string; authorId: string; lang: LanguageCode }[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    const fileName = path.basename(filePath);
    const author = pick(users);

    // Copy image to uploads
    const ext = path.extname(fileName);
    const newFileName = `seed_${Date.now()}_${rand(1000, 9999)}${ext}`;
    const destPath = path.join(uploadDir, newFileName);
    fs.copyFileSync(filePath, destPath);
    const imageUrl = `/uploads/${newFileName}`;

    // Determine title
    let title: string;
    let sourceLang: LanguageCode;
    let tags: string[];

    const known = MEME_TITLES[fileName];
    if (known) {
      title = known.title;
      sourceLang = known.lang;
      tags = known.tags;
    } else {
      // Pick language based on author's country
      const langMap: Record<string, LanguageCode> = { KR: "ko", JP: "ja", CN: "zh", TW: "zh", ES: "es", MX: "es", IN: "hi", SA: "ar", EG: "ar" };
      sourceLang = langMap[author.countryId] || "en";

      if (sourceLang === "ko") {
        title = pick(FALLBACK_TITLES_KO);
      } else if (sourceLang === "ja") {
        title = pick(FALLBACK_TITLES_JP);
      } else {
        title = pick(FALLBACK_TITLES_EN);
      }
      tags = ["meme", "global", "funny"];
    }

    const post = await prisma.post.create({
      data: {
        authorId: author.id,
        countryId: author.countryId,
        title,
        body: null,
        category: "meme",
        tags,
        sourceLanguage: sourceLang,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        createdAt: randomDate(60),
        updatedAt: randomDate(30),
        images: {
          create: {
            originalUrl: imageUrl,
            orderIndex: 0,
          },
        },
      },
    });

    posts.push({ id: post.id, authorId: author.id, lang: sourceLang });
    console.log(`  [${i + 1}/${imageFiles.length}] "${title.substring(0, 40)}..." by ${author.countryId}`);
  }
  console.log(`✅ Created ${posts.length} posts`);

  // 4. Generate reactions (upvotes/downvotes)
  console.log("\n📌 Generating reactions...");
  let totalReactions = 0;

  for (const post of posts) {
    const numReactions = rand(REACTIONS_PER_POST_MIN, REACTIONS_PER_POST_MAX);
    const reactors = new Set<string>();

    for (let r = 0; r < numReactions; r++) {
      const reactor = pick(users);
      if (reactors.has(reactor.id) || reactor.id === post.authorId) continue;
      reactors.add(reactor.id);

      const types: ("FIRE" | "LAUGH" | "SKULL" | "HEART" | "CRY")[] = ["FIRE", "LAUGH", "SKULL", "HEART", "CRY"];
      const reactionType = pick(types);

      try {
        await prisma.postReaction.create({
          data: {
            postId: post.id,
            userId: reactor.id,
            type: reactionType,
            createdAt: randomDate(30),
          },
        });
        totalReactions++;
      } catch {
        // Duplicate — skip
      }
    }

    // Update cached count
    const reactionCount = await prisma.postReaction.count({
      where: { postId: post.id },
    });
    await prisma.post.update({
      where: { id: post.id },
      data: {
        reactionCount,
        viewCount: rand(numReactions * 2, numReactions * 10),
      },
    });
  }
  console.log(`✅ Created ${totalReactions} reactions`);

  // 5. Generate comments
  console.log("\n📌 Generating comments...");
  let totalComments = 0;

  for (const post of posts) {
    const numComments = rand(COMMENTS_PER_POST_MIN, COMMENTS_PER_POST_MAX);

    for (let c = 0; c < numComments; c++) {
      const commenter = pick(users);
      const langKey = (["en", "ko", "ja", "zh", "es", "hi", "ar"] as const).includes(commenter.lang as any)
        ? commenter.lang
        : "en";
      const commentTexts = COMMENTS[langKey] || COMMENTS["en"];
      const body = pick(commentTexts);

      try {
        await prisma.comment.create({
          data: {
            postId: post.id,
            authorId: commenter.id,
            body,
            language: commenter.lang,
            createdAt: randomDate(30),
          },
        });
        totalComments++;
      } catch {
        // Skip on error
      }
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { commentCount: numComments },
    });
  }
  console.log(`✅ Created ${totalComments} comments`);

  // 6. Generate some follows
  console.log("\n📌 Generating follows...");
  let totalFollows = 0;

  for (const user of users) {
    const numFollows = rand(0, 15);
    for (let f = 0; f < numFollows; f++) {
      const target = pick(users);
      if (target.id === user.id) continue;
      try {
        await prisma.follow.create({
          data: {
            followerId: user.id,
            followingId: target.id,
            createdAt: randomDate(60),
          },
        });
        totalFollows++;
      } catch {
        // Duplicate — skip
      }
    }
  }
  console.log(`✅ Created ${totalFollows} follows`);

  // 7. Update post ranking scores
  console.log("\n📌 Updating ranking scores...");
  for (const post of posts) {
    const reactions = await prisma.postReaction.count({ where: { postId: post.id } });
    const comments = await prisma.comment.count({ where: { postId: post.id } });
    const score = reactions * 10 + comments * 5 + rand(0, 100);

    await prisma.post.update({
      where: { id: post.id },
      data: { rankingScore: score },
    });
  }

  // 8. Summary
  console.log("\n" + "═".repeat(50));
  console.log("🎉 SEED COMPLETE!");
  console.log("═".repeat(50));
  console.log(`👥 Users:     ${users.length}`);
  console.log(`📸 Posts:     ${posts.length}`);
  console.log(`👍 Reactions: ${totalReactions}`);
  console.log(`💬 Comments:  ${totalComments}`);
  console.log(`🤝 Follows:   ${totalFollows}`);
  console.log("═".repeat(50));
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
