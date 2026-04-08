import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";

const VALID_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

export const maxDuration = 60;

/**
 * POST /api/admin/retranslate
 *
 * Deletes existing translations for specified languages and queues them
 * for retranslation via the existing /api/translate pipeline.
 *
 * Body: { targetLanguages: ["hi", "ar"], batchSize?: number }
 *
 * Flow:
 * 1. Delete all TranslationPayload (+ cascaded segments) for target languages
 * 2. Delete associated CultureNotes for those languages
 * 3. Find all posts that need retranslation
 * 4. Call /api/translate for each post in batches
 * 5. Return summary
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
      batchSize = 10,
    }: { targetLanguages: string[]; batchSize?: number } = body;

    if (!targetLanguages || !Array.isArray(targetLanguages) || targetLanguages.length === 0) {
      return NextResponse.json(
        { error: "targetLanguages is required (array of language codes)" },
        { status: 400 }
      );
    }

    // Validate language codes
    for (const lang of targetLanguages) {
      if (!VALID_LANGUAGES.includes(lang as LanguageCode)) {
        return NextResponse.json(
          { error: `Invalid language code: ${lang}` },
          { status: 400 }
        );
      }
    }

    const safeBatchSize = Math.min(Math.max(batchSize, 1), 50);
    const langCodes = targetLanguages as LanguageCode[];

    // Step 1: Find all postIds that have translations in target languages
    const affectedPayloads = await prisma.translationPayload.findMany({
      where: { targetLanguage: { in: langCodes } },
      select: { postId: true },
      distinct: ["postId"],
    });
    const affectedPostIds = affectedPayloads.map((p) => p.postId);

    // Step 2: Delete existing translations for target languages
    const deleteResult = await prisma.$transaction(async (tx) => {
      // Delete culture notes for these languages
      const deletedNotes = await tx.cultureNote.deleteMany({
        where: {
          language: { in: langCodes },
          postId: { in: affectedPostIds },
        },
      });

      // Delete translation payloads (segments cascade automatically)
      const deletedPayloads = await tx.translationPayload.deleteMany({
        where: { targetLanguage: { in: langCodes } },
      });

      // Decrement translation counts on affected posts
      // Each post had N translations deleted (one per language per post)
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

    // Step 3: Get posts that need retranslation (with their source language)
    const postsToRetranslate = await prisma.post.findMany({
      where: {
        id: { in: affectedPostIds },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        sourceLanguage: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Step 4: Trigger retranslation in batches via internal fetch
    const baseUrl = request.nextUrl.origin;
    const cookieHeader = request.headers.get("cookie") || "";

    let retranslated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < postsToRetranslate.length; i += safeBatchSize) {
      const batch = postsToRetranslate.slice(i, i + safeBatchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (post) => {
          // Determine which target languages to translate (exclude source)
          const targets = langCodes.filter((l) => l !== post.sourceLanguage);
          if (targets.length === 0) return;

          const res = await fetch(`${baseUrl}/api/translate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: cookieHeader,
            },
            body: JSON.stringify({
              postId: post.id,
              sourceLanguage: post.sourceLanguage || "ko",
              targetLanguages: targets,
            }),
          });

          if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`Post ${post.id}: ${res.status} ${errBody}`);
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

      // Small delay between batches to avoid rate limiting
      if (i + safeBatchSize < postsToRetranslate.length) {
        await new Promise((r) => setTimeout(r, 1000));
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
        errors: errors.slice(0, 10), // Cap error list
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
