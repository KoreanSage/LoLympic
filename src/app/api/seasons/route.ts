import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/seasons — Get current active season + recent seasons
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";

    // Get the currently active or judging season
    const activeSeason = await prisma.season.findFirst({
      where: { status: { in: ["ACTIVE", "JUDGING"] } },
      orderBy: { startAt: "desc" },
      include: {
        _count: {
          select: {
            entries: true,
            posts: true,
            medals: true,
            monthlyWinners: true,
            finalVotes: true,
          },
        },
      },
    });

    // Get the most recent completed season with champion info (for banner)
    const championSeason = await prisma.season.findFirst({
      where: {
        status: { in: ["COMPLETED", "ARCHIVED"] },
        championCountryId: { not: null },
      },
      orderBy: { endAt: "desc" },
      select: {
        id: true,
        name: true,
        number: true,
        championCountryId: true,
        championUserId: true,
        championPostId: true,
        endAt: true,
      },
    });

    if (includeAll) {
      // Return all seasons
      const seasons = await prisma.season.findMany({
        orderBy: { number: "desc" },
        include: {
          _count: {
            select: {
              entries: true,
              posts: true,
              medals: true,
            },
          },
        },
      });

      return NextResponse.json({
        active: activeSeason,
        seasons,
      });
    }

    // Get recent completed seasons (last 3)
    const recentSeasons = await prisma.season.findMany({
      where: {
        status: { in: ["COMPLETED", "ARCHIVED"] },
      },
      orderBy: { number: "desc" },
      take: 3,
      include: {
        _count: {
          select: {
            entries: true,
            posts: true,
            medals: true,
          },
        },
      },
    });

    // Get upcoming season if any
    const upcomingSeason = await prisma.season.findFirst({
      where: { status: "UPCOMING" },
      orderBy: { startAt: "asc" },
    });

    // If there's a champion, fetch the country info
    let championCountry = null;
    if (championSeason?.championCountryId) {
      championCountry = await prisma.country.findUnique({
        where: { id: championSeason.championCountryId },
        select: { id: true, nameEn: true, flagEmoji: true },
      });
    }

    return NextResponse.json({
      active: activeSeason,
      upcoming: upcomingSeason,
      recent: recentSeasons,
      champion: championSeason ? {
        ...championSeason,
        country: championCountry,
      } : null,
    });
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json(
      { error: "Failed to fetch seasons" },
      { status: 500 }
    );
  }
}
