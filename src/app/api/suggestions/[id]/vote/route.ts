import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/suggestions/[id]/vote — Upvote or downvote a suggestion
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const rlKey = getRateLimitKey(request.headers, "suggestion-vote");
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

    const { id: suggestionId } = await context.params;

    const body = await request.json();
    const { vote } = body as { vote: "up" | "down" };

    if (!vote || !["up", "down"].includes(vote)) {
      return NextResponse.json(
        { error: "vote must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    // Verify suggestion exists
    const suggestion = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      select: { id: true, authorId: true, upvoteCount: true, downvoteCount: true },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    // Cannot vote on your own suggestion
    if (suggestion.authorId === user.id) {
      return NextResponse.json(
        { error: "Cannot vote on your own suggestion" },
        { status: 400 }
      );
    }

    const isUpvote = vote === "up";

    // Check for existing vote
    const existingVote = await prisma.suggestionVote.findUnique({
      where: {
        suggestionId_userId: {
          suggestionId,
          userId: user.id,
        },
      },
    });

    let action: "voted" | "changed" | "removed";

    if (existingVote) {
      if (existingVote.isUpvote === isUpvote) {
        // Same vote — remove it (toggle off)
        await prisma.$transaction([
          prisma.suggestionVote.delete({ where: { id: existingVote.id } }),
          prisma.suggestion.update({
            where: { id: suggestionId },
            data: isUpvote
              ? { upvoteCount: { decrement: 1 } }
              : { downvoteCount: { decrement: 1 } },
          }),
        ]);
        action = "removed";
      } else {
        // Different vote — switch
        await prisma.$transaction([
          prisma.suggestionVote.update({
            where: { id: existingVote.id },
            data: { isUpvote },
          }),
          prisma.suggestion.update({
            where: { id: suggestionId },
            data: isUpvote
              ? { upvoteCount: { increment: 1 }, downvoteCount: { decrement: 1 } }
              : { upvoteCount: { decrement: 1 }, downvoteCount: { increment: 1 } },
          }),
        ]);
        action = "changed";
      }
    } else {
      // New vote
      await prisma.$transaction([
        prisma.suggestionVote.create({
          data: {
            suggestionId,
            userId: user.id,
            isUpvote,
          },
        }),
        prisma.suggestion.update({
          where: { id: suggestionId },
          data: isUpvote
            ? { upvoteCount: { increment: 1 } }
            : { downvoteCount: { increment: 1 } },
        }),
      ]);
      action = "voted";
    }

    // Return updated counts
    const updated = await prisma.suggestion.findUnique({
      where: { id: suggestionId },
      select: { upvoteCount: true, downvoteCount: true },
    });

    return NextResponse.json({
      action,
      vote: action === "removed" ? null : vote,
      upvoteCount: updated?.upvoteCount ?? 0,
      downvoteCount: updated?.downvoteCount ?? 0,
    });
  } catch (error) {
    console.error("Error voting on suggestion:", error);
    return NextResponse.json(
      { error: "Failed to vote on suggestion" },
      { status: 500 }
    );
  }
}
