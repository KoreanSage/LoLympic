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
// How many posts to return per page when the admin client requests the
// list of posts to retranslate. Default and max are intentionally small to
// keep responses under ~100KB on dense databases.
const DEFAULT_PAGE_LIMIT = 200;
const MAX_PAGE_LIMIT = 500;

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { targetLanguages }: { targetLanguages: string[] } = body;
    const pageLimit = Math.min(
      MAX_PAGE_LIMIT,
      Math.max(1, Number(body?.postsPageLimit) || DEFAULT_PAGE_LIMIT)
    );

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

    // Delete translations + notes AND recount translationCount for every
    // published post in a single transaction so the DB never exposes a
    // "translations deleted but counts still stale" intermediate state.
    const result = await prisma.$transaction(async (tx) => {
      const deletedNotes = await tx.cultureNote.deleteMany({
        where: { language: { in: langCodes } },
      });

      const deletedPayloads = await tx.translationPayload.deleteMany({
        where: { targetLanguage: { in: langCodes } },
      });

      const postsWithCounts = await tx.post.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          _count: {
            select: {
              translationPayloads: {
                where: { status: { in: ["COMPLETED", "APPROVED"] } },
              },
            },
          },
        },
      });

      const BATCH = 50;
      for (let i = 0; i < postsWithCounts.length; i += BATCH) {
        const chunk = postsWithCounts.slice(i, i + BATCH);
        await Promise.all(
          chunk.map((p) =>
            tx.post.update({
              where: { id: p.id },
              data: { translationCount: p._count.translationPayloads },
            })
          )
        );
      }

      return {
        deletedPayloads: deletedPayloads.count,
        deletedNotes: deletedNotes.count,
        postCount: postsWithCounts.length,
      };
    });

    // Return the FIRST page of published posts so the admin client can
    // kick off the retranslation job immediately. The response size is now
    // bounded regardless of table growth. Clients that need more pages can
    // paginate via GET /api/posts (or call this endpoint again).
    const firstPage = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, sourceLanguage: true },
      orderBy: { createdAt: "desc" },
      take: pageLimit,
    });

    return NextResponse.json({
      success: true,
      posts: firstPage.map((p) => ({
        id: p.id,
        sourceLanguage: p.sourceLanguage || "ko",
      })),
      totalPostCount: result.postCount,
      returnedPostCount: firstPage.length,
      pageLimit,
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
