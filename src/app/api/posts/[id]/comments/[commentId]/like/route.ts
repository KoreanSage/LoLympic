import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateKarma } from "@/lib/karma";

type RouteContext = { params: Promise<{ id: string; commentId: string }> };

// POST /api/posts/[id]/comments/[commentId]/like — Toggle like
export async function POST(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { commentId } = await context.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, status: true, authorId: true },
    });

    if (!comment || comment.status === "REMOVED") {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const existing = await prisma.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId: user.id,
        },
      },
    });

    let liked: boolean;

    if (existing) {
      // Unlike
      const current = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { likeCount: true },
      });
      await prisma.$transaction([
        prisma.commentLike.delete({ where: { id: existing.id } }),
        prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: (current?.likeCount ?? 0) > 0 ? { decrement: 1 } : 0 },
        }),
      ]);
      liked = false;
    } else {
      // Like
      await prisma.$transaction([
        prisma.commentLike.create({
          data: { commentId, userId: user.id },
        }),
        prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
      liked = true;
    }

    // Karma: +1 for like, -1 for unlike (fire-and-forget)
    if (liked) {
      updateKarma(comment.authorId, "comment", 1).catch(() => {});
    } else {
      updateKarma(comment.authorId, "comment", -1).catch(() => {});
    }

    const updated = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { likeCount: true },
    });

    return NextResponse.json({
      liked,
      likeCount: updated?.likeCount ?? 0,
    });
  } catch (error) {
    console.error("Error toggling comment like:", error);
    return NextResponse.json(
      { error: "Failed to toggle like" },
      { status: 500 }
    );
  }
}
