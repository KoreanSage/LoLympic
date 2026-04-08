import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const VALID_LANGUAGES = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

const LANGUAGE_NAMES: Record<string, string> = {
  ko: "Korean (한국어)",
  en: "English",
  ja: "Japanese (日本語)",
  zh: "Chinese (中文)",
  es: "Spanish (Español)",
  hi: "Hinglish (Roman script — NO Devanagari)",
  ar: "Arabic (العربية)",
};

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI;
}

// ---------------------------------------------------------------------------
// POST /api/translate/title — Translate a post title (and optionally body)
// Called client-side when a translation payload exists but has no translatedTitle
// Requires authentication to prevent unauthorized Gemini API usage.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Rate limit - AI translation call
    const rlKey = getRateLimitKey(request.headers, "translate-title");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    // Auth check
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, body: postBody, targetLanguage, payloadId } = body;

    if (!title || !targetLanguage || !payloadId) {
      return NextResponse.json(
        { error: "Missing required fields: title, targetLanguage, payloadId" },
        { status: 400 }
      );
    }

    // Validate language code
    if (!VALID_LANGUAGES.includes(targetLanguage)) {
      return NextResponse.json(
        { error: `Invalid target language: ${targetLanguage}` },
        { status: 400 }
      );
    }

    // Verify the payload exists
    const payload = await prisma.translationPayload.findUnique({
      where: { id: payloadId },
      select: { id: true, translatedTitle: true, translatedBody: true },
    });

    if (!payload) {
      return NextResponse.json({ error: "Payload not found" }, { status: 404 });
    }

    // If already translated (race condition guard), return existing
    if (payload.translatedTitle) {
      return NextResponse.json({
        translatedTitle: payload.translatedTitle,
        translatedBody: payload.translatedBody,
      });
    }

    const targetName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });

    // Translate title
    const titleResult = await model.generateContent(
      `Translate the following meme title to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${title}`
    );
    const translatedTitle = titleResult.response.text()?.trim();

    if (!translatedTitle) {
      return NextResponse.json(
        { error: "Translation returned empty result" },
        { status: 502 }
      );
    }

    // Translate body if provided and not already translated
    let translatedBody: string | undefined;
    if (postBody && !payload.translatedBody) {
      try {
        const bodyResult = await model.generateContent(
          `Translate the following meme description to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${postBody}`
        );
        translatedBody = bodyResult.response.text()?.trim() || undefined;
      } catch {
        // Body translation is optional, don't fail the whole request
      }
    }

    // Save to DB (re-check to avoid race condition overwrite)
    const freshPayload = await prisma.translationPayload.findUnique({
      where: { id: payloadId },
      select: { translatedTitle: true, translatedBody: true },
    });

    if (freshPayload?.translatedTitle) {
      // Another request already filled it — return that instead
      return NextResponse.json({
        translatedTitle: freshPayload.translatedTitle,
        translatedBody: freshPayload.translatedBody,
      });
    }

    await prisma.translationPayload.update({
      where: { id: payloadId },
      data: {
        translatedTitle,
        ...(translatedBody ? { translatedBody } : {}),
      },
    });

    return NextResponse.json({
      translatedTitle,
      translatedBody: translatedBody || payload.translatedBody || null,
    });
  } catch (error) {
    console.error("Error translating title:", error);
    return NextResponse.json(
      { error: "Translation failed" },
      { status: 500 }
    );
  }
}
