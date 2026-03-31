import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/championship/results?year=2026
 * Returns championship final results & rankings.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

    const championship = await prisma.championship.findUnique({
      where: { year },
    });

    if (!championship) {
      return NextResponse.json({ error: "Championship not found" }, { status: 404 });
    }

    const posts = await prisma.championshipPost.findMany({
      where: { championshipId: championship.id },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            images: { select: { originalUrl: true }, take: 1 },
            reactionCount: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        country: {
          select: { id: true, nameEn: true, flagEmoji: true },
        },
      },
      orderBy: { finalRank: "asc" },
    });

    return NextResponse.json({
      championship: {
        id: championship.id,
        year: championship.year,
        phase: championship.phase,
        championUserId: championship.championUserId,
        championCountryId: championship.championCountryId,
        championPostId: championship.championPostId,
      },
      rankings: posts.map((p) => ({
        rank: p.finalRank,
        championshipPostId: p.id,
        postId: p.postId,
        battleVoteCount: p.battleVoteCount,
        post: p.post,
        user: p.user,
        country: p.country,
      })),
    });
  } catch (error) {
    console.error("Championship results GET error:", error);
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}
