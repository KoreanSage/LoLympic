import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/seasons/vote
 * Cast or change vote for a monthly winner in the final vote
 * Body: { monthlyWinnerId }
 */
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "vote");
    const rl = checkRateLimit(rlKey, RATE_LIMITS.write);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { monthlyWinnerId } = await request.json();
    if (!monthlyWinnerId) {
      return NextResponse.json({ error: "monthlyWinnerId is required" }, { status: 400 });
    }

    // Get the monthly winner and its season
    const monthlyWinner = await prisma.monthlyWinner.findUnique({
      where: { id: monthlyWinnerId },
      include: { season: true },
    });

    if (!monthlyWinner) {
      return NextResponse.json({ error: "Monthly winner not found" }, { status: 404 });
    }

    // Check that season is in JUDGING status
    if (monthlyWinner.season.status !== "JUDGING") {
      return NextResponse.json({ error: "Voting is not currently open for this season" }, { status: 400 });
    }

    // Check voting period
    const now = new Date();
    if (monthlyWinner.season.votingStartAt && now < monthlyWinner.season.votingStartAt) {
      return NextResponse.json({ error: "Voting has not started yet" }, { status: 400 });
    }
    if (monthlyWinner.season.votingEndAt && now > monthlyWinner.season.votingEndAt) {
      return NextResponse.json({ error: "Voting has ended" }, { status: 400 });
    }

    // Upsert vote (1 vote per user per season)
    const vote = await prisma.finalVote.upsert({
      where: {
        seasonId_userId: {
          seasonId: monthlyWinner.seasonId,
          userId: user.id,
        },
      },
      update: {
        monthlyWinnerId,
      },
      create: {
        seasonId: monthlyWinner.seasonId,
        monthlyWinnerId,
        userId: user.id,
      },
    });

    return NextResponse.json({ vote });
  } catch (error) {
    console.error("Error casting vote:", error);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}

/**
 * GET /api/seasons/vote
 * Get current user's vote for a season
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get("seasonId");

    if (!seasonId) {
      // Find current judging season
      const season = await prisma.season.findFirst({
        where: { status: "JUDGING" },
        orderBy: { startAt: "desc" },
      });
      if (!season) {
        return NextResponse.json({ vote: null });
      }

      const vote = await prisma.finalVote.findUnique({
        where: { seasonId_userId: { seasonId: season.id, userId: user.id } },
      });
      return NextResponse.json({ vote, seasonId: season.id });
    }

    const vote = await prisma.finalVote.findUnique({
      where: { seasonId_userId: { seasonId, userId: user.id } },
    });
    return NextResponse.json({ vote });
  } catch (error) {
    console.error("Error fetching vote:", error);
    return NextResponse.json({ error: "Failed to fetch vote" }, { status: 500 });
  }
}
