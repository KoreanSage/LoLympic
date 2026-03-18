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
      // Find the monthly winner with the most final votes
      const topWinner = await prisma.monthlyWinner.findFirst({
        where: { seasonId: season.id },
        orderBy: { finalVotes: { _count: "desc" } },
        include: {
          author: { select: { id: true } },
          country: { select: { id: true } },
          _count: { select: { finalVotes: true } },
        },
      });

      await prisma.$transaction(async (tx) => {
        // Mark season completed
        await tx.season.update({
          where: { id: season.id },
          data: {
            status: "COMPLETED",
            ...(topWinner?.country?.id && { championCountryId: topWinner.country.id }),
            ...(topWinner?.author?.id && { championUserId: topWinner.author.id }),
          },
        });

        // Give champion badge to the grand winner
        if (topWinner?.author?.id) {
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

      actions.push(`Season ${season.name} → COMPLETED (winner: ${topWinner?.country?.id || "none"})`);
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
