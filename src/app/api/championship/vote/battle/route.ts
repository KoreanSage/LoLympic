import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isVoteEligible } from "@/lib/championship";

/**
 * GET /api/championship/vote/battle
 * Returns current user's battle vote status.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const year = now.getFullYear();

    const championship = await prisma.championship.findUnique({
      where: { year },
    });

    if (!championship) {
      return NextResponse.json({ votes: [] });
    }

    const votes = await prisma.championshipBattleVote.findMany({
      where: {
        voterId: user.id,
        championshipPost: { championshipId: championship.id },
      },
      include: {
        championshipPost: {
          select: {
            id: true,
            postId: true,
            countryId: true,
            user: { select: { username: true, displayName: true } },
            country: { select: { nameEn: true, flagEmoji: true } },
          },
        },
      },
    });

    return NextResponse.json({
      championshipId: championship.id,
      votes: votes.map((v) => ({
        id: v.id,
        championshipPostId: v.championshipPostId,
        championshipPost: v.championshipPost,
        createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    console.error("Championship battle vote GET error:", error);
    return NextResponse.json({ error: "Failed to fetch battle votes" }, { status: 500 });
  }
}

/**
 * POST /api/championship/vote/battle
 * Vote for a championship post. Body: { championshipPostId }
 * Rules:
 *  - Account must be 30+ days old
 *  - 1 vote per post (but can vote for multiple posts)
 *  - Must be in CHAMPIONSHIP phase
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { championshipPostId } = body;

    if (!championshipPostId) {
      return NextResponse.json({ error: "championshipPostId is required" }, { status: 400 });
    }

    const now = new Date();
    const year = now.getFullYear();

    const championship = await prisma.championship.findUnique({
      where: { year },
    });

    if (!championship || championship.phase !== "CHAMPIONSHIP") {
      return NextResponse.json({ error: "Battle voting is not currently open" }, { status: 400 });
    }

    // Check battle period
    if (now < championship.battleStartAt || now > championship.battleEndAt) {
      return NextResponse.json({ error: "Battle voting period has ended" }, { status: 400 });
    }

    // Check account age
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!isVoteEligible(dbUser.createdAt)) {
      return NextResponse.json({ error: "Account must be at least 30 days old to vote" }, { status: 403 });
    }

    // Verify the championship post exists
    const championshipPost = await prisma.championshipPost.findUnique({
      where: { id: championshipPostId },
    });

    if (!championshipPost || championshipPost.championshipId !== championship.id) {
      return NextResponse.json({ error: "Invalid championship post" }, { status: 400 });
    }

    // Check if already voted for this post
    const existingVote = await prisma.championshipBattleVote.findUnique({
      where: {
        championshipPostId_voterId: {
          championshipPostId,
          voterId: user.id,
        },
      },
    });

    if (existingVote) {
      return NextResponse.json({ error: "You have already voted for this post" }, { status: 400 });
    }

    // Cast vote
    const vote = await prisma.championshipBattleVote.create({
      data: {
        championshipPostId,
        voterId: user.id,
      },
    });

    // Increment vote count
    await prisma.championshipPost.update({
      where: { id: championshipPostId },
      data: { battleVoteCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, vote: { id: vote.id } });
  } catch (error) {
    console.error("Championship battle vote POST error:", error);
    return NextResponse.json({ error: "Failed to cast battle vote" }, { status: 500 });
  }
}
