import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/seasons — Get current active season + recent seasons
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get("all") === "true";

    // Get the currently active season
    const activeSeason = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
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

    return NextResponse.json({
      active: activeSeason,
      upcoming: upcomingSeason,
      recent: recentSeasons,
    });
  } catch (error) {
    console.error("Error fetching seasons:", error);
    return NextResponse.json(
      { error: "Failed to fetch seasons" },
      { status: 500 }
    );
  }
}
