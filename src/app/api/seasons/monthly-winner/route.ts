import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/seasons/monthly-winner
 * Get all monthly winners for a season (or current active season)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");

    // Find the season
    let season;
    if (seasonId) {
      season = await prisma.season.findUnique({ where: { id: seasonId } });
    } else {
      season = await prisma.season.findFirst({
        where: { status: { in: ["ACTIVE", "JUDGING", "COMPLETED"] } },
        orderBy: { startAt: "desc" },
      });
    }

    if (!season) {
      return NextResponse.json({ winners: [], season: null });
    }

    const winners = await prisma.monthlyWinner.findMany({
      where: { seasonId: season.id },
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

    return NextResponse.json({ winners, season: { id: season.id, name: season.name, status: season.status } });
  } catch (error) {
    console.error("Error fetching monthly winners:", error);
    return NextResponse.json({ error: "Failed to fetch monthly winners" }, { status: 500 });
  }
}

/**
 * POST /api/seasons/monthly-winner
 * Select the monthly winner (admin only, or auto-cron)
 * Body: { month?, year?, seasonId? } — defaults to previous month
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const now = new Date();
    // Default: select winner for the previous month
    const targetMonth = body.month || (now.getMonth() === 0 ? 12 : now.getMonth());
    const targetYear = body.year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());

    // Find active season
    let season;
    if (body.seasonId) {
      season = await prisma.season.findUnique({ where: { id: body.seasonId } });
    } else {
      season = await prisma.season.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { startAt: "desc" },
      });
    }

    if (!season) {
      return NextResponse.json({ error: "No active season found" }, { status: 404 });
    }

    // Check if winner already exists for this month
    const existing = await prisma.monthlyWinner.findUnique({
      where: { seasonId_month: { seasonId: season.id, month: targetMonth } },
    });
    if (existing) {
      return NextResponse.json({ error: "Monthly winner already selected for this month", existing }, { status: 409 });
    }

    // Find the post with the most reactions in the target month
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 1);

    const topPost = await prisma.post.findFirst({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      orderBy: { reactionCount: "desc" },
      select: {
        id: true,
        authorId: true,
        countryId: true,
        reactionCount: true,
        title: true,
      },
    });

    if (!topPost) {
      return NextResponse.json({ error: "No eligible posts found for this month" }, { status: 404 });
    }

    const winner = await prisma.monthlyWinner.create({
      data: {
        seasonId: season.id,
        month: targetMonth,
        year: targetYear,
        postId: topPost.id,
        authorId: topPost.authorId,
        countryId: topPost.countryId,
        likeCount: topPost.reactionCount,
      },
      include: {
        post: { select: { id: true, title: true } },
        author: { select: { id: true, username: true, displayName: true } },
        country: { select: { id: true, nameEn: true, flagEmoji: true } },
      },
    });

    return NextResponse.json({ winner });
  } catch (error) {
    console.error("Error selecting monthly winner:", error);
    return NextResponse.json({ error: "Failed to select monthly winner" }, { status: 500 });
  }
}
