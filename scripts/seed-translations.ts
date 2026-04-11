/**
 * Seed script: Translates all existing posts that don't have translations yet.
 *
 * Usage:
 *   npx tsx scripts/seed-translations.ts
 *
 * Options:
 *   --limit N        Only translate first N posts (default: all)
 *   --title-only     Only translate titles (skip image analysis)
 *   --concurrency N  Parallel translations (default: 2)
 *
 * Requires:
 *   - GEMINI_API_KEY in .env
 *   - DATABASE_URL in .env
 */

import { PrismaClient, LanguageCode } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// Load .env manually (no dotenv dependency)
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(__dirname, "../.env"));
// Also check main repo root (for worktree setups)
loadEnvFile(path.resolve(__dirname, "../../.env"));
loadEnvFile(path.resolve(__dirname, "../../../.env"));
// Try finding .env by walking up from cwd
let envDir = process.cwd();
for (let i = 0; i < 5; i++) {
  const envPath = path.join(envDir, ".env");
  if (fs.existsSync(envPath)) {
    loadEnvFile(envPath);
    break;
  }
  envDir = path.dirname(envDir);
}

const prisma = new PrismaClient();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is required in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const ALL_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

// ── CLI args ──
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const POST_LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;
const TITLE_ONLY = args.includes("--title-only");
const concIdx = args.indexOf("--concurrency");
const CONCURRENCY = concIdx !== -1 ? parseInt(args[concIdx + 1], 10) : 2;

// ── Language instructions ──
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  ko: "Korean (한국어): CRITICAL — Preserve the ORIGINAL MEANING accurately first. Do NOT replace with unrelated Korean idioms or food expressions. Translate naturally using everyday Korean. Keep sentences compact.",
  ja: "Japanese (日本語): Subtle and restrained humor. Use appropriate levels of politeness for comedic effect. Japanese memes often rely on understatement, ツッコミ/ボケ dynamics, and visual puns.",
  zh: "Chinese (中文): Compact and efficient. Chinese internet humor uses 网络用语, four-character idioms twisted for comedy, and phonetic puns. Keep character count low.",
  en: "English: Sarcastic and exaggerated. English memes lean into irony, self-deprecation, and absurdist escalation. Use internet-native phrasing.",
  es: "Spanish (Español): Expressive and colloquial. Spanish memes use regional slang, diminutives for comedic effect, and exaggerated emotion.",
  hi: "Hinglish (Roman script Hindi): CRITICAL — Write ALL Hindi in Roman/Latin script (e.g. 'Bhai ye kya hai' NOT Devanagari). Bollywood-influenced humor, filmi dialogues, cultural references. Always Roman script.",
  ar: "Arabic (العربية): Rich and expressive. Arabic memes blend Modern Standard Arabic with dialect (Egyptian/Gulf). Use internet-native Arabic expressions.",
};

// ── Helpers ──
function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

function toSemanticRole(role: string): "HEADLINE" | "CAPTION" | "DIALOGUE" | "LABEL" | "WATERMARK" | "SUBTITLE" | "OVERLAY" | "OTHER" {
  const valid = ["HEADLINE", "CAPTION", "DIALOGUE", "LABEL", "WATERMARK", "SUBTITLE", "OVERLAY", "OTHER"] as const;
  const upper = role.toUpperCase();
  return (valid as readonly string[]).includes(upper) ? (upper as (typeof valid)[number]) : "OTHER";
}

function toTextAlign(align?: string): "LEFT" | "CENTER" | "RIGHT" {
  if (!align) return "CENTER";
  const upper = align.toUpperCase();
  if (upper === "LEFT" || upper === "CENTER" || upper === "RIGHT") return upper;
  return "CENTER";
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Read image as base64 ──
function readImageAsBase64(imageUrl: string): { base64: string; mimeType: string } | null {
  // Handle local uploads
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  let filePath: string;

  if (imageUrl.startsWith("/uploads/") || imageUrl.startsWith("/api/uploads/")) {
    const relativePath = imageUrl.replace(/^\/(api\/)?uploads\//, "");
    filePath = path.resolve(uploadDir, relativePath);
  } else if (imageUrl.startsWith("http")) {
    // Skip remote URLs for now
    return null;
  } else {
    filePath = path.resolve(imageUrl);
  }

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };

  return {
    base64: buffer.toString("base64"),
    mimeType: mimeMap[ext] || "image/jpeg",
  };
}

// ── Translate title + body to a target language ──
async function translateTitle(
  title: string,
  body: string | null,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<{ title: string; body: string | null }> {
  const sourceLang = LANGUAGE_INSTRUCTIONS[sourceLanguage] || sourceLanguage;
  const targetLang = LANGUAGE_INSTRUCTIONS[targetLanguage] || targetLanguage;

  const prompt = `You are translating a meme post on mimzy, a global meme translation platform.
Translate naturally — match the tone and style of the original.
If it's casual, keep it casual. If it's a question, keep the question format.

Source language: ${sourceLang}
Target language: ${targetLang}

Translate the following:
Title: ${title}
${body ? `Body: ${body}` : "Body: (none)"}

Return JSON only (no markdown fences): { "title": "translated title", "body": "translated body or null if no body" }`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = stripMarkdownFences(text);
  return JSON.parse(cleaned);
}

// ── Translate meme image (segments + culture note) ──
async function translateImage(
  imageBase64: string,
  mimeType: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<{
  memeType: string;
  segments: Array<{
    sourceText: string;
    translatedText: string;
    semanticRole: string;
    box: { x: number; y: number; width: number; height: number };
    style: Record<string, unknown>;
  }>;
  cultureNote: { summary: string; explanation: string; translationNote?: string };
  confidence: number;
} | null> {
  const sourceLang = LANGUAGE_INSTRUCTIONS[sourceLanguage] || sourceLanguage;
  const targetLang = LANGUAGE_INSTRUCTIONS[targetLanguage] || targetLanguage;

  const systemPrompt = `You are a world-class meme translator for mimzy, a global meme translation platform.

Your mission: Create TRANSCENDENT translations — not literal word-for-word conversions, but culturally adapted versions that hit just as hard in the target language.

## Core Principles
1. Preserve the FEELING: humor, rhythm, tone, punchline timing, emotional impact
2. Cultural adaptation > literal accuracy
3. Register matching: If the source is vulgar, the translation should be vulgar. If it's deadpan, stay deadpan.

## Source Language Context
${sourceLang}

## Target Language Instructions
${targetLang}

## CRITICAL: Detect meme type and translate accordingly
Type A — Overlay memes (Impact font captions): Translate ONLY overlay text
Type B — Screenshot/conversation memes: Translate ALL readable text
Type C — Multi-panel/comic memes: Translate ALL dialogue

## IMPORTANT: Write ALL cultureNote fields in the TARGET language (${targetLanguage}).

## Response Format (JSON only, no markdown fences)
{
  "memeType": "A|B|C",
  "segments": [
    {
      "sourceText": "original text",
      "translatedText": "transcendent translation",
      "semanticRole": "HEADLINE|CAPTION|DIALOGUE|LABEL|WATERMARK|SUBTITLE|OVERLAY|OTHER",
      "box": { "x": 0.0, "y": 0.0, "width": 0.5, "height": 0.1 },
      "style": {
        "fontFamily": "suggested font",
        "fontSize": 24,
        "fontWeight": 700,
        "color": "#FFFFFF",
        "textAlign": "CENTER",
        "strokeColor": "#000000",
        "strokeWidth": 2
      }
    }
  ],
  "cultureNote": {
    "summary": "One-line cultural context (in target language)",
    "explanation": "Detailed explanation (in target language)",
    "translationNote": "Translation decisions (in target language)"
  },
  "confidence": 0.85
}`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  });

  const result = await model.generateContent([
    `Translate this meme from ${sourceLanguage} to ${targetLanguage}. Analyze the image, detect all text regions, and provide transcendent translations. Respond ONLY with valid JSON, no markdown fences.`,
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
  ]);

  const text = result.response.text();
  if (!text) return null;

  const cleaned = stripMarkdownFences(text);
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) return null;
  return parsed;
}

// ── Process a single post ──
async function processPost(
  post: {
    id: string;
    title: string | null;
    body: string | null;
    sourceLanguage: LanguageCode;
    images: Array<{ originalUrl: string; mimeType: string | null }>;
  },
  postIndex: number,
  totalPosts: number,
) {
  const targetLangs = ALL_LANGUAGES.filter((l) => l !== post.sourceLanguage);
  const hasImage = post.images.length > 0 && !TITLE_ONLY;

  // Read image if available
  let imageData: { base64: string; mimeType: string } | null = null;
  if (hasImage) {
    imageData = readImageAsBase64(post.images[0].originalUrl);
  }

  let successCount = 0;
  let failCount = 0;

  // Process languages sequentially to avoid Gemini rate limits
  for (const targetLang of targetLangs) {
    try {
      // Check if translation already exists
      const existing = await prisma.translationPayload.findFirst({
        where: {
          postId: post.id,
          targetLanguage: targetLang,
        },
      });
      if (existing) {
        successCount++;
        continue; // Already translated
      }

      let translatedTitle: string | null = null;
      let translatedBody: string | null = null;
      let segments: Array<{
        sourceText: string;
        translatedText: string;
        semanticRole: string;
        box: { x: number; y: number; width: number; height: number };
        style: Record<string, unknown>;
      }> = [];
      let cultureNote: { summary: string; explanation: string; translationNote?: string } | null = null;
      let confidence: number | null = null;
      let memeType: string | null = null;

      // 1. Translate image (if available)
      if (imageData) {
        try {
          const imageResult = await translateImage(
            imageData.base64,
            imageData.mimeType,
            post.sourceLanguage,
            targetLang,
          );
          if (imageResult) {
            segments = imageResult.segments;
            cultureNote = imageResult.cultureNote;
            confidence = imageResult.confidence ?? null;
            memeType = imageResult.memeType ?? null;
          }
        } catch (err) {
          console.warn(`    Image translation failed for ${targetLang}:`, err instanceof Error ? err.message : String(err));
        }

        // Small delay between Gemini calls
        await sleep(500);
      }

      // 2. Translate title
      if (post.title) {
        try {
          const titleResult = await translateTitle(
            post.title,
            post.body,
            post.sourceLanguage,
            targetLang,
          );
          translatedTitle = titleResult.title;
          translatedBody = titleResult.body;
        } catch (err) {
          console.warn(`    Title translation failed for ${targetLang}:`, err instanceof Error ? err.message : String(err));
        }
      }

      // Skip if nothing was translated
      if (!translatedTitle && segments.length === 0) {
        failCount++;
        continue;
      }

      // 3. Store in DB
      await prisma.$transaction(async (tx) => {
        const latestPayload = await tx.translationPayload.findFirst({
          where: { postId: post.id, targetLanguage: targetLang },
          orderBy: { version: "desc" },
        });
        const nextVersion = (latestPayload?.version ?? 0) + 1;

        await tx.translationPayload.create({
          data: {
            postId: post.id,
            sourceLanguage: post.sourceLanguage,
            targetLanguage: targetLang,
            version: nextVersion,
            status: "COMPLETED",
            confidence,
            memeType: memeType || (imageData ? null : "TEXT"),
            translatedTitle,
            translatedBody,
            creatorType: "AI",
            creatorId: null,
            segments: segments.length > 0
              ? {
                  create: segments.map((seg, index) => ({
                    orderIndex: index,
                    imageIndex: 0,
                    sourceText: seg.sourceText,
                    translatedText: seg.translatedText,
                    semanticRole: toSemanticRole(seg.semanticRole),
                    boxX: seg.box?.x ?? null,
                    boxY: seg.box?.y ?? null,
                    boxWidth: seg.box?.width ?? null,
                    boxHeight: seg.box?.height ?? null,
                    fontFamily: (seg.style?.fontFamily as string) ?? null,
                    fontWeight: (seg.style?.fontWeight as number) ?? null,
                    fontSizePixels: (seg.style?.fontSize as number) ?? null,
                    color: (seg.style?.color as string) ?? null,
                    textAlign: toTextAlign(seg.style?.textAlign as string),
                    strokeColor: (seg.style?.strokeColor as string) ?? null,
                    strokeWidth: (seg.style?.strokeWidth as number) ?? null,
                    shadowColor: (seg.style?.shadowColor as string) ?? null,
                  })),
                }
              : undefined,
          },
        });

        // Create CultureNote
        if (cultureNote) {
          const existingNote = await tx.cultureNote.findFirst({
            where: { postId: post.id, language: targetLang },
          });
          if (!existingNote) {
            const latestNote = await tx.cultureNote.findFirst({
              where: { postId: post.id },
              orderBy: { version: "desc" },
            });
            const noteVersion = (latestNote?.version ?? 0) + 1;
            await tx.cultureNote.create({
              data: {
                postId: post.id,
                language: targetLang,
                summary: cultureNote.summary || "",
                explanation: cultureNote.explanation || "",
                translationNote: cultureNote.translationNote ?? null,
                creatorType: "AI",
                status: "PUBLISHED",
                confidence,
                version: noteVersion,
              },
            });
          }
        }

        // Update translation count
        await tx.post.update({
          where: { id: post.id },
          data: { translationCount: { increment: 1 } },
        });
      });

      successCount++;
      await sleep(300); // Rate limit buffer
    } catch (err) {
      failCount++;
      console.error(`    Error translating ${targetLang}:`, err instanceof Error ? err.message : String(err));
      await sleep(1000); // Extra delay on error
    }
  }

  const titlePreview = (post.title || "untitled").substring(0, 35);
  console.log(
    `  [${postIndex + 1}/${totalPosts}] "${titlePreview}..." (${post.sourceLanguage}) → ${successCount}/${targetLangs.length} langs ✅${failCount > 0 ? ` ${failCount} ❌` : ""}`,
  );
}

// ── Main ──
async function main() {
  console.log("═".repeat(60));
  console.log("🌍 SEED TRANSLATIONS");
  console.log("═".repeat(60));
  console.log(`Mode: ${TITLE_ONLY ? "Title-only" : "Full (image + title)"}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  if (POST_LIMIT) console.log(`Limit: ${POST_LIMIT} posts`);

  // Find posts without (or with incomplete) translations
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
    },
    select: {
      id: true,
      title: true,
      body: true,
      sourceLanguage: true,
      images: {
        orderBy: { orderIndex: "asc" },
        take: 1,
        select: { originalUrl: true, mimeType: true },
      },
      _count: {
        select: { translationPayloads: true },
      },
    },
    orderBy: { createdAt: "desc" },
    ...(POST_LIMIT ? { take: POST_LIMIT } : {}),
  });

  // Filter to posts that need more translations (< 6 target languages)
  const postsNeedingTranslation = posts.filter((p) => p._count.translationPayloads < 6);

  console.log(`\nFound ${posts.length} published posts, ${postsNeedingTranslation.length} need translations\n`);

  if (postsNeedingTranslation.length === 0) {
    console.log("All posts already have translations! Nothing to do.");
    return;
  }

  // Process posts with controlled concurrency
  let completed = 0;
  const total = postsNeedingTranslation.length;

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = postsNeedingTranslation.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map((post, batchIdx) =>
        processPost(
          {
            id: post.id,
            title: post.title,
            body: post.body,
            sourceLanguage: post.sourceLanguage,
            images: post.images,
          },
          i + batchIdx,
          total,
        ),
      ),
    );
    completed += batch.length;

    // Progress update
    if (completed % 10 === 0 || completed === total) {
      console.log(`\n📊 Progress: ${completed}/${total} posts (${Math.round((completed / total) * 100)}%)\n`);
    }

    // Rate limit buffer between batches
    if (i + CONCURRENCY < total) {
      await sleep(1000);
    }
  }

  // Update ranking scores for all translated posts
  console.log("\n📌 Updating ranking scores...");
  for (const post of postsNeedingTranslation) {
    const reactions = await prisma.postReaction.count({ where: { postId: post.id } });
    const comments = await prisma.comment.count({ where: { postId: post.id } });
    const translations = await prisma.translationPayload.count({ where: { postId: post.id } });
    const score = reactions * 10 + comments * 5 + translations * 20 + Math.floor(Math.random() * 100);

    await prisma.post.update({
      where: { id: post.id },
      data: { rankingScore: score },
    });
  }

  // Final summary
  const totalPayloads = await prisma.translationPayload.count();
  const totalNotes = await prisma.cultureNote.count();

  console.log("\n" + "═".repeat(60));
  console.log("🎉 SEED TRANSLATIONS COMPLETE!");
  console.log("═".repeat(60));
  console.log(`📝 Total TranslationPayloads: ${totalPayloads}`);
  console.log(`📚 Total CultureNotes: ${totalNotes}`);
  console.log("═".repeat(60));
}

main()
  .catch((e) => {
    console.error("Seed translations failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
