import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { LanguageCode } from "@prisma/client";
import { updateRankingScore } from "@/lib/ranking";
import { needsPivot, buildEnglishReferenceForText } from "@/lib/pivot-translation";

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// ---------------------------------------------------------------------------
// Language-specific translation instructions
// ---------------------------------------------------------------------------
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  ko: "Korean (한국어): Use short, punchy expressions. Meme culture in Korea favors 급식체 (school cafeteria slang), 신조어, and rhythmic wordplay. Keep sentences compact. Prefer colloquial register over formal.",
  ja: "Japanese (日本語): Subtle and restrained humor. Use appropriate levels of politeness for comedic effect. Japanese memes often rely on understatement, ツッコミ/ボケ dynamics, and visual puns. Preserve any double-meaning wordplay.",
  zh: "Chinese (中文): Compact and efficient. Chinese internet humor uses 网络用语, four-character idioms twisted for comedy, and phonetic puns. Keep character count low. Maximize impact per character.",
  en: "English: Sarcastic and exaggerated. English memes lean into irony, self-deprecation, and absurdist escalation. Use internet-native phrasing (all caps for emphasis, deliberate misspellings for tone). Match the energy.",
  es: "Spanish (Español): Expressive and colloquial. Spanish memes use regional slang, diminutives for comedic effect, and exaggerated emotion. Capture the warmth and dramatic flair. Consider Latin American vs. Iberian variations.",
  hi: "Hindi (हिन्दी): Bollywood-influenced humor with dramatic flair. Hindi memes use Hinglish (Hindi-English mix), filmi dialogues, and cultural references. Use colloquial Delhi/Mumbai street Hindi for authenticity. Embrace the dramatic and emotional style.",
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
  body: string | null,
  englishReference?: string
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
${englishReference || ""}
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
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    });

    // Helper: translate a single language and store result
    const translateOne = async (
      targetLang: string,
      englishRef?: string
    ) => {
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

      const prompt = buildTextTranslationPrompt(
        sourceLanguage,
        targetLang,
        post.title!,
        post.body,
        englishRef
      );

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

        // Note: translationCount is incremented by the main /api/translate route
        // to avoid double-counting when both text and image APIs are called

        return translationPayload;
      });

      return {
        lang: targetLang,
        translatedTitle: parsed.title,
        translatedBody: parsed.body,
        status: "completed" as const,
        payloadId: payload.id,
      };
    };

    // Separate languages into direct vs pivot groups
    const langs = targetLanguages.filter((lang) => lang !== sourceLanguage);
    const pivotLangs = langs.filter((lang) => needsPivot(sourceLanguage, lang));
    const directLangs = langs.filter((lang) => !needsPivot(sourceLanguage, lang));

    // Phase 1: Translate English first if any language needs pivot (and English is a target)
    let englishRef: string | undefined;
    if (pivotLangs.length > 0 && sourceLanguage !== "en") {
      // Translate English first (or retrieve from DB) — retry once on failure
      let enResult;
      try {
        enResult = await translateOne("en");
      } catch {
        console.warn("[Pivot] English translation failed, retrying once...");
        await new Promise((r) => setTimeout(r, 1000));
        try { enResult = await translateOne("en"); } catch { /* give up */ }
      }
      if (enResult?.status === "completed" && enResult.translatedTitle) {
        englishRef = buildEnglishReferenceForText(enResult.translatedTitle, enResult.translatedBody);
        console.debug(`[Pivot] English reference ready for ${pivotLangs.join(",")} (post ${postId})`);
      } else {
        console.warn(`[Pivot] English reference unavailable — pivot languages will use direct translation`);
      }
      // Remove "en" from directLangs if it was there (already translated)
      const enIdx = directLangs.indexOf("en");
      if (enIdx !== -1) directLangs.splice(enIdx, 1);
    }

    // Phase 2: Translate all remaining languages in parallel
    const translationPromises = [
      ...directLangs.map((lang) => translateOne(lang)),
      ...pivotLangs.map((lang) => translateOne(lang, englishRef)),
    ];

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
