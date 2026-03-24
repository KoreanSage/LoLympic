import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { generateEmptyBracket, assignWinnerToSlot } from "@/lib/tournament";

// ---------------------------------------------------------------------------
// GET /api/tournament?seasonId=xxx
// Returns current tournament state: matches, brackets, user's votes
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let seasonId = searchParams.get("seasonId");

    // Find active/judging season if not specified
    if (!seasonId) {
      const season = await prisma.season.findFirst({
        where: { status: { in: ["ACTIVE", "JUDGING", "COMPLETED"] } },
        orderBy: { startAt: "desc" },
        select: { id: true },
      });
      seasonId = season?.id ?? null;
    }

    if (!seasonId) {
      return NextResponse.json({ matches: [], season: null });
    }

    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true, status: true },
    });

    const matches = await prisma.tournamentMatch.findMany({
      where: { seasonId },
      orderBy: [{ round: "asc" }, { matchIndex: "asc" }],
      include: {
        post1: {
          select: {
            id: true,
            title: true,
            reactionCount: true,
            _count: { select: { images: true } },
            images: { take: 1, orderBy: { orderIndex: "asc" }, select: { originalUrl: true } },
            author: { select: { username: true, displayName: true, avatarUrl: true } },
            country: { select: { id: true, flagEmoji: true, nameEn: true } },
          },
        },
        post2: {
          select: {
            id: true,
            title: true,
            reactionCount: true,
            _count: { select: { images: true } },
            images: { take: 1, orderBy: { orderIndex: "asc" }, select: { originalUrl: true } },
            author: { select: { username: true, displayName: true, avatarUrl: true } },
            country: { select: { id: true, flagEmoji: true, nameEn: true } },
          },
        },
      },
    });

    // Get user's votes if logged in
    const user = await getSessionUser();
    let userVotes: Record<string, string> = {};
    if (user) {
      const votes = await prisma.tournamentVote.findMany({
        where: { userId: user.id, matchId: { in: matches.map((m) => m.id) } },
        select: { matchId: true, postId: true },
      });
      userVotes = Object.fromEntries(votes.map((v) => [v.matchId, v.postId]));
    }

    // Count filled slots (non-null post references in QF matches)
    const qfMatches = matches.filter((m) => m.round === 1);
    const filledSlots = qfMatches.reduce((count, m) => {
      return count + (m.post1Id ? 1 : 0) + (m.post2Id ? 1 : 0);
    }, 0);
    const totalSlots = qfMatches.length * 2;

    return NextResponse.json({
      season,
      matches: matches.map((m) => ({
        id: m.id,
        round: m.round,
        matchIndex: m.matchIndex,
        post1: m.post1
          ? { ...m.post1, imageUrl: m.post1.images[0]?.originalUrl, imageCount: m.post1._count.images }
          : null,
        post2: m.post2
          ? { ...m.post2, imageUrl: m.post2.images[0]?.originalUrl, imageCount: m.post2._count.images }
          : null,
        post1Votes: m.post1Votes,
        post2Votes: m.post2Votes,
        winnerId: m.winnerId,
        startAt: m.startAt,
        endAt: m.endAt,
        isActive: new Date() >= m.startAt && new Date() < m.endAt && !m.winnerId,
        isCompleted: !!m.winnerId,
      })),
      userVotes,
      filledSlots,
      totalSlots,
    });
  } catch (error) {
    console.error("Tournament GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/tournament — Vote on a match, generate brackets, or assign winner
// Body: { action: "vote", matchId, postId }
//    or { action: "generate", seasonId } (admin only)
//    or { action: "assign-winner", seasonId, postId } (admin only)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = await request.json();

    if (body.action === "vote") {
      return handleVote(user.id, body.matchId, body.postId);
    }

    if (body.action === "generate") {
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const result = await generateEmptyBracket(body.seasonId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "assign-winner") {
      if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const result = await assignWinnerToSlot(body.seasonId, body.postId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Tournament POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Vote on a tournament match
// ---------------------------------------------------------------------------
async function handleVote(userId: string, matchId: string, postId: string) {
  if (!matchId || !postId) {
    return NextResponse.json({ error: "matchId and postId required" }, { status: 400 });
  }

  const match = await prisma.tournamentMatch.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Check match is active
  const now = new Date();
  if (now < match.startAt || now >= match.endAt) {
    return NextResponse.json({ error: "Voting is not open for this match" }, { status: 400 });
  }
  if (match.winnerId) {
    return NextResponse.json({ error: "Match already decided" }, { status: 400 });
  }
  if (postId !== match.post1Id && postId !== match.post2Id) {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  // Upsert vote (can change vote during voting period)
  const existing = await prisma.tournamentVote.findUnique({
    where: { matchId_userId: { matchId, userId } },
  });

  if (existing) {
    if (existing.postId === postId) {
      return NextResponse.json({ success: true, message: "Already voted" });
    }
    // Change vote
    await prisma.$transaction([
      prisma.tournamentVote.update({
        where: { id: existing.id },
        data: { postId },
      }),
      // Decrement old vote
      prisma.tournamentMatch.update({
        where: { id: matchId },
        data: existing.postId === match.post1Id
          ? { post1Votes: { decrement: 1 }, post2Votes: { increment: 1 } }
          : { post2Votes: { decrement: 1 }, post1Votes: { increment: 1 } },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.tournamentVote.create({
        data: { matchId, userId, postId },
      }),
      prisma.tournamentMatch.update({
        where: { id: matchId },
        data: postId === match.post1Id
          ? { post1Votes: { increment: 1 } }
          : { post2Votes: { increment: 1 } },
      }),
    ]);
  }

  return NextResponse.json({ success: true });
}
