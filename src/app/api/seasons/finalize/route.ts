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

    // =====================================================================
    // 1. MEME OF THE YEAR — Tournament (user votes on 12 monthly winners)
    // =====================================================================
    const voteCounts = await prisma.finalVote.groupBy({
      by: ["monthlyWinnerId"],
      where: { seasonId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    if (voteCounts.length === 0) {
      return NextResponse.json({ error: "No votes have been cast" }, { status: 400 });
    }

    // Winner meme = monthly winner with most votes
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

    // =====================================================================
    // 2. COUNTRY OF THE YEAR — Total reactions received during the season
    // =====================================================================
    const seasonStart = season.startAt;
    const seasonEnd = season.endAt;

    // Count all reactions received during the season, grouped by post's country
    const countryReactions = await prisma.postReaction.groupBy({
      by: ["postId"],
      where: {
        createdAt: { gte: seasonStart, lte: seasonEnd },
        post: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          countryId: { not: null },
        },
      },
      _count: { id: true },
    });

    // Map postId → countryId
    const postIds = countryReactions.map((r) => r.postId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      select: { id: true, countryId: true },
    });
    const postCountryMap = new Map(posts.map((p) => [p.id, p.countryId]));

    // Aggregate by country
    const countryScores = new Map<string, number>();
    for (const r of countryReactions) {
      const cid = postCountryMap.get(r.postId);
      if (!cid) continue;
      countryScores.set(cid, (countryScores.get(cid) || 0) + r._count.id);
    }

    // Find #1 country and sort
    const sortedCountries = Array.from(countryScores.entries())
      .sort((a, b) => b[1] - a[1]);

    const championCountryId = sortedCountries.length > 0 ? sortedCountries[0][0] : null;
    const maxScore = sortedCountries.length > 0 ? sortedCountries[0][1] : 0;

    // =====================================================================
    // 3. SAVE RESULTS
    // =====================================================================
    await prisma.$transaction(async (tx) => {
      // Update season status
      await tx.season.update({
        where: { id: seasonId },
        data: {
          status: "COMPLETED",
          championPostId: winningMW.postId,
          championUserId: winningMW.authorId,
          championCountryId: championCountryId, // Country by total 🔥, not meme winner's country
        },
      });

      // Mark meme winner as champion
      await tx.user.update({
        where: { id: winningMW.authorId },
        data: {
          isChampion: true,
          championSeasonId: seasonId,
        },
      });

      // Medal: Meme of the Year (tournament winner)
      await tx.medal.create({
        data: {
          seasonId,
          type: "GOLD",
          scope: "MEME",
          label: `${season.name} — Meme of the Year`,
          userId: winningMW.authorId,
          countryId: winningMW.countryId,
          postId: winningMW.postId,
        },
      });

      // Medal: Meme Creator
      await tx.medal.create({
        data: {
          seasonId,
          type: "GOLD",
          scope: "CREATOR",
          label: `${season.name} — Meme of the Year Creator`,
          userId: winningMW.authorId,
        },
      });

      // Medals: Country rankings (Gold/Silver/Bronze by total 🔥)
      const medalTypes = ["GOLD", "SILVER", "BRONZE"] as const;
      for (let i = 0; i < Math.min(3, sortedCountries.length); i++) {
        const [countryId, score] = sortedCountries[i];
        await tx.medal.create({
          data: {
            seasonId,
            type: medalTypes[i],
            scope: "COUNTRY",
            label: `${season.name} — #${i + 1} Country (🔥 ${score})`,
            countryId,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      memeChampion: {
        post: winningMW.post,
        author: winningMW.author,
        voteCount: voteCounts[0]._count.id,
      },
      countryChampion: {
        countryId: championCountryId,
        totalReactions: maxScore,
        rankings: sortedCountries.slice(0, 5).map(([cid, score], i) => ({
          rank: i + 1,
          countryId: cid,
          score,
        })),
      },
    });
  } catch (error) {
    console.error("Error finalizing season:", error);
    return NextResponse.json({ error: "Failed to finalize season" }, { status: 500 });
  }
}
