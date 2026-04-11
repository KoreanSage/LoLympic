// ---------------------------------------------------------------------------
// POST /api/translate/enqueue
//
// Creates PROCESSING TranslationPayload rows for each target language and
// publishes a QStash job for each one. Returns immediately — actual work
// happens in /api/translate/worker.
//
// This is the entry point for async translation. For backward compatibility,
// the legacy sync endpoint at /api/translate is still available.
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { LanguageCode } from "@prisma/client";
import { publishTranslationJob } from "@/lib/qstash";

export const maxDuration = 10;

const TRANSLATE_LANGUAGES = ["ko", "en", "ja", "zh", "es", "hi", "ar"] as const;

const enqueueSchema = z.object({
  postId: z.string().min(1),
  sourceLanguage: z.enum(TRANSLATE_LANGUAGES),
  targetLanguages: z.array(z.enum(TRANSLATE_LANGUAGES)).min(1).max(7),
});

// Don't re-enqueue if a PROCESSING row is less than this old
const IN_FLIGHT_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rlKey = getRateLimitKey(request.headers, "translate");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = enqueueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { postId, sourceLanguage, targetLanguages } = parsed.data;

    // Verify post exists + user has access (author or admin)
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, status: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const isAdmin = (user as unknown as { role?: string }).role === "ADMIN";
    if (post.authorId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const queued: Array<{ targetLanguage: string; payloadId: string; messageId: string | null }> = [];
    const skipped: Array<{ targetLanguage: string; reason: string; error?: string }> = [];
    const inFlight: Array<{ targetLanguage: string; payloadId: string }> = [];

    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) {
        skipped.push({ targetLanguage: targetLang, reason: "same as source" });
        continue;
      }

      // Find latest payload for this (postId, targetLang)
      const latest = await prisma.translationPayload.findFirst({
        where: { postId, targetLanguage: targetLang as LanguageCode },
        orderBy: { version: "desc" },
        select: { id: true, status: true, version: true, updatedAt: true },
      });

      // Already completed — skip
      if (latest && (latest.status === "COMPLETED" || latest.status === "APPROVED")) {
        skipped.push({ targetLanguage: targetLang, reason: "already completed" });
        continue;
      }

      // Currently in-flight — skip
      if (
        latest &&
        latest.status === "PROCESSING" &&
        Date.now() - latest.updatedAt.getTime() < IN_FLIGHT_WINDOW_MS
      ) {
        inFlight.push({ targetLanguage: targetLang, payloadId: latest.id });
        continue;
      }

      // Create a new PROCESSING payload row
      const nextVersion = (latest?.version ?? 0) + 1;
      let newPayload;
      try {
        newPayload = await prisma.translationPayload.create({
          data: {
            postId,
            sourceLanguage: sourceLanguage as LanguageCode,
            targetLanguage: targetLang as LanguageCode,
            version: nextVersion,
            status: "PROCESSING",
            creatorType: "AI",
            creatorId: null,
          },
        });
      } catch (createErr) {
        console.error(`[Enqueue] Failed to create payload for ${targetLang}:`, createErr);
        skipped.push({ targetLanguage: targetLang, reason: "DB create failed" });
        continue;
      }

      // Publish QStash job
      try {
        const messageId = await publishTranslationJob({
          postId,
          sourceLanguage,
          targetLanguage: targetLang,
          payloadId: newPayload.id,
        });
        queued.push({
          targetLanguage: targetLang,
          payloadId: newPayload.id,
          messageId,
        });
      } catch (pubErr) {
        const errMsg = pubErr instanceof Error ? pubErr.message : String(pubErr);
        console.error(`[Enqueue] QStash publish failed for ${targetLang}:`, errMsg, pubErr);
        // Mark payload as REJECTED so it doesn't block future enqueues
        await prisma.translationPayload
          .update({ where: { id: newPayload.id }, data: { status: "REJECTED" } })
          .catch(() => {});
        skipped.push({ targetLanguage: targetLang, reason: "QStash publish failed", error: errMsg });
      }
    }

    // Flip post status to PROCESSING if any new jobs were queued
    if (queued.length > 0 && post.status !== "PROCESSING") {
      await prisma.post
        .update({ where: { id: postId }, data: { status: "PROCESSING" } })
        .catch(() => {});
    }

    return NextResponse.json({
      postId,
      queued,
      skipped,
      inFlight,
    });
  } catch (error) {
    console.error("[Enqueue] Unhandled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
