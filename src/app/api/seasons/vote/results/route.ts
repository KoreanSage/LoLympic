import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/seasons/vote/results
 * Get vote tallies for a season (public)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let seasonId = searchParams.get("seasonId");

    if (!seasonId) {
      // Find current judging or recently completed season
      const season = await prisma.season.findFirst({
        where: { status: { in: ["JUDGING", "COMPLETED"] } },
        orderBy: { startAt: "desc" },
      });
      if (!season) {
        return NextResponse.json({ results: [], season: null });
      }
      seasonId = season.id;
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: {
        id: true,
        name: true,
        status: true,
        votingStartAt: true,
        votingEndAt: true,
        championPostId: true,
        championUserId: true,
        championCountryId: true,
      },
    });

    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    // Get all monthly winners with vote counts
    const winners = await prisma.monthlyWinner.findMany({
      where: { seasonId },
      orderBy: { month: "asc" },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            reactionCount: true,
            images: { select: { originalUrl: true }, take: 1 },
          },
        },
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isChampion: true,
          },
        },
        country: {
          select: { id: true, nameEn: true, flagEmoji: true },
        },
        _count: { select: { finalVotes: true } },
      },
    });

    // Total votes cast
    const totalVotes = await prisma.finalVote.count({ where: { seasonId } });

    return NextResponse.json({
      season,
      results: winners.map((w) => ({
        id: w.id,
        month: w.month,
        year: w.year,
        likeCount: w.likeCount,
        post: w.post,
        author: w.author,
        country: w.country,
        voteCount: w._count.finalVotes,
        isChampion: season.championPostId === w.postId,
      })),
      totalVotes,
    });
  } catch (error) {
    console.error("Error fetching vote results:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}
