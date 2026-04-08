import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const VALID_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Language-specific translation instructions (same as translate/text/route.ts)
// ---------------------------------------------------------------------------
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  ko: "Korean (한국어): Use short, punchy expressions. Meme culture in Korea favors 급식체 (school cafeteria slang), 신조어, and rhythmic wordplay. Keep sentences compact. Prefer colloquial register over formal.",
  ja: "Japanese (日本語): Subtle and restrained humor. Use appropriate levels of politeness for comedic effect. Japanese memes often rely on understatement, ツッコミ/ボケ dynamics, and visual puns. Preserve any double-meaning wordplay.",
  zh: "Chinese (中文): Compact and efficient. Chinese internet humor uses 网络用语, four-character idioms twisted for comedy, and phonetic puns. Keep character count low. Maximize impact per character.",
  en: "English: Sarcastic and exaggerated. English memes lean into irony, self-deprecation, and absurdist escalation. Use internet-native phrasing (all caps for emphasis, deliberate misspellings for tone). Match the energy.",
  es: "Spanish (Español): Expressive and colloquial. Spanish memes use regional slang, diminutives for comedic effect, and exaggerated emotion. Capture the warmth and dramatic flair. Consider Latin American vs. Iberian variations.",
  hi: "Hinglish (Roman script Hindi): CRITICAL — Write ALL Hindi text in Roman/Latin script (e.g. 'Bhai ye kya hai' NOT 'भाई ये क्या है'). NEVER use Devanagari script. Bollywood-influenced humor with dramatic flair. Use Hinglish (Hindi-English mix), filmi dialogues, and cultural references. Use colloquial Delhi/Mumbai street Hindi for authenticity. Embrace the dramatic and emotional style. Think Instagram/Twitter Indian meme culture — always Roman script.",
  ar: "Arabic (العربية): Rich and expressive. Arabic memes blend Modern Standard Arabic with dialect (Egyptian/Gulf). Use internet-native Arabic expressions, cultural references, and wordplay. Keep it casual and relatable. Use Egyptian dialect when unsure.",
};

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

function buildTextTranslationPrompt(
  sourceLanguage: string,
  targetLanguage: string,
  title: string,
  body: string | null
): string {
  const sourceLangInstruction =
    LANGUAGE_INSTRUCTIONS[sourceLanguage] || `Source language: ${sourceLanguage}`;
  const targetLangInstruction =
    LANGUAGE_INSTRUCTIONS[targetLanguage] || `Target language: ${targetLanguage}`;

  return `You are translating a community post on mimzy, a global meme translation platform.
Translate naturally — match the tone and style of the original.
If it's casual, keep it casual. If it's a question, keep the question format.

Source language: ${sourceLangInstruction}
Target language: ${targetLangInstruction}

Translate the following:
Title: ${title}
${body ? `Body: ${body}` : "Body: (none)"}

Return JSON only (no markdown fences): { "title": "translated title", "body": "translated body or null if no body" }`;
}

/**
 * POST /api/admin/retranslate
 *
 * Deletes existing translations for specified languages, then retranslates
 * title/body directly via Gemini. Image translations are regenerated
 * automatically when users visit the post.
 *
 * Body: { targetLanguages: ["hi", "ar"], batchSize?: number }
 */
export async function POST(request: NextRequest) {
  try {
    // Admin auth
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      targetLanguages,
      batchSize = 5,
    }: { targetLanguages: string[]; batchSize?: number } = body;

    if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: "targetLanguages is required (array of language codes)" },
        { status: 400 }
      );
    }

    for (const lang of targetLanguages) {
      if (!VALID_LANGUAGES.includes(lang as LanguageCode)) {
        return NextResponse.json(
          { error: `Invalid language code: ${lang}` },
          { status: 400 }
        );
      }
    }

    const safeBatchSize = Math.min(Math.max(batchSize, 1), 20);
    const langCodes = targetLanguages as LanguageCode[];

    // Step 1: Find all postIds that have translations in target languages
    const affectedPayloads = await prisma.translationPayload.findMany({
      where: { targetLanguage: { in: langCodes } },
      select: { postId: true },
      distinct: ["postId"],
    });
    const affectedPostIds = affectedPayloads.map((p) => p.postId);

    if (affectedPostIds.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          languages: targetLanguages,
          totalPosts: 0,
          deletedPayloads: 0,
          deletedNotes: 0,
          retranslated: 0,
          failed: 0,
          errors: [],
        },
      });
    }

    // Step 2: Delete existing translations for target languages
    const deleteResult = await prisma.$transaction(async (tx) => {
      const deletedNotes = await tx.cultureNote.deleteMany({
        where: {
          language: { in: langCodes },
          postId: { in: affectedPostIds },
        },
      });

      const deletedPayloads = await tx.translationPayload.deleteMany({
        where: { targetLanguage: { in: langCodes } },
      });

      // Recalculate translation counts
      for (const postId of affectedPostIds) {
        const remainingCount = await tx.translationPayload.count({
          where: { postId, status: { in: ["COMPLETED", "APPROVED"] } },
        });
        await tx.post.update({
          where: { id: postId },
          data: { translationCount: remainingCount },
        });
      }

      return {
        deletedPayloads: deletedPayloads.count,
        deletedNotes: deletedNotes.count,
      };
    });

    // Step 3: Get posts that need retranslation
    const postsToRetranslate = await prisma.post.findMany({
      where: {
        id: { in: affectedPostIds },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        title: true,
        body: true,
        sourceLanguage: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Step 4: Retranslate title/body directly via Gemini
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    let retranslated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < postsToRetranslate.length; i += safeBatchSize) {
      const batch = postsToRetranslate.slice(i, i + safeBatchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (post) => {
          if (!post.title) return;

          const targets = langCodes.filter((l) => l !== post.sourceLanguage);
          if (targets.length === 0) return;

          // Translate to each target language
          for (const targetLang of targets) {
            try {
              const prompt = buildTextTranslationPrompt(
                post.sourceLanguage || "ko",
                targetLang,
                post.title,
                post.body
              );

              const result = await model.generateContent(prompt);
              const responseText = result.response.text();
              const cleaned = stripMarkdownFences(responseText);
              const parsed: { title: string; body: string | null } = JSON.parse(cleaned);

              // Create new TranslationPayload (text-only, no segments)
              // Image segments will be generated when user visits the post
              await prisma.$transaction(async (tx) => {
                const latestPayload = await tx.translationPayload.findFirst({
                  where: { postId: post.id, targetLanguage: targetLang },
                  orderBy: { version: "desc" },
                });
                const nextVersion = (latestPayload?.version ?? 0) + 1;

                await tx.translationPayload.create({
                  data: {
                    postId: post.id,
                    sourceLanguage: (post.sourceLanguage || "ko") as LanguageCode,
                    targetLanguage: targetLang,
                    version: nextVersion,
                    status: "COMPLETED",
                    memeType: "TEXT",
                    translatedTitle: parsed.title,
                    translatedBody: parsed.body,
                    creatorType: "AI",
                    creatorId: null,
                  },
                });

                await tx.post.update({
                  where: { id: post.id },
                  data: { translationCount: { increment: 1 } },
                });
              });
            } catch (err) {
              console.warn(`[Retranslate] Failed ${post.id}:${targetLang}:`, err instanceof Error ? err.message : String(err));
            }
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          retranslated++;
        } else {
          failed++;
          errors.push(
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          );
        }
      }

      // Delay between batches to avoid Gemini rate limits
      if (i + safeBatchSize < postsToRetranslate.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        languages: targetLanguages,
        totalPosts: affectedPostIds.length,
        deletedPayloads: deleteResult.deletedPayloads,
        deletedNotes: deleteResult.deletedNotes,
        retranslated,
        failed,
        errors: errors.slice(0, 10),
      },
    });
  } catch (err) {
    console.error("Retranslate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
