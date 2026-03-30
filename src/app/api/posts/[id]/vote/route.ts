import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { updateKarma } from "@/lib/karma";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/posts/[id]/vote — Get post's vote data + user's vote
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: postId } = await context.params;
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, voteScore: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    let userVote = 0;
    try {
      const user = await getSessionUser();
      if (user) {
        const vote = await prisma.postVote.findUnique({
          where: { postId_userId: { postId, userId: user.id } },
        });
        userVote = vote?.value ?? 0;
      }
    } catch (e) {
      console.error("Failed to fetch user vote:", e);
    }

    return NextResponse.json({ postId, voteScore: post.voteScore, userVote });
  } catch (error) {
    console.error("Vote GET error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/posts/[id]/vote — Cast upvote or downvote
// Body: { value: 1 | -1 | 0 }  (0 = remove vote)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const rlKey = getRateLimitKey(request.headers, "vote");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: postId } = await context.params;
    const body = await request.json();
    const value = body.value as number;

    if (![1, -1, 0].includes(value)) {
      return NextResponse.json({ error: "value must be 1, -1, or 0" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true, authorId: true },
    });
    if (!post || post.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.postVote.findUnique({
        where: { postId_userId: { postId, userId: user.id } },
      });

      if (value === 0) {
        // Remove vote
        if (existing) {
          await tx.postVote.delete({ where: { id: existing.id } });
          await tx.post.update({
            where: { id: postId },
            data: { voteScore: { decrement: existing.value } },
          });
          // Karma: removing upvote = -1, removing downvote = +1
          const karmaDelta = existing.value === 1 ? -1 : 1;
          updateKarma(post.authorId, "post", karmaDelta).catch(() => {});
        }
      } else if (existing) {
        // Change vote
        if (existing.value !== value) {
          const diff = value - existing.value; // e.g. from -1 to 1 = +2
          await tx.postVote.update({ where: { id: existing.id }, data: { value } });
          await tx.post.update({
            where: { id: postId },
            data: { voteScore: { increment: diff } },
          });
          // Karma: change from up to down = -2, change from down to up = +2
          updateKarma(post.authorId, "post", diff).catch(() => {});
        }
      } else {
        // New vote
        await tx.postVote.create({ data: { postId, userId: user.id, value } });
        await tx.post.update({
          where: { id: postId },
          data: { voteScore: { increment: value } },
        });
        // Karma: new upvote = +1, new downvote = -1
        updateKarma(post.authorId, "post", value).catch(() => {});
      }
    });

    const updated = await prisma.post.findUnique({
      where: { id: postId },
      select: { voteScore: true },
    });

    return NextResponse.json({ voteScore: updated?.voteScore ?? 0, userVote: value });
  } catch (error) {
    console.error("Vote POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
