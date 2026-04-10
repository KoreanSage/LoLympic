import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";
import { backfillSinglePostTitle } from "@/lib/translate-backfill";

const updatePostSchema = z.object({
  title: z.string().max(200, "Title must be under 200 characters").optional(),
  body: z.string().max(5000, "Body must be under 5000 characters").nullable().optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).max(10, "Maximum 10 tags allowed").optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
});

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
    const VALID_LANGS = ["ko", "en", "ja", "zh", "es", "hi", "ar"];
    const rawLang = request.nextUrl.searchParams.get("lang");
    const lang = rawLang && VALID_LANGS.includes(rawLang) ? rawLang : null;

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
            ...(lang ? { targetLanguage: lang as LanguageCode } : {}),
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
            ...(lang ? { language: lang as LanguageCode } : {}),
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

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Auth check (single call, used for both privacy and reactions)
    let currentUser: Awaited<ReturnType<typeof getSessionUser>> = null;
    try {
      currentUser = await getSessionUser();
    } catch {
      // Not logged in
    }

    // Visibility check: non-PUBLISHED posts are only visible to the author and admins
    const isOwnerOrAdmin = currentUser && (currentUser.id === post.authorId || currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN");
    if (post.status !== "PUBLISHED" && !isOwnerOrAdmin) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Privacy check for private visibility
    if (post.visibility === "PRIVATE" && !isOwnerOrAdmin) {
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
      Object.assign(post, { cultureNotes: fallbackNotes });
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
    if (currentUser) {
      const reactions = await prisma.postReaction.findMany({
        where: { postId: id, userId: currentUser.id },
        select: { type: true },
      });
      userReactions = reactions.map((r) => r.type);
    }

    // Increment view count (fire and forget)
    prisma.post
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch((e) => { console.error("Failed to increment view count:", e); });

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
      select: { authorId: true, status: true, title: true, body: true, category: true, tags: true, visibility: true },
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

    const raw = await request.json();
    const parsed = updatePostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { title, body: postBody, category, tags, visibility } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (postBody !== undefined) updateData.body = postBody;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (visibility !== undefined) updateData.visibility = visibility;

    // Track edit
    updateData.isEdited = true;
    updateData.editedAt = new Date();

    // Build edit history records for changed fields
    const editHistoryRecords: { postId: string; field: string; oldValue: string | null; newValue: string | null }[] = [];
    const fieldsToCheck: { key: string; field: string; oldVal: any; newVal: any }[] = [
      { key: "title", field: "title", oldVal: existing.title, newVal: title },
      { key: "body", field: "body", oldVal: existing.body, newVal: postBody },
      { key: "category", field: "category", oldVal: existing.category, newVal: category },
      { key: "tags", field: "tags", oldVal: JSON.stringify(existing.tags), newVal: tags !== undefined ? JSON.stringify(tags) : undefined },
      { key: "visibility", field: "visibility", oldVal: existing.visibility, newVal: visibility },
    ];

    for (const { field: f, oldVal, newVal } of fieldsToCheck) {
      if (newVal !== undefined && String(oldVal ?? "") !== String(newVal ?? "")) {
        editHistoryRecords.push({
          postId: id,
          field: f,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
        });
      }
    }

    // Detect text changes that require retranslation
    const titleChanged = title !== undefined && title !== existing.title;
    const bodyChanged = postBody !== undefined && postBody !== existing.body;
    const textChanged = titleChanged || bodyChanged;

    // Wrap in transaction
    const post = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
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

      if (editHistoryRecords.length > 0) {
        await tx.postEditHistory.createMany({ data: editHistoryRecords });
      }

      // If title/body changed, clear existing text translations so they get re-generated
      // (keeps image segments intact since the image didn't change)
      if (textChanged) {
        await tx.translationPayload.updateMany({
          where: { postId: id },
          data: {
            translatedTitle: null,
            translatedBody: null,
          },
        });
      }

      return updated;
    });

    // Trigger retranslation of title/body text (fire-and-forget)
    // Fetches payloads with segments, then backfills via Gemini flash-lite
    if (textChanged) {
      (async () => {
        try {
          const postWithPayloads = await prisma.post.findUnique({
            where: { id },
            include: {
              translationPayloads: {
                where: { status: { in: ["COMPLETED", "APPROVED"] } },
                include: { segments: { take: 1 } },
              },
            },
          });
          if (!postWithPayloads) return;

          const { backfillMissingTitleTranslations } = await import("@/lib/translate-backfill");
          const allLangs = ["ko", "en", "ja", "zh", "es", "hi", "ar"];
          const sourceLang = postWithPayloads.sourceLanguage || "ko";

          // Group payloads by language and call backfill for each
          for (const lang of allLangs) {
            if (lang === sourceLang) continue;
            const payload = postWithPayloads.translationPayloads.find(
              (p) => p.targetLanguage === lang
            );
            if (!payload) continue;
            // Wrap as fake post object for backfill helper
            const fakePost = {
              ...postWithPayloads,
              translationPayloads: [payload],
            };
            await backfillMissingTitleTranslations([fakePost], lang);
          }
        } catch (e) {
          console.error("[Edit] Retranslate failed:", e);
        }
      })();
    }

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
