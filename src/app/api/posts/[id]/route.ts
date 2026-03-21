import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { backfillSinglePostTitle } from "@/lib/translate-backfill";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// GET /api/posts/[id] — Full post detail
// ---------------------------------------------------------------------------
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const lang = request.nextUrl.searchParams.get("lang");

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            profileTitle: true,
            profileBorder: true,
            countryId: true,
            isChampion: true,
          },
        },
        country: {
          select: {
            id: true,
            nameEn: true,
            nameLocal: true,
            flagEmoji: true,
            themeColor: true,
          },
        },
        images: {
          orderBy: { orderIndex: "asc" },
        },
        translationPayloads: {
          where: {
            status: { in: ["COMPLETED", "APPROVED"] },
            ...(lang ? { targetLanguage: lang as any } : {}),
          },
          orderBy: { version: "desc" },
          ...(lang ? { take: 1 } : {}),
          include: {
            segments: { orderBy: { orderIndex: "asc" } },
          },
        },
        cultureNotes: {
          where: {
            status: { in: ["PUBLISHED", "APPROVED"] },
            ...(lang ? { language: lang as any } : {}),
          },
          orderBy: { version: "desc" },
        },
        _count: {
          select: {
            reactions: true,
            comments: true,
            suggestions: true,
          },
        },
      },
    });

    if (!post || post.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Fallback: if no culture notes for requested language, fetch in any language
    if (lang && post.cultureNotes.length === 0) {
      const fallbackNotes = await prisma.cultureNote.findMany({
        where: {
          postId: id,
          status: { in: ["PUBLISHED", "APPROVED"] },
        },
        orderBy: { version: "desc" },
      });
      (post as any).cultureNotes = fallbackNotes;
    }

    if (post.status === "HIDDEN" || post.visibility === "PRIVATE") {
      const user = await getSessionUser();
      if (!user || (user.id !== post.authorId && user.role !== "ADMIN")) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
    }

    // Get reaction counts by type
    const reactionCounts = await prisma.postReaction.groupBy({
      by: ["type"],
      where: { postId: id },
      _count: { type: true },
    });

    const reactionCountMap = Object.fromEntries(
      reactionCounts.map((r) => [r.type, r._count.type])
    );

    // Check if current user has reacted
    let userReactions: string[] = [];
    try {
      const user = await getSessionUser();
      if (user) {
        const reactions = await prisma.postReaction.findMany({
          where: { postId: id, userId: user.id },
          select: { type: true },
        });
        userReactions = reactions.map((r) => r.type);
      }
    } catch {
      // Not logged in — skip
    }

    // Increment view count (fire and forget)
    prisma.post
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    // Backfill missing translatedTitle SYNCHRONOUSLY before responding
    let patchedPost = post;
    if (lang && post.translationPayloads?.[0]?.segments?.length > 0 && !post.translationPayloads[0].translatedTitle && post.title) {
      try {
        const result = await backfillSinglePostTitle(post, lang);
        if (result) {
          // Patch the response data with the backfilled title/body
          patchedPost = {
            ...post,
            translationPayloads: post.translationPayloads.map((p: any, i: number) =>
              i === 0 ? { ...p, translatedTitle: result.translatedTitle, translatedBody: result.translatedBody ?? p.translatedBody } : p
            ),
          };
        }
      } catch {
        // Ignore backfill errors
      }
    }

    return NextResponse.json({
      ...patchedPost,
      reactionCounts: reactionCountMap,
      userReactions,
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: "Failed to fetch post" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/posts/[id] — Update post (author only)
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

    const { id } = await context.params;

    const existing = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });

    if (!existing || existing.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (existing.authorId !== user.id) {
      return NextResponse.json(
        { error: "Only the author can update this post" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, body: postBody, category, tags, visibility } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (postBody !== undefined) updateData.body = postBody;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (visibility !== undefined) updateData.visibility = visibility;

    const post = await prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        images: { orderBy: { orderIndex: "asc" } },
      },
    });

    return NextResponse.json({ post });
  } catch (error) {
    console.error("Error updating post:", error);
    return NextResponse.json(
      { error: "Failed to update post" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/posts/[id] — Soft delete (author or admin)
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

    const { id } = await context.params;

    const existing = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, status: true },
    });

    if (!existing || existing.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const isAuthor = existing.authorId === user.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: "Only the author or an admin can delete this post" },
        { status: 403 }
      );
    }

    await prisma.post.update({
      where: { id },
      data: { status: "REMOVED" },
    });

    return NextResponse.json({ message: "Post deleted" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json(
      { error: "Failed to delete post" },
      { status: 500 }
    );
  }
}
