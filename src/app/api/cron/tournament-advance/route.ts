import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { broadcastNotification } from "@/lib/notifications";

/**
 * GET /api/cron/tournament-advance
 * Runs daily at 00:05 UTC during Dec 29-31.
 * 1. Closes finished matches (picks winner by votes)
 * 2. Creates next round matches from winners
 *
 * Schedule:
 *   12/29 23:59 → QF matches close → create SF matches for 12/30
 *   12/30 23:59 → SF matches close → create Final match for 12/31
 *   12/31 23:59 → Final match closes → season champion determined
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const actions: string[] = [];

    // Find active season
    const season = await prisma.season.findFirst({
      where: { status: { in: ["ACTIVE", "JUDGING"] } },
      orderBy: { startAt: "desc" },
    });

    if (!season) {
      return NextResponse.json({ actions: ["No active season"], timestamp: now.toISOString() });
    }

    // Find matches that have ended but no winner yet
    const expiredMatches = await prisma.tournamentMatch.findMany({
      where: {
        seasonId: season.id,
        endAt: { lte: now },
        winnerId: null,
      },
      orderBy: [{ round: "asc" }, { matchIndex: "asc" }],
    });

    if (expiredMatches.length === 0) {
      return NextResponse.json({ actions: ["No matches to advance"], timestamp: now.toISOString() });
    }

    // Close each match and determine winner
    const roundWinners = new Map<number, string[]>(); // round → winner postIds

    for (const match of expiredMatches) {
      // Winner = more votes. Tie → post1 wins (higher seed / random)
      const winnerId = match.post1Votes >= match.post2Votes ? match.post1Id : match.post2Id;

      await prisma.tournamentMatch.update({
        where: { id: match.id },
        data: { winnerId },
      });

      if (!roundWinners.has(match.round)) {
        roundWinners.set(match.round, []);
      }
      roundWinners.get(match.round)!.push(winnerId);

      actions.push(`Round ${match.round} Match ${match.matchIndex}: winner=${winnerId} (${match.post1Votes} vs ${match.post2Votes})`);
    }

    // Create next round matches from winners
    const year = now.getFullYear();

    for (const [round, winners] of Array.from(roundWinners.entries())) {
      if (winners.length < 2) continue;

      const nextRound = round + 1;
      if (nextRound > 3) continue; // Final is round 3, no round 4

      // Check if next round matches already exist
      const existingNext = await prisma.tournamentMatch.findFirst({
        where: { seasonId: season.id, round: nextRound },
      });
      if (existingNext) continue;

      // Schedule: round 2 = Dec 30, round 3 = Dec 31
      const dayOffset = nextRound === 2 ? 30 : 31;
      const startAt = new Date(year, 11, dayOffset, 0, 0, 0);
      const endAt = new Date(year, 11, dayOffset, 23, 59, 59);

      const nextMatches = [];
      for (let i = 0; i + 1 < winners.length; i += 2) {
        nextMatches.push({
          seasonId: season.id,
          round: nextRound,
          matchIndex: Math.floor(i / 2),
          post1Id: winners[i],
          post2Id: winners[i + 1],
          startAt,
          endAt,
        });
      }

      if (nextMatches.length > 0) {
        await prisma.tournamentMatch.createMany({ data: nextMatches });
        actions.push(`Created ${nextMatches.length} match(es) for round ${nextRound}`);
      }
    }

    // Check if final is decided (round 3 has a winner)
    const finalMatch = await prisma.tournamentMatch.findFirst({
      where: { seasonId: season.id, round: 3, winnerId: { not: null } },
    });

    if (finalMatch?.winnerId) {
      // Find the post to get author/country
      const championPost = await prisma.post.findUnique({
        where: { id: finalMatch.winnerId },
        select: { id: true, authorId: true, countryId: true },
      });

      if (championPost) {
        await prisma.season.update({
          where: { id: season.id },
          data: {
            championPostId: championPost.id,
            championUserId: championPost.authorId,
          },
        });
        actions.push(`Tournament champion: post ${championPost.id}`);

        // Broadcast notification about the yearly champion
        broadcastNotification({
          type: "SYSTEM",
          postId: championPost.id,
          metadata: {
            subtype: "yearly_champion",
            seasonId: season.id,
            year: now.getFullYear(),
          },
        }).catch(() => {}); // fire-and-forget
      }
    }

    return NextResponse.json({ actions, timestamp: now.toISOString() });
  } catch (error) {
    console.error("Tournament advance error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
