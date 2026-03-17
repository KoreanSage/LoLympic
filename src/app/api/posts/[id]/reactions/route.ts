import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ReactionType } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_REACTIONS: ReactionType[] = [
  "FIRE",
  "LAUGH",
  "SKULL",
  "HEART",
  "CRY",
];

// ---------------------------------------------------------------------------
// GET /api/posts/[id]/reactions — Get reaction counts + user's reactions
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: postId } = await context.params;

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Get counts grouped by type
    const counts = await prisma.postReaction.groupBy({
      by: ["type"],
      where: { postId },
      _count: { type: true },
    });

    const reactionCounts: Record<string, number> = {};
    for (const reaction of VALID_REACTIONS) {
      reactionCounts[reaction] = 0;
    }
    for (const c of counts) {
      reactionCounts[c.type] = c._count.type;
    }

    // Check user's reactions
    let userReactions: string[] = [];
    try {
      const user = await getSessionUser();
      if (user) {
        const reactions = await prisma.postReaction.findMany({
          where: { postId, userId: user.id },
          select: { type: true },
        });
        userReactions = reactions.map((r) => r.type);
      }
    } catch {
      // Not logged in
    }

    return NextResponse.json({
      postId,
      counts: reactionCounts,
      total: Object.values(reactionCounts).reduce((a, b) => a + b, 0),
      userReactions,
    });
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch reactions" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/posts/[id]/reactions — Toggle reaction
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: postId } = await context.params;

    const body = await request.json();
    const { type } = body as { type: string };

    if (!type || !VALID_REACTIONS.includes(type as ReactionType)) {
      return NextResponse.json(
        {
          error: `Invalid reaction type. Must be one of: ${VALID_REACTIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Verify post exists and is accessible
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });
    if (!post || post.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const reactionType = type as ReactionType;

    // Check if reaction already exists — toggle
    const existing = await prisma.postReaction.findUnique({
      where: {
        postId_userId_type: {
          postId,
          userId: user.id,
          type: reactionType,
        },
      },
    });

    let action: "added" | "removed";

    if (existing) {
      // Remove reaction
      await prisma.$transaction([
        prisma.postReaction.delete({ where: { id: existing.id } }),
        prisma.post.update({
          where: { id: postId },
          data: { reactionCount: { decrement: 1 } },
        }),
      ]);
      action = "removed";
    } else {
      // Add reaction
      await prisma.$transaction([
        prisma.postReaction.create({
          data: {
            postId,
            userId: user.id,
            type: reactionType,
          },
        }),
        prisma.post.update({
          where: { id: postId },
          data: { reactionCount: { increment: 1 } },
        }),
      ]);
      action = "added";
    }

    // Return updated counts
    const counts = await prisma.postReaction.groupBy({
      by: ["type"],
      where: { postId },
      _count: { type: true },
    });

    const reactionCounts: Record<string, number> = {};
    for (const r of VALID_REACTIONS) {
      reactionCounts[r] = 0;
    }
    for (const c of counts) {
      reactionCounts[c.type] = c._count.type;
    }

    return NextResponse.json({
      action,
      type: reactionType,
      counts: reactionCounts,
      total: Object.values(reactionCounts).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return NextResponse.json(
      { error: "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}
