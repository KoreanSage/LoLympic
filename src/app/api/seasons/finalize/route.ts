import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/seasons/finalize
 * Finalize a season: count votes, determine champion, award medals
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const seasonId = body.seasonId;

    if (!seasonId) {
      return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
    }

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }
    if (season.status !== "JUDGING") {
      return NextResponse.json({ error: "Season must be in JUDGING status to finalize" }, { status: 400 });
    }

    // Count votes per monthly winner
    const voteCounts = await prisma.finalVote.groupBy({
      by: ["monthlyWinnerId"],
      where: { seasonId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    if (voteCounts.length === 0) {
      return NextResponse.json({ error: "No votes have been cast" }, { status: 400 });
    }

    // Winner is the monthly winner with most votes
    const winningMWId = voteCounts[0].monthlyWinnerId;
    const winningMW = await prisma.monthlyWinner.findUnique({
      where: { id: winningMWId },
      include: {
        post: { select: { id: true, title: true } },
        author: { select: { id: true, username: true, displayName: true, countryId: true } },
      },
    });

    if (!winningMW) {
      return NextResponse.json({ error: "Winning entry not found" }, { status: 500 });
    }

    // Update season with champion info
    await prisma.$transaction(async (tx) => {
      // 1. Update season status to COMPLETED
      await tx.season.update({
        where: { id: seasonId },
        data: {
          status: "COMPLETED",
          championPostId: winningMW.postId,
          championUserId: winningMW.authorId,
          championCountryId: winningMW.countryId,
        },
      });

      // 2. Mark winner user as champion (permanent gold border)
      await tx.user.update({
        where: { id: winningMW.authorId },
        data: {
          isChampion: true,
          championSeasonId: seasonId,
        },
      });

      // 3. Create medals
      // Champion meme medal
      await tx.medal.create({
        data: {
          seasonId,
          type: "GOLD",
          scope: "MEME",
          label: `${season.name} — Champion Meme`,
          userId: winningMW.authorId,
          countryId: winningMW.countryId,
          postId: winningMW.postId,
        },
      });

      // Champion creator medal
      await tx.medal.create({
        data: {
          seasonId,
          type: "GOLD",
          scope: "CREATOR",
          label: `${season.name} — Meme of the Year Creator`,
          userId: winningMW.authorId,
        },
      });

      // Champion country medal
      if (winningMW.countryId) {
        await tx.medal.create({
          data: {
            seasonId,
            type: "GOLD",
            scope: "COUNTRY",
            label: `${season.name} — Champion Country`,
            countryId: winningMW.countryId,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      champion: {
        post: winningMW.post,
        author: winningMW.author,
        countryId: winningMW.countryId,
        voteCount: voteCounts[0]._count.id,
      },
    });
  } catch (error) {
    console.error("Error finalizing season:", error);
    return NextResponse.json({ error: "Failed to finalize season" }, { status: 500 });
  }
}
