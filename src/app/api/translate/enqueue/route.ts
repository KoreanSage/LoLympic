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

// Don't re-enqueue if a PROCESSING row is less than this old. Must be
// STRICTLY smaller than the worker maxDuration (300s) so we never interrupt
// a worker that's still actively running. 4 minutes leaves 1-minute buffer.
const IN_FLIGHT_WINDOW_MS = 4 * 60 * 1000;

// QStash enforces a 2 MB payload limit. Our body is tiny (4 short strings +
// a UUID) so we're nowhere near the limit, but guard defensively so a future
// field addition surfaces immediately instead of failing at publish time.
const QSTASH_MAX_PAYLOAD_BYTES = 1.5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rlKey = getRateLimitKey(request.headers, "translate", user.id);
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
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

    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    if (post.authorId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    type QueuedEntry = { targetLanguage: string; payloadId: string; messageId: string | null };
    type SkippedEntry = { targetLanguage: string; reason: string; error?: string };
    type InFlightEntry = { targetLanguage: string; payloadId: string };

    // Phase 1: Create all payload rows + flip post status in a single
    // transaction. If anything throws here, Prisma rolls back — we never
    // leave orphan PROCESSING rows on the table.
    type PlannedJob = {
      targetLang: string;
      payloadId: string;
    };

    const planResult = await prisma.$transaction(async (tx) => {
      const planned: PlannedJob[] = [];
      const skippedIn: SkippedEntry[] = [];
      const inFlightIn: InFlightEntry[] = [];

      for (const targetLang of targetLanguages) {
        if (targetLang === sourceLanguage) {
          skippedIn.push({ targetLanguage: targetLang, reason: "same as source" });
          continue;
        }

        const latest = await tx.translationPayload.findFirst({
          where: { postId, targetLanguage: targetLang as LanguageCode },
          orderBy: { version: "desc" },
          select: { id: true, status: true, version: true, updatedAt: true },
        });

        // Already completed — skip
        if (latest && (latest.status === "COMPLETED" || latest.status === "APPROVED")) {
          skippedIn.push({ targetLanguage: targetLang, reason: "already completed" });
          continue;
        }

        // Currently in-flight — skip
        if (
          latest &&
          latest.status === "PROCESSING" &&
          Date.now() - latest.updatedAt.getTime() < IN_FLIGHT_WINDOW_MS
        ) {
          inFlightIn.push({ targetLanguage: targetLang, payloadId: latest.id });
          continue;
        }

        const nextVersion = (latest?.version ?? 0) + 1;
        const newPayload = await tx.translationPayload.create({
          data: {
            postId,
            sourceLanguage: sourceLanguage as LanguageCode,
            targetLanguage: targetLang as LanguageCode,
            version: nextVersion,
            status: "PROCESSING",
            creatorType: "AI",
            creatorId: null,
          },
          select: { id: true },
        });

        planned.push({ targetLang, payloadId: newPayload.id });
      }

      // Flip post status to PROCESSING inside the same transaction so any
      // reader sees a consistent view.
      if (planned.length > 0 && post.status !== "PROCESSING") {
        await tx.post.update({
          where: { id: postId },
          data: { status: "PROCESSING" },
        });
      }

      return { planned, skipped: skippedIn, inFlight: inFlightIn };
    });

    const queued: QueuedEntry[] = [];
    const skipped: SkippedEntry[] = [...planResult.skipped];
    const inFlight: InFlightEntry[] = [...planResult.inFlight];

    // Phase 2: Publish the QStash jobs OUTSIDE the transaction. Network calls
    // must never live inside Prisma transactions (would lock the row). On
    // failure we surgically mark that single payload as REJECTED without
    // touching the rest.
    for (const job of planResult.planned) {
      const jobBody = {
        postId,
        sourceLanguage,
        targetLanguage: job.targetLang,
        payloadId: job.payloadId,
      };

      // Safety guard against future payload bloat
      const bodySize = Buffer.byteLength(JSON.stringify(jobBody), "utf8");
      if (bodySize > QSTASH_MAX_PAYLOAD_BYTES) {
        await prisma.translationPayload
          .update({ where: { id: job.payloadId }, data: { status: "REJECTED" } })
          .catch((e) => console.warn("[Enqueue] Mark REJECTED failed:", e));
        skipped.push({
          targetLanguage: job.targetLang,
          reason: "payload too large for QStash",
          error: `${bodySize} bytes`,
        });
        continue;
      }

      try {
        const messageId = await publishTranslationJob(jobBody);
        queued.push({
          targetLanguage: job.targetLang,
          payloadId: job.payloadId,
          messageId,
        });
      } catch (pubErr) {
        const errMsg = pubErr instanceof Error ? pubErr.message : String(pubErr);
        console.error(`[Enqueue] QStash publish failed for ${job.targetLang}:`, errMsg);
        // Mark payload as REJECTED so it doesn't block future enqueues.
        // Errors here are logged, not swallowed.
        await prisma.translationPayload
          .update({ where: { id: job.payloadId }, data: { status: "REJECTED" } })
          .catch((e) => console.warn("[Enqueue] Mark REJECTED failed:", e));
        skipped.push({
          targetLanguage: job.targetLang,
          reason: "QStash publish failed",
          error: errMsg,
        });
      }
    }

    // If EVERY planned job failed to publish and nothing was queued, the
    // post is stuck at PROCESSING with no worker coming to settle it.
    // Roll the status back so the user can retry or the post stays visible.
    if (queued.length === 0 && planResult.planned.length > 0) {
      await prisma.post
        .update({ where: { id: postId }, data: { status: "PUBLISHED" } })
        .catch((e) => console.warn("[Enqueue] Failed to roll back post status:", e));
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
