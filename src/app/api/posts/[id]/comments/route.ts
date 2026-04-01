import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateRankingScore } from "@/lib/ranking";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { getBlockedUserIds } from "@/lib/block";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/posts/[id]/comments — List comments with replies (2-level depth)
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
      select: { id: true, status: true },
    });

    if (!post || post.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;
    const sort = searchParams.get("sort") || "top";

    // Block filtering
    let blockedIds: string[] = [];
    let sessionUser: Awaited<ReturnType<typeof getSessionUser>> = null;
    try {
      sessionUser = await getSessionUser();
      if (sessionUser) {
        blockedIds = await getBlockedUserIds(sessionUser.id);
      }
    } catch {
      // Not logged in
    }

    const authorSelect = {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isChampion: true,
      country: {
        select: { flagEmoji: true },
      },
    };

    // Fetch top-level comments (parentId is null) with their replies
    const where = {
      postId,
      parentId: null,
      status: "VISIBLE" as const,
      ...(blockedIds.length > 0 ? { authorId: { notIn: blockedIds } } : {}),
    };

    // Sorting
    let orderBy: Prisma.CommentOrderByWithRelationInput;
    switch (sort) {
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "top":
      default:
        orderBy = { likeCount: "desc" };
        break;
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: { select: authorSelect },
          replies: {
            where: {
              status: "VISIBLE",
              ...(blockedIds.length > 0 ? { authorId: { notIn: blockedIds } } : {}),
            },
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: authorSelect },
            },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    // Get current user's likes
    let userLikedIds: Set<string> = new Set();
    try {
      if (sessionUser) {
        const allCommentIds = comments.flatMap((c: any) => [
          c.id,
          ...(c.replies?.map((r: any) => r.id) || []),
        ]);
        const likes = await prisma.commentLike.findMany({
          where: {
            commentId: { in: allCommentIds },
            userId: sessionUser.id,
          },
          select: { commentId: true },
        });
        userLikedIds = new Set(likes.map((l) => l.commentId));
      }
    } catch {
      // Not logged in
    }

    const enrichComment = (c: any) => ({
      ...c,
      userLiked: userLikedIds.has(c.id),
      replies: c.replies?.map((r: any) => ({
        ...r,
        userLiked: userLikedIds.has(r.id),
      })),
    });

    return NextResponse.json({
      comments: comments.map(enrichComment),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/posts/[id]/comments — Create a comment or reply
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const rlKey = getRateLimitKey(request.headers, "comments");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
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

    const { id: postId } = await context.params;

    // Verify post exists and is accessible
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, status: true },
    });

    if (!post || post.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const body = await request.json();
    const { body: commentBody, parentId } = body as {
      body: string;
      parentId?: string;
    };

    if (!commentBody || !commentBody.trim()) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    if (commentBody.length > 2000) {
      return NextResponse.json(
        { error: "Comment too long (max 2000 characters)" },
        { status: 400 }
      );
    }

    // If replying, verify parent comment exists and belongs to the same post
    let parentComment: { id: string; authorId: string } | null = null;
    if (parentId) {
      parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, authorId: true },
      });

      if (!parentComment) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
    }

    const authorSelect = {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isChampion: true,
      country: {
        select: { flagEmoji: true },
      },
    };

    // Create comment and increment post comment count in a transaction
    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          postId,
          authorId: user.id,
          parentId: parentId || null,
          body: commentBody.trim(),
        },
        include: {
          author: { select: authorSelect },
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
      // If it's a reply, increment parent's reply count
      ...(parentId
        ? [
            prisma.comment.update({
              where: { id: parentId },
              data: { replyCount: { increment: 1 } },
            }),
          ]
        : []),
    ]);

    // Update ranking score (fire and forget)
    updateRankingScore(postId).catch((e) => { console.error("Failed to update ranking score:", e); });

    // Award XP to post author when they receive a comment (not self-comments)
    if (post.authorId !== user.id) {
      awardXp(post.authorId, XP_AWARDS.COMMENT_RECEIVED).catch(() => {});
    }

    // Create notification (fire and forget)
    const notifiedUserIds = new Set<string>();

    if (parentId && parentComment) {
      // REPLY notification for the parent comment author
      if (parentComment.authorId !== user.id) {
        notifiedUserIds.add(parentComment.authorId);
        prisma.notification
          .create({
            data: {
              recipientId: parentComment.authorId,
              actorId: user.id,
              postId,
              commentId: comment.id,
              type: "REPLY",
            },
          })
          .catch((e) => { console.error("Failed to create reply notification:", e); });
      }
    } else {
      // COMMENT notification for the post author
      if (post.authorId !== user.id) {
        notifiedUserIds.add(post.authorId);
        prisma.notification
          .create({
            data: {
              recipientId: post.authorId,
              actorId: user.id,
              postId,
              commentId: comment.id,
              type: "COMMENT",
            },
          })
          .catch((e) => { console.error("Failed to create comment notification:", e); });
      }
    }

    // @mention notifications — extract @username patterns and notify
    const mentionMatches = commentBody.match(/@(\w+)/g);
    if (mentionMatches && mentionMatches.length > 0) {
      const usernames = Array.from(new Set(mentionMatches.map((m: string) => m.slice(1))));
      // Look up mentioned users
      prisma.user
        .findMany({
          where: { username: { in: usernames } },
          select: { id: true, username: true },
        })
        .then((mentionedUsers) => {
          for (const mu of mentionedUsers) {
            // Skip self and already-notified users (reply/comment author)
            if (mu.id === user.id || notifiedUserIds.has(mu.id)) continue;
            prisma.notification
              .create({
                data: {
                  recipientId: mu.id,
                  actorId: user.id,
                  postId,
                  commentId: comment.id,
                  type: "COMMENT",
                },
              })
              .catch((e) => { console.error("Failed to create mention notification:", e); });
          }
        })
        .catch((e) => { console.error("Failed to look up mentioned users:", e); });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/posts/[id]/comments — Edit a comment (author only)
// ---------------------------------------------------------------------------
export async function PATCH(
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
    const { commentId, body: newBody } = body as {
      commentId: string;
      body: string;
    };

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    if (!newBody || !newBody.trim()) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, status: true },
    });

    if (!existing || existing.status === "REMOVED") {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    if (existing.postId !== postId) {
      return NextResponse.json(
        { error: "Comment does not belong to this post" },
        { status: 400 }
      );
    }

    if (existing.authorId !== user.id) {
      return NextResponse.json(
        { error: "Only the comment author can edit this comment" },
        { status: 403 }
      );
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { body: newBody.trim() },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isChampion: true,
            country: {
              select: { flagEmoji: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/posts/[id]/comments — Soft delete (comment author, post author, or admin)
// ---------------------------------------------------------------------------
export async function DELETE(
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
    const { commentId } = body as { commentId: string };

    if (!commentId) {
      return NextResponse.json(
        { error: "commentId is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true, authorId: true, parentId: true, status: true },
    });

    if (!existing || existing.status === "REMOVED") {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    if (existing.postId !== postId) {
      return NextResponse.json(
        { error: "Comment does not belong to this post" },
        { status: 400 }
      );
    }

    // Check authorization: comment author, post author, or admin
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    const isCommentAuthor = existing.authorId === user.id;
    const isPostAuthor = post?.authorId === user.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to delete this comment" },
        { status: 403 }
      );
    }

    // Soft delete and decrement counts
    await prisma.$transaction([
      prisma.comment.update({
        where: { id: commentId },
        data: { status: "REMOVED" },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { decrement: 1 } },
      }),
      // If it's a reply, decrement parent's reply count
      ...(existing.parentId
        ? [
            prisma.comment.update({
              where: { id: existing.parentId },
              data: { replyCount: { decrement: 1 } },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
