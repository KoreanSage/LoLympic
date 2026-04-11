import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";

const VALID_LANGUAGES: LanguageCode[] = ["ko", "en", "ja", "zh", "es", "hi", "ar"];

const retranslateSchema = z.object({
  targetLanguages: z
    .array(z.enum(["ko", "en", "ja", "zh", "es", "hi", "ar"]))
    .min(1)
    .max(7),
  postsPageLimit: z.number().int().min(1).max(500).optional(),
});

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

    const rawBody = await request.json();
    const parsed = retranslateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { targetLanguages } = parsed.data;
    const pageLimit = parsed.data.postsPageLimit ?? DEFAULT_PAGE_LIMIT;

    // Zod already guarantees every code is in VALID_LANGUAGES, but we keep
    // this constant around because the `langCodes as LanguageCode[]` assignment
    // below is the narrowest typed view the Prisma query needs.
    void VALID_LANGUAGES;

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
