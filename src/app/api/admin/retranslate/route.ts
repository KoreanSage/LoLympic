import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";

const VALID_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

export const maxDuration = 60;

/**
 * POST /api/admin/retranslate
 *
 * Phase 1: Deletes existing translations for specified languages.
 * Returns list of affected postIds so the client can trigger retranslation
 * via /api/translate (which handles full image + text translation).
 *
 * Body: { targetLanguages: ["hi", "ar"] }
 * Response: { postIds: [...], deletedPayloads, deletedNotes }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { targetLanguages }: { targetLanguages: string[] } = body;

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

    const langCodes = targetLanguages as LanguageCode[];

    // Find all affected postIds
    const affectedPayloads = await prisma.translationPayload.findMany({
      where: { targetLanguage: { in: langCodes } },
      select: { postId: true },
      distinct: ["postId"],
    });
    const affectedPostIds = affectedPayloads.map((p) => p.postId);

    if (affectedPostIds.length === 0) {
      return NextResponse.json({
        success: true,
        postIds: [],
        deletedPayloads: 0,
        deletedNotes: 0,
      });
    }

    // Delete translations + culture notes in a transaction
    const result = await prisma.$transaction(async (tx) => {
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

    // Get posts with source language info for client-side retranslation
    const posts = await prisma.post.findMany({
      where: {
        id: { in: affectedPostIds },
        status: "PUBLISHED",
      },
      select: { id: true, sourceLanguage: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      posts: posts.map((p) => ({
        id: p.id,
        sourceLanguage: p.sourceLanguage || "ko",
      })),
      deletedPayloads: result.deletedPayloads,
      deletedNotes: result.deletedNotes,
    });
  } catch (err) {
    console.error("Retranslate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
