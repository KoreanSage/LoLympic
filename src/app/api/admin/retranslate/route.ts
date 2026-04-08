import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";

const VALID_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

export const maxDuration = 60;

/**
 * POST /api/admin/retranslate
 *
 * Phase 1: Deletes ALL existing translations for specified languages.
 * Returns ALL published posts so the client can trigger full retranslation
 * via /api/translate (handles image + text + culture notes).
 *
 * Body: { targetLanguages: ["hi", "ar"] }
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

    // Delete ALL existing translations + culture notes for target languages
    const result = await prisma.$transaction(async (tx) => {
      const deletedNotes = await tx.cultureNote.deleteMany({
        where: { language: { in: langCodes } },
      });

      const deletedPayloads = await tx.translationPayload.deleteMany({
        where: { targetLanguage: { in: langCodes } },
      });

      return {
        deletedPayloads: deletedPayloads.count,
        deletedNotes: deletedNotes.count,
      };
    });

    // Recalculate translation counts for ALL posts (batch update)
    const postsWithCounts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        _count: {
          select: {
            translationPayloads: { where: { status: { in: ["COMPLETED", "APPROVED"] } } },
          },
        },
      },
    });
    for (const p of postsWithCounts) {
      await prisma.post.update({
        where: { id: p.id },
        data: { translationCount: p._count.translationPayloads },
      });
    }

    // Return ALL published posts for client-side retranslation
    const allPosts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, sourceLanguage: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      posts: allPosts.map((p) => ({
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
