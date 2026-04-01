import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

// Simple in-memory cache for comment translations (per serverless instance)
const translationCache = new Map<string, { text: string; expiry: number }>();
const CACHE_TTL = 3600000; // 1 hour

function getCacheKey(text: string, lang: string): string {
  const hash = crypto.createHash("md5").update(text).digest("hex").slice(0, 16);
  return `${hash}:${lang}`;
}

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

const LANG_NAMES: Record<string, string> = {
  ko: "Korean",
  en: "English",
  ja: "Japanese",
  zh: "Chinese",
  es: "Spanish",
};

/**
 * POST /api/translate-text
 * Lightweight text-only translation using Gemini.
 * Used for comment translation.
 * Body: { text, targetLanguage }
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

    const { text, targetLanguage } = await request.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    if (text.length > 2000) {
      return NextResponse.json({ error: "Text too long" }, { status: 400 });
    }

    const targetName = LANG_NAMES[targetLanguage] || targetLanguage;

    const cacheKey = getCacheKey(text, targetLanguage);
    const cached = translationCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json({ translated: cached.text, targetLanguage });
    }

    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const result = await model.generateContent(
      `Translate the following text to ${targetName}. Output ONLY the translated text, nothing else. Keep the tone and style. If it's already in ${targetName}, return it as-is.\n\n${text}`
    );

    const translated = result.response.text().trim();

    translationCache.set(cacheKey, { text: translated, expiry: Date.now() + CACHE_TTL });

    return NextResponse.json({ translated, targetLanguage });
  } catch (error) {
    console.error("Text translation error:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
