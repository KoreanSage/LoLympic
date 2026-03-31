import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isVoteEligible } from "@/lib/championship";

/**
 * GET /api/championship/vote/representative
 * Returns the current user's representative vote status.
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

    const votes = await prisma.championshipVote.findMany({
      where: { championshipId: championship.id, voterId: user.id },
      include: {
        candidate: {
          select: {
            id: true,
            userId: true,
            countryId: true,
            rank: true,
            status: true,
            user: { select: { username: true, displayName: true } },
          },
        },
      },
    });

    return NextResponse.json({
      championshipId: championship.id,
      votes: votes.map((v) => ({
        id: v.id,
        candidateId: v.candidateId,
        candidate: v.candidate,
        createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    console.error("Championship vote GET error:", error);
    return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
  }
}

/**
 * POST /api/championship/vote/representative
 * Cast a vote for a candidate. Body: { candidateId }
 * Rules:
 *  - Account must be 30+ days old
 *  - Can only vote for 1 candidate per country
 *  - Must be in REPRESENTATIVE phase
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { candidateId } = body;

    if (!candidateId) {
      return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
    }

    const now = new Date();
    const year = now.getFullYear();

    const championship = await prisma.championship.findUnique({
      where: { year },
    });

    if (!championship || championship.phase !== "REPRESENTATIVE") {
      return NextResponse.json({ error: "Voting is not currently open" }, { status: 400 });
    }

    // Check if within voting period
    if (now < championship.representativeStartAt || now > championship.representativeEndAt) {
      return NextResponse.json({ error: "Voting period has ended" }, { status: 400 });
    }

    // Check account age
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { createdAt: true, countryId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!isVoteEligible(dbUser.createdAt)) {
      return NextResponse.json({ error: "Account must be at least 30 days old to vote" }, { status: 403 });
    }

    // Get the candidate
    const candidate = await prisma.championshipCandidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate || candidate.championshipId !== championship.id) {
      return NextResponse.json({ error: "Invalid candidate" }, { status: 400 });
    }

    // Check if user already voted for someone in this country
    const existingVote = await prisma.championshipVote.findFirst({
      where: {
        championshipId: championship.id,
        voterId: user.id,
        candidate: { countryId: candidate.countryId },
      },
    });

    if (existingVote) {
      return NextResponse.json({
        error: "You have already voted for a candidate in this country",
      }, { status: 400 });
    }

    // Cast vote
    const vote = await prisma.championshipVote.create({
      data: {
        championshipId: championship.id,
        voterId: user.id,
        candidateId,
        voterCountryId: dbUser.countryId,
      },
    });

    // Increment candidate vote count
    await prisma.championshipCandidate.update({
      where: { id: candidateId },
      data: { voteCount: { increment: 1 } },
    });

    return NextResponse.json({ success: true, vote: { id: vote.id } });
  } catch (error) {
    console.error("Championship vote POST error:", error);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}
