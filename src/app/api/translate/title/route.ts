import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";
import { translateTitleOrDescription } from "@/lib/title-translation";

const VALID_LANGUAGES = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

// ---------------------------------------------------------------------------
// POST /api/translate/title — Translate a post title (and optionally body)
// Called client-side when a translation payload exists but has no translatedTitle
// Requires authentication to prevent unauthorized Gemini API usage.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rlKey = getRateLimitKey(request.headers, "translate-title", user.id);
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const body = await request.json();
    const {
      title,
      body: postBody,
      targetLanguage,
      payloadId,
      sourceLanguage,
      force,
    }: {
      title?: string;
      body?: string;
      targetLanguage?: string;
      payloadId?: string;
      sourceLanguage?: string;
      force?: boolean;
    } = body;

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
      select: {
        id: true,
        translatedTitle: true,
        translatedBody: true,
        sourceLanguage: true,
        targetLanguage: true,
      },
    });

    if (!payload) {
      return NextResponse.json({ error: "Payload not found" }, { status: 404 });
    }

    // If already translated AND not forcing re-translation, short-circuit.
    // `force: true` is used by admin re-translation flows to overwrite a
    // broken translatedTitle (e.g. when Gemini echoed the source language).
    if (payload.translatedTitle && !force) {
      return NextResponse.json({
        translatedTitle: payload.translatedTitle,
        translatedBody: payload.translatedBody,
      });
    }

    // `force: true` is admin-only — unprivileged users can't overwrite
    // someone else's existing translatedTitle.
    if (force && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: force re-translation requires admin role" },
        { status: 403 }
      );
    }

    const resolvedSourceLang = sourceLanguage || payload.sourceLanguage || "ko";

    // Translate title with echo detection + retry (see src/lib/title-translation.ts)
    const translatedTitle = await translateTitleOrDescription({
      sourceText: title,
      sourceLanguage: resolvedSourceLang,
      targetLanguage,
      kind: "title",
    });

    if (!translatedTitle) {
      return NextResponse.json(
        { error: "Translation returned empty or invalid result" },
        { status: 502 }
      );
    }

    // Translate body if provided and not already translated (or forced)
    let translatedBody: string | undefined;
    if (postBody && (!payload.translatedBody || force)) {
      const body = await translateTitleOrDescription({
        sourceText: postBody,
        sourceLanguage: resolvedSourceLang,
        targetLanguage,
        kind: "description",
      });
      translatedBody = body ?? undefined;
    }

    // Save to DB (re-check to avoid race condition overwrite).
    // The race guard is SKIPPED when force=true — that path deliberately
    // wants to overwrite whatever's already there.
    if (!force) {
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
