import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LanguageCode } from "@prisma/client";
import { updateRankingScore } from "@/lib/ranking";

export const maxDuration = 60;

let _genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
}

// ---------------------------------------------------------------------------
// Language-specific translation instructions
// ---------------------------------------------------------------------------
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  ko: "Korean (한국어): CRITICAL — Preserve the ORIGINAL MEANING accurately first. Do NOT replace with unrelated Korean idioms or food expressions. Translate naturally using everyday Korean (반말 또는 자연스러운 구어체). Keep sentences compact. Korean slang (신조어) is OK only when it directly matches the original meaning — never substitute meaning with unrelated slang.",
  ja: "Japanese (日本語): Subtle and restrained humor. Use appropriate levels of politeness for comedic effect. Japanese memes often rely on understatement, ツッコミ/ボケ dynamics, and visual puns. Preserve any double-meaning wordplay.",
  zh: "Chinese (中文): Compact and efficient. Chinese internet humor uses 网络用语, four-character idioms twisted for comedy, and phonetic puns. Keep character count low. Maximize impact per character.",
  en: "English: Sarcastic and exaggerated. English memes lean into irony, self-deprecation, and absurdist escalation. Use internet-native phrasing (all caps for emphasis, deliberate misspellings for tone). Match the energy.",
  es: "Spanish (Español): Expressive and colloquial. Spanish memes use regional slang, diminutives for comedic effect, and exaggerated emotion. Capture the warmth and dramatic flair. Consider Latin American vs. Iberian variations.",
  hi: "Hinglish (Roman script Hindi): CRITICAL — Write ALL Hindi text in Roman/Latin script (e.g. 'Bhai ye kya hai' NOT 'भाई ये क्या है'). NEVER use Devanagari script. Bollywood-influenced humor with dramatic flair. Use Hinglish (Hindi-English mix), filmi dialogues, and cultural references. Use colloquial Delhi/Mumbai street Hindi for authenticity. Embrace the dramatic and emotional style. Think Instagram/Twitter Indian meme culture — always Roman script.",
  ar: "Arabic (العربية): Rich and expressive. Arabic memes blend Modern Standard Arabic with dialect (Egyptian/Gulf). Use internet-native Arabic expressions, cultural references, and wordplay. Keep it casual and relatable. Use Egyptian dialect when unsure.",
};

const ALL_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isValidLanguageCode(code: string): code is LanguageCode {
  return ALL_LANGUAGES.includes(code as LanguageCode);
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

// ---------------------------------------------------------------------------
// Build prompt for text-only translation
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST /api/translate/text
// Accepts { postId, sourceLanguage, targetLanguages?: string[] }
// If targetLanguages not provided, translates to all 6 other languages.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rlKey = getRateLimitKey(request.headers, "translate-text");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    // Auth
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const reqBody = await request.json();
    const {
      postId,
      sourceLanguage,
      targetLanguages: rawTargetLanguages,
    }: {
      postId: string;
      sourceLanguage: string;
      targetLanguages?: string[];
    } = reqBody;

    if (!postId || !sourceLanguage) {
      return NextResponse.json(
        { error: "Missing required fields: postId, sourceLanguage" },
        { status: 400 }
      );
    }

    if (!isValidLanguageCode(sourceLanguage)) {
      return NextResponse.json(
        { error: `Invalid source language: ${sourceLanguage}` },
        { status: 400 }
      );
    }

    // Default to all other languages if targetLanguages not provided
    const targetLanguages = rawTargetLanguages ?? ALL_LANGUAGES.filter((l) => l !== sourceLanguage);

    for (const lang of targetLanguages) {
      if (!isValidLanguageCode(lang)) {
        return NextResponse.json(
          { error: `Invalid target language: ${lang}` },
          { status: 400 }
        );
      }
    }

    // Fetch post from DB
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        body: true,
        sourceLanguage: true,
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!post.title) {
      return NextResponse.json(
        { error: "Post has no title to translate" },
        { status: 400 }
      );
    }

    // Set up Gemini model
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    // --- Pivot translation: translate English first for distant language pairs ---
    const { needsPivot, buildEnglishReferenceForText } = await import("@/lib/pivot-translation");
    const filteredLangs = targetLanguages.filter((lang) => lang !== sourceLanguage);
    const hasDistantPairs = filteredLangs.some(tl => needsPivot(sourceLanguage, tl));
    const needsEnglishFirst = hasDistantPairs && sourceLanguage !== "en";

    // Translate English first if needed for pivot
    let pivotEnTitle: string | null = null;
    let pivotEnBody: string | null = null;

    if (needsEnglishFirst) {
      // Check if English translation already exists
      const existingEn = await prisma.translationPayload.findFirst({
        where: { postId, targetLanguage: "en" as LanguageCode, status: { in: ["COMPLETED", "APPROVED"] } },
        orderBy: { version: "desc" },
        select: { translatedTitle: true, translatedBody: true },
      });
      if (existingEn?.translatedTitle) {
        pivotEnTitle = existingEn.translatedTitle;
        pivotEnBody = existingEn.translatedBody;
      } else {
        try {
          const enPrompt = buildTextTranslationPrompt(sourceLanguage, "en", post.title!, post.body);
          const enResult = await model.generateContent(enPrompt);
          const enParsed = JSON.parse(stripMarkdownFences(enResult.response.text()));
          pivotEnTitle = enParsed.title;
          pivotEnBody = enParsed.body;
        } catch (e) {
          console.warn("[Pivot] English pre-translation failed, continuing without pivot:", e);
        }
      }
    }

    // Translate all languages in parallel with Promise.allSettled
    const translationPromises = filteredLangs
      .map(async (targetLang) => {
        // --- DB check: skip if translation already exists ---
        const existingPayload = await prisma.translationPayload.findFirst({
          where: {
            postId,
            targetLanguage: targetLang as LanguageCode,
            status: { in: ["COMPLETED", "APPROVED"] },
          },
          orderBy: { version: "desc" },
          select: { id: true, translatedTitle: true, translatedBody: true },
        });
        if (existingPayload?.translatedTitle) {
          console.debug(`[DB] Translation already exists for ${postId}:${targetLang}, skipping Gemini call`);
          return {
            lang: targetLang,
            translatedTitle: existingPayload.translatedTitle,
            translatedBody: existingPayload.translatedBody,
            status: "completed" as const,
            payloadId: existingPayload.id,
          };
        }

        // Add English reference for distant language pairs
        const pivotContext = needsPivot(sourceLanguage, targetLang) && pivotEnTitle
          ? buildEnglishReferenceForText(pivotEnTitle, pivotEnBody)
          : "";

        const prompt = buildTextTranslationPrompt(
          sourceLanguage,
          targetLang,
          post.title!,
          post.body
        ) + pivotContext;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleaned = stripMarkdownFences(responseText);
        const parsed: { title: string; body: string | null } = JSON.parse(cleaned);

        // Store TranslationPayload in DB with versioning
        const payload = await prisma.$transaction(async (tx) => {
          const latestPayload = await tx.translationPayload.findFirst({
            where: {
              postId,
              targetLanguage: targetLang as LanguageCode,
            },
            orderBy: { version: "desc" },
          });
          const nextVersion = (latestPayload?.version ?? 0) + 1;

          const translationPayload = await tx.translationPayload.create({
            data: {
              postId,
              sourceLanguage: sourceLanguage as LanguageCode,
              targetLanguage: targetLang as LanguageCode,
              version: nextVersion,
              status: "COMPLETED",
              memeType: "TEXT",
              translatedTitle: parsed.title,
              translatedBody: parsed.body,
              creatorType: "AI",
              creatorId: null,
            },
          });

          // Update post translation count
          await tx.post.update({
            where: { id: postId },
            data: { translationCount: { increment: 1 } },
          });

          return translationPayload;
        });

        return {
          lang: targetLang,
          translatedTitle: parsed.title,
          translatedBody: parsed.body,
          status: "completed" as const,
          payloadId: payload.id,
        };
      });

    const settled = await Promise.allSettled(translationPromises);

    // Build response
    const translations: Record<
      string,
      {
        translatedTitle: string;
        translatedBody: string | null;
        status: "completed" | "failed";
        error?: string;
        payloadId?: string;
      }
    > = {};

    for (const result of settled) {
      if (result.status === "fulfilled") {
        const { lang, translatedTitle, translatedBody, status, payloadId } = result.value;
        translations[lang] = { translatedTitle, translatedBody, status, payloadId };
      } else {
        const errorMsg =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error("Text translation failed:", errorMsg);
      }
    }

    // Mark failed languages
    for (const lang of targetLanguages) {
      if (lang !== sourceLanguage && !translations[lang]) {
        translations[lang] = {
          translatedTitle: "",
          translatedBody: null,
          status: "failed",
          error: "Translation failed",
        };
      }
    }

    // Update ranking score (non-fatal)
    try {
      await updateRankingScore(postId);
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ translations });
  } catch (err) {
    console.error("Text translation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
