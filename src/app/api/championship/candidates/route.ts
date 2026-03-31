import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/championship/candidates?countryId=XX
 * Returns championship candidates, optionally filtered by country.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryId = searchParams.get("countryId");

    const now = new Date();
    const year = now.getFullYear();

    const championship = await prisma.championship.findUnique({
      where: { year },
    });

    if (!championship) {
      return NextResponse.json({ candidates: [] });
    }

    const where: Record<string, unknown> = { championshipId: championship.id };
    if (countryId) where.countryId = countryId;

    const candidates = await prisma.championshipCandidate.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            countryId: true,
          },
        },
        country: {
          select: { id: true, nameEn: true, flagEmoji: true },
        },
      },
      orderBy: [{ countryId: "asc" }, { rank: "asc" }],
    });

    return NextResponse.json({
      championshipId: championship.id,
      phase: championship.phase,
      candidates: candidates.map((c) => ({
        id: c.id,
        userId: c.userId,
        countryId: c.countryId,
        rank: c.rank,
        status: c.status,
        seasonScore: c.seasonScore,
        voteCount: c.voteCount,
        weightedVoteScore: c.weightedVoteScore,
        autoElected: c.autoElected,
        user: c.user,
        country: c.country,
      })),
    });
  } catch (error) {
    console.error("Championship candidates GET error:", error);
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}
