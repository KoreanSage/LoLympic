import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * GET /api/cron/recalculate-rankings
 * Vercel Cron Job — runs daily.
 * Recalculates rankingScore for recent posts so time decay stays fresh.
 * Without this, posts only get their decay updated on engagement events,
 * meaning inactive posts keep stale (inflated) scores.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    authHeader.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = Date.now();

    // Recalculate posts from last 30 days (these are the ones visible in trending)
    const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const posts = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        createdAt: { gte: cutoff },
      },
      select: {
        id: true,
        reactionCount: true,
        commentCount: true,
        translationCount: true,
        viewCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500, // cap to stay within execution time
    });

    let updated = 0;

    // Batch update in chunks of 50 to avoid overloading DB
    const CHUNK = 50;
    for (let i = 0; i < posts.length; i += CHUNK) {
      const chunk = posts.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async (post) => {
          const hoursSincePost = (now - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
          const dayAge = hoursSincePost / 24 + 1;
          const decay = Math.pow(dayAge, 1.2);

          const rawScore =
            post.reactionCount * 2 +
            post.commentCount * 3 +
            post.translationCount * 5 +
            post.viewCount * 0.01;

          const rankingScore = rawScore / decay;

          await prisma.post.update({
            where: { id: post.id },
            data: { rankingScore },
          });
          updated++;
        })
      );
    }

    // Zero out very old posts (older than 30 days with negligible score)
    await prisma.post.updateMany({
      where: {
        createdAt: { lt: cutoff },
        rankingScore: { gt: 0, lt: 0.1 },
      },
      data: { rankingScore: 0 },
    });

    return NextResponse.json({
      ok: true,
      recalculated: updated,
      message: `Recalculated ${updated} posts from last 30 days`,
    });
  } catch (error) {
    console.error("Ranking recalculation failed:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
