/**
 * Seed script: Generates culture notes for posts that don't have them.
 *
 * Usage:
 *   npx tsx scripts/seed-culture-notes.ts
 *   npx tsx scripts/seed-culture-notes.ts --limit 5
 */

import { PrismaClient, LanguageCode } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

// Load .env
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(path.resolve(__dirname, "../.env"));
let envDir = process.cwd();
for (let i = 0; i < 5; i++) {
  const p = path.join(envDir, ".env");
  if (fs.existsSync(p)) { loadEnvFile(p); break; }
  envDir = path.dirname(envDir);
}

const prisma = new PrismaClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) { console.error("GEMINI_API_KEY required"); process.exit(1); }

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const ALL_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const POST_LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;

const LANG_NAMES: Record<string, string> = {
  ko: "Korean", en: "English", ja: "Japanese", zh: "Chinese",
  es: "Spanish", hi: "Hindi", ar: "Arabic",
};

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function generateCultureNotes(
  title: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<{ summary: string; explanation: string; translationNote: string }> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  });

  const prompt = `You are a culture expert for mimzy, a global meme translation platform.

Generate a culture note for the following meme post, explaining cultural context to a ${LANG_NAMES[targetLanguage] || targetLanguage} audience.

Meme title (original in ${LANG_NAMES[sourceLanguage] || sourceLanguage}): "${title}"

IMPORTANT: Write ALL fields in ${LANG_NAMES[targetLanguage] || targetLanguage} language.

Return JSON only (no markdown fences):
{
  "summary": "One-line cultural context summary (in ${LANG_NAMES[targetLanguage]})",
  "explanation": "Detailed explanation of the humor, cultural references, and why this is funny across cultures (2-3 sentences in ${LANG_NAMES[targetLanguage]})",
  "translationNote": "Notes about any cultural adaptation needed when translating this meme (1-2 sentences in ${LANG_NAMES[targetLanguage]})"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = stripMarkdownFences(text);
  return JSON.parse(cleaned);
}

async function main() {
  console.log("═".repeat(60));
  console.log("📚 SEED CULTURE NOTES");
  console.log("═".repeat(60));

  // Find posts without culture notes
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      cultureNotes: { none: {} },
    },
    select: {
      id: true,
      title: true,
      sourceLanguage: true,
    },
    orderBy: { createdAt: "desc" },
    ...(POST_LIMIT ? { take: POST_LIMIT } : {}),
  });

  console.log(`Found ${posts.length} posts without culture notes\n`);

  if (posts.length === 0) {
    console.log("All posts already have culture notes!");
    return;
  }

  let totalCreated = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    if (!post.title) continue;

    const targetLangs = ALL_LANGUAGES.filter((l) => l !== post.sourceLanguage);
    let created = 0;

    for (const targetLang of targetLangs) {
      try {
        // Check if note already exists
        const existing = await prisma.cultureNote.findFirst({
          where: { postId: post.id, language: targetLang },
        });
        if (existing) { created++; continue; }

        const note = await generateCultureNotes(post.title, post.sourceLanguage, targetLang);

        const latestNote = await prisma.cultureNote.findFirst({
          where: { postId: post.id },
          orderBy: { version: "desc" },
        });
        const nextVersion = (latestNote?.version ?? 0) + 1;

        await prisma.cultureNote.create({
          data: {
            postId: post.id,
            language: targetLang,
            summary: note.summary,
            explanation: note.explanation,
            translationNote: note.translationNote,
            creatorType: "AI",
            status: "PUBLISHED",
            confidence: 0.85,
            version: nextVersion,
          },
        });
        created++;
        totalCreated++;

        await sleep(200); // Rate limit buffer
      } catch (err) {
        console.warn(`    Failed ${targetLang}:`, err instanceof Error ? err.message : String(err));
        await sleep(500);
      }
    }

    const titlePreview = post.title.substring(0, 35);
    console.log(`  [${i + 1}/${posts.length}] "${titlePreview}..." → ${created}/${targetLangs.length} notes ✅`);

    if ((i + 1) % 10 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${posts.length} (${Math.round(((i + 1) / posts.length) * 100)}%)\n`);
    }

    await sleep(300);
  }

  const totalNotes = await prisma.cultureNote.count();
  console.log("\n" + "═".repeat(60));
  console.log("🎉 CULTURE NOTES COMPLETE!");
  console.log("═".repeat(60));
  console.log(`📚 New notes created: ${totalCreated}`);
  console.log(`📚 Total culture notes: ${totalNotes}`);
  console.log("═".repeat(60));
}

main()
  .catch((e) => { console.error("Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
