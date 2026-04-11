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

export const maxDuration = 10;

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

    // Get latest payload per (postId, targetLanguage)
    const payloads = await prisma.translationPayload.findMany({
      where: { postId: id },
      orderBy: [{ targetLanguage: "asc" }, { version: "desc" }],
      select: {
        id: true,
        targetLanguage: true,
        status: true,
        version: true,
        updatedAt: true,
      },
    });

    // Dedupe: keep only the highest version per language
    const latestByLang = new Map<string, typeof payloads[number]>();
    for (const p of payloads) {
      if (!latestByLang.has(p.targetLanguage)) {
        latestByLang.set(p.targetLanguage, p);
      }
    }
    const latest = Array.from(latestByLang.values());

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
