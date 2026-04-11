// ---------------------------------------------------------------------------
// GET /api/posts/[id]/translation-status
//
// Lightweight polling endpoint used by the post page to track async
// translation progress. Returns per-language payload status and a summary
// of completed/failed/inProgress counts.
//
// No auth required — same policy as /api/posts/[id] (public posts).
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const maxDuration = 10;

interface LatestPayloadRow {
  id: string;
  targetLanguage: string;
  status: string;
  version: number;
  updatedAt: Date;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // DISTINCT ON (targetLanguage) — keep ONLY the highest-version payload
    // per language. Avoids fetching every historical version just to dedupe
    // client-side. We still cap at 7 rows (one per supported language) so
    // a post with corrupted data can't blow up the response.
    const latest = await prisma.$queryRaw<LatestPayloadRow[]>(Prisma.sql`
      SELECT DISTINCT ON ("targetLanguage")
        id, "targetLanguage", status::text AS status, version, "updatedAt"
      FROM "TranslationPayload"
      WHERE "postId" = ${id}
      ORDER BY "targetLanguage" ASC, version DESC
      LIMIT 7
    `);

    let completed = 0;
    let failed = 0;
    let inProgress = 0;
    for (const p of latest) {
      if (p.status === "COMPLETED" || p.status === "APPROVED") completed++;
      else if (p.status === "REJECTED") failed++;
      else if (p.status === "PROCESSING" || p.status === "PENDING") inProgress++;
    }

    return NextResponse.json({
      postId: id,
      postStatus: post.status,
      payloads: latest.map((p) => ({
        targetLanguage: p.targetLanguage,
        status: p.status,
        updatedAt: p.updatedAt,
      })),
      summary: {
        total: latest.length,
        completed,
        failed,
        inProgress,
      },
    });
  } catch (err) {
    console.error("[translation-status] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
