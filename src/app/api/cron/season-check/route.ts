import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/cron/season-check
 * Vercel Cron Job — runs daily at 00:10 UTC.
 * Checks if a season needs to transition:
 *  - ACTIVE → JUDGING (when endAt is reached, start the voting period)
 *  - JUDGING → COMPLETED (after 2 weeks of voting)
 *  - Auto-create next season if none exists
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const actions: string[] = [];

    // 1. Check ACTIVE seasons that have ended → move to JUDGING
    const expiredActive = await prisma.season.findMany({
      where: { status: "ACTIVE", endAt: { lte: now } },
    });

    for (const season of expiredActive) {
      await prisma.season.update({
        where: { id: season.id },
        data: { status: "JUDGING" },
      });
      actions.push(`Season ${season.name} → JUDGING`);
    }

    // 2. Check JUDGING seasons older than 14 days → finalize
    const judgingCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const expiredJudging = await prisma.season.findMany({
      where: { status: "JUDGING", endAt: { lte: judgingCutoff } },
    });

    for (const season of expiredJudging) {
      // MEME CHAMPION: monthly winner with the most final votes (tournament)
      const topWinner = await prisma.monthlyWinner.findFirst({
        where: { seasonId: season.id },
        orderBy: { finalVotes: { _count: "desc" } },
        include: {
          author: { select: { id: true } },
          _count: { select: { finalVotes: true } },
        },
      });

      // COUNTRY CHAMPION: total reactions received during the season
      const countryReactions = await prisma.postReaction.groupBy({
        by: ["postId"],
        where: {
          createdAt: { gte: season.startAt, lte: season.endAt },
          post: { status: "PUBLISHED", visibility: "PUBLIC", countryId: { not: null } },
        },
        _count: { id: true },
      });

      const postIds = countryReactions.map((r) => r.postId);
      const postsForCountry = postIds.length > 0
        ? await prisma.post.findMany({
            where: { id: { in: postIds } },
            select: { id: true, countryId: true },
          })
        : [];
      const postCountryMap = new Map(postsForCountry.map((p) => [p.id, p.countryId]));

      let championCountryId: string | null = null;
      let maxCountryScore = 0;
      const countryScores = new Map<string, number>();
      for (const r of countryReactions) {
        const cid = postCountryMap.get(r.postId);
        if (!cid) continue;
        const newScore = (countryScores.get(cid) || 0) + r._count.id;
        countryScores.set(cid, newScore);
        if (newScore > maxCountryScore) {
          maxCountryScore = newScore;
          championCountryId = cid;
        }
      }

      const isBeta = season.number === 0;

      await prisma.$transaction(async (tx) => {
        await tx.season.update({
          where: { id: season.id },
          data: {
            status: "COMPLETED",
            championCountryId, // By total 🔥
            ...(topWinner?.author?.id && {
              championUserId: topWinner.author.id,
              championPostId: topWinner.postId,
            }),
          },
        });

        if (!isBeta && topWinner?.author?.id) {
          await tx.user.update({
            where: { id: topWinner.author.id },
            data: {
              isChampion: true,
              profileBorder: "gold",
              profileTitle: `🏆 ${season.name} Champion`,
            },
          });
        }
      });

      actions.push(`Season ${season.name} → COMPLETED (meme: ${topWinner?.author?.id || "none"}, country: ${championCountryId || "none"})`);
    }

    // 3. Auto-create next season if no ACTIVE season exists
    const activeSeason = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
    });

    if (!activeSeason) {
      const year = now.getFullYear();
      const existingForYear = await prisma.season.findFirst({
        where: { name: `Season ${year}` },
      });

      if (!existingForYear) {
        const lastSeason = await prisma.season.findFirst({ orderBy: { number: "desc" } });
        const nextNumber = (lastSeason?.number ?? 0) + 1;
        await prisma.season.create({
          data: {
            name: `Season ${year}`,
            number: nextNumber,
            status: "ACTIVE",
            startAt: new Date(year, 0, 1), // Jan 1
            endAt: new Date(year, 11, 31, 23, 59, 59), // Dec 31
          },
        });
        actions.push(`Created Season ${year}`);
      }
    }

    return NextResponse.json({ actions, timestamp: now.toISOString() });
  } catch (error) {
    console.error("Cron season-check error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
