import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";
import {
  isValidTranslation,
  translateTitleOrDescription,
} from "@/lib/title-translation";

// Simple in-memory cache for comment translations (per serverless instance)
const translationCache = new Map<string, { text: string; expiry: number }>();
const CACHE_TTL = 3600000; // 1 hour
const MAX_TEXT_LENGTH = 2000;

function getCacheKey(text: string, lang: string): string {
  const hash = crypto.createHash("md5").update(text).digest("hex").slice(0, 16);
  return `${hash}:${lang}`;
}

/**
 * POST /api/translate-text
 * Lightweight text-only translation used for comment translation.
 *
 * Body: { text, targetLanguage, sourceLanguage? }
 *
 * All Gemini responses are passed through `isValidTranslation` (forbidden-
 * script check) before being cached or returned. If the output contains
 * script characters that are invalid for the target language (e.g. Korean
 * hangul in a "Japanese" result), we fall back to the
 * `translateTitleOrDescription` helper which retries with a stricter prompt.
 * See src/lib/title-translation.ts for background on the ko→ja echo bug.
 */
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "translate-text");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      text,
      targetLanguage,
      sourceLanguage,
    }: { text?: string; targetLanguage?: string; sourceLanguage?: string } =
      await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const cacheKey = getCacheKey(text, targetLanguage);
    const cached = translationCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json({ translated: cached.text, targetLanguage });
    }

    // Delegate to the shared helper. It wraps Gemini with echo-detection
    // (via FORBIDDEN_SCRIPTS) + a stricter retry prompt, so comment
    // translations get the same protection post titles do. We pass
    // sourceLanguage as undefined when unknown — the helper builds a
    // prompt without a "from X" clause in that case.
    const translated = await translateTitleOrDescription({
      sourceText: text,
      sourceLanguage,
      targetLanguage,
      kind: "description",
    });

    if (!translated) {
      // Helper gave up — check the raw source script. If the source itself
      // is already in the target script (e.g. comment is English and the
      // user asked for English), return it as-is. Otherwise surface a 502.
      if (isValidTranslation(text, text, targetLanguage)) {
        translationCache.set(cacheKey, { text, expiry: Date.now() + CACHE_TTL });
        return NextResponse.json({ translated: text, targetLanguage });
      }
      return NextResponse.json(
        { error: "Translation returned empty or invalid result" },
        { status: 502 }
      );
    }

    translationCache.set(cacheKey, { text: translated, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json({ translated, targetLanguage });
  } catch (error) {
    console.error("Text translation error:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
