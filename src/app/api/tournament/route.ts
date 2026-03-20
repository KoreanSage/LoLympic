import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

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

    return NextResponse.json({
      season,
      matches: matches.map((m) => ({
        id: m.id,
        round: m.round,
        matchIndex: m.matchIndex,
        post1: { ...m.post1, imageUrl: m.post1.images[0]?.originalUrl },
        post2: { ...m.post2, imageUrl: m.post2.images[0]?.originalUrl },
        post1Votes: m.post1Votes,
        post2Votes: m.post2Votes,
        winnerId: m.winnerId,
        startAt: m.startAt,
        endAt: m.endAt,
        isActive: new Date() >= m.startAt && new Date() < m.endAt && !m.winnerId,
        isCompleted: !!m.winnerId,
      })),
      userVotes,
    });
  } catch (error) {
    console.error("Tournament GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/tournament — Vote on a match or generate brackets
// Body: { action: "vote", matchId, postId }
//    or { action: "generate", seasonId } (admin only)
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
      return generateBracket(body.seasonId);
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

// ---------------------------------------------------------------------------
// Generate tournament bracket from monthly winners
// Schedule: 12/29 QF, 12/30 SF, 12/31 Final
// ---------------------------------------------------------------------------
async function generateBracket(seasonId: string) {
  if (!seasonId) {
    return NextResponse.json({ error: "seasonId required" }, { status: 400 });
  }

  // Check no existing tournament
  const existing = await prisma.tournamentMatch.findFirst({ where: { seasonId } });
  if (existing) {
    return NextResponse.json({ error: "Tournament already generated" }, { status: 409 });
  }

  // Get monthly winners sorted by likeCount (monthly 🔥)
  const winners = await prisma.monthlyWinner.findMany({
    where: { seasonId },
    orderBy: { likeCount: "desc" },
    select: { postId: true, month: true, likeCount: true },
  });

  if (winners.length < 4) {
    return NextResponse.json({ error: "Need at least 4 monthly winners" }, { status: 400 });
  }

  // Take top 8 (or all if fewer than 8)
  const top8 = winners.slice(0, 8);

  // Shuffle for random matchups
  for (let i = top8.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top8[i], top8[j]] = [top8[j], top8[i]];
  }

  // If fewer than 8, pad with byes (duplicate entries won't happen since we need pairs)
  // For now, require even number. If odd, last one gets a bye to next round.
  const year = new Date().getFullYear();

  // Quarterfinals: Dec 29, 00:00 - 23:59
  const qfStart = new Date(year, 11, 29, 0, 0, 0);
  const qfEnd = new Date(year, 11, 29, 23, 59, 59);

  // Semifinals: Dec 30
  const sfStart = new Date(year, 11, 30, 0, 0, 0);
  const sfEnd = new Date(year, 11, 30, 23, 59, 59);

  // Final: Dec 31
  const fStart = new Date(year, 11, 31, 0, 0, 0);
  const fEnd = new Date(year, 11, 31, 23, 59, 59);

  // Create quarterfinal matches
  const numQFMatches = Math.floor(top8.length / 2);
  const qfMatches = [];
  for (let i = 0; i < numQFMatches; i++) {
    qfMatches.push({
      seasonId,
      round: 1,
      matchIndex: i,
      post1Id: top8[i * 2].postId,
      post2Id: top8[i * 2 + 1].postId,
      startAt: qfStart,
      endAt: qfEnd,
    });
  }

  // Create placeholder semifinal and final matches
  // These will be filled in by the cron job when QF results come in
  // For now, just create QF matches
  await prisma.tournamentMatch.createMany({ data: qfMatches });

  return NextResponse.json({
    success: true,
    quarterFinals: numQFMatches,
    schedule: {
      quarterFinals: { start: qfStart, end: qfEnd },
      semiFinals: { start: sfStart, end: sfEnd },
      final: { start: fStart, end: fEnd },
    },
  });
}
