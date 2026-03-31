import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode, PostStatus, Prisma } from "@prisma/client";
import { backfillMissingTitleTranslations } from "@/lib/translate-backfill";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { awardXp, XP_AWARDS } from "@/lib/xp";
import { getBlockedUserIds } from "@/lib/block";
import { updateUploadStreak } from "@/lib/streak";
import { checkAndAwardBadges } from "@/lib/badges";

const VALID_LANGUAGES = ["ko", "en", "ja", "zh", "es", "hi", "ar"] as const;

const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be under 200 characters"),
  body: z.string().max(5000, "Body must be under 5000 characters").nullable().optional(),
  category: z.string().max(50).regex(/^[a-zA-Z0-9_\- ]+$/, "Invalid category format").optional(),
  tags: z.array(z.string().max(50).regex(/^[a-zA-Z0-9\uAC00-\uD7A3\u3041-\u3094\u30A1-\u30F4\u30FC\u4E00-\u9FAF_\- ]+$/, "Invalid tag format")).max(10, "Maximum 10 tags allowed").optional(),
  sourceLanguage: z.enum(VALID_LANGUAGES, {
    errorMap: () => ({ message: `sourceLanguage must be one of: ${VALID_LANGUAGES.join(", ")}` }),
  }),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  seasonId: z.string().optional(),
  images: z
    .array(
      z.object({
        url: z.string().url("Image url must be a valid URL"),
        cleanUrl: z.string().url().nullable().optional(),
        width: z.number().int().positive().nullable().optional(),
        height: z.number().int().positive().nullable().optional(),
        mimeType: z.string().max(100).optional(),
        fileSizeBytes: z.number().int().nonnegative().optional(),
        altText: z.string().max(300).optional(),
      })
    )
    .max(10, "Maximum 10 images allowed")
    .optional(),
});

// ---------------------------------------------------------------------------
// GET /api/posts — List posts with pagination, filters, sorting
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;

    // Filters
    const countryId = searchParams.get("country");
    const VALID_LANG_CODES = ["ko", "en", "ja", "zh", "es", "hi", "ar"];
    let language = searchParams.get("language") as LanguageCode | null;
    if (language && !VALID_LANG_CODES.includes(language)) language = null;
    const seasonId = searchParams.get("season");
    const category = searchParams.get("category");
    const feed = searchParams.get("feed"); // "following"
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const excludeCategory = searchParams.get("excludeCategory");

    // Translation language to include
    let translateTo = searchParams.get("translateTo") as LanguageCode | null;
    if (translateTo && !VALID_LANG_CODES.includes(translateTo)) translateTo = null;

    // Sorting
    const sort = searchParams.get("sort") || "recent";

    // Block filtering: hide posts from blocked users
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

    // Following feed: return posts only from followed users
    if (feed === "following" && sessionUser) {
      const follows = await prisma.follow.findMany({
        where: { followerId: sessionUser.id },
        select: { followingId: true },
      });
      const followingIds = follows.map((f) => f.followingId);
      if (followingIds.length === 0) {
        return NextResponse.json({ posts: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      // We'll filter by followingIds below in the where clause
      const followWhere: Prisma.PostWhereInput = {
        status: PostStatus.PUBLISHED,
        visibility: "PUBLIC",
        authorId: { in: followingIds },
        ...(blockedIds.length > 0 ? { NOT: { authorId: { in: blockedIds } } } : {}),
      };
      if (category) followWhere.category = category;

      const [followPosts, followTotal] = await Promise.all([
        prisma.post.findMany({
          where: followWhere,
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: limit,
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                profileTitle: true,
                profileBorder: true,
                isChampion: true,
              },
            },
            country: { select: { id: true, nameEn: true, nameLocal: true, flagEmoji: true } },
            images: { orderBy: { orderIndex: "asc" }, select: { id: true, originalUrl: true, cleanUrl: true, width: true, height: true, mimeType: true, orderIndex: true } },
            translationPayloads: translateTo
              ? {
                  where: { targetLanguage: translateTo, status: { in: ["COMPLETED", "APPROVED"] } },
                  orderBy: { version: "desc" as const },
                  take: 1,
                  select: {
                    id: true,
                    memeType: true,
                    translatedImageUrl: true,
                    translatedTitle: true,
                    translatedBody: true,
                    segments: { orderBy: { orderIndex: "asc" as const } },
                  },
                }
              : false,
            comments: {
              where: { parentId: null, status: "VISIBLE" },
              orderBy: { likeCount: "desc" },
              take: 3,
              select: {
                id: true,
                body: true,
                likeCount: true,
                author: {
                  select: {
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    isChampion: true,
                    country: { select: { flagEmoji: true } },
                  },
                },
              },
            },
            _count: { select: { translationPayloads: true, reactions: true, comments: true } },
          },
        }),
        prisma.post.count({ where: followWhere }),
      ]);

      // Batch-fetch user vote states for follow feed posts
      let followUserVotes: Record<string, number> = {};
      if (sessionUser && followPosts.length > 0) {
        const postIds = followPosts.map((p) => p.id);
        const votes = await prisma.postVote.findMany({
          where: { postId: { in: postIds }, userId: sessionUser.id },
          select: { postId: true, value: true },
        });
        for (const v of votes) followUserVotes[v.postId] = v.value;
      }

      const enrichedFollowPosts = followPosts.map((p) => ({
        ...p,
        userVote: followUserVotes[p.id] ?? 0,
      }));

      return NextResponse.json({
        posts: enrichedFollowPosts,
        pagination: { page, limit, total: followTotal, totalPages: Math.ceil(followTotal / limit) },
      });
    }

    // Build where clause
    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
      visibility: "PUBLIC",
      ...(blockedIds.length > 0 ? { authorId: { notIn: blockedIds } } : {}),
    };

    if (countryId) where.countryId = countryId;
    if (language) where.sourceLanguage = language;
    if (seasonId) where.seasonId = seasonId;
    if (category) where.category = category;
    if (!category && excludeCategory) where.category = { not: excludeCategory };
    if (tag) where.tags = { has: tag };
    if (search && search.length >= 2 && search.length <= 200) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    // Build orderBy
    let orderBy: Prisma.PostOrderByWithRelationInput | Prisma.PostOrderByWithRelationInput[];
    switch (sort) {
      case "trending":
        // Primary: rankingScore, fallback: reactionCount for posts with score 0
        orderBy = [{ rankingScore: "desc" }, { reactionCount: "desc" }, { createdAt: "desc" }];
        break;
      case "top":
        orderBy = { reactionCount: "desc" };
        break;
      case "recent":
      default:
        orderBy = { createdAt: "desc" };
        break;
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              profileTitle: true,
              profileBorder: true,
              isChampion: true,
            },
          },
          country: {
            select: {
              id: true,
              nameEn: true,
              nameLocal: true,
              flagEmoji: true,
            },
          },
          images: {
            orderBy: { orderIndex: "asc" },
            select: {
              id: true,
              originalUrl: true,
              cleanUrl: true,
              width: true,
              height: true,
              mimeType: true,
              orderIndex: true,
            },
          },
          translationPayloads: translateTo
            ? {
                where: { targetLanguage: translateTo, status: { in: ["COMPLETED", "APPROVED"] } },
                orderBy: { version: "desc" as const },
                take: 1,
                select: {
                  id: true,
                  memeType: true,
                  translatedImageUrl: true,
                  translatedTitle: true,
                  translatedBody: true,
                  segments: {
                    orderBy: { orderIndex: "asc" as const },
                  },
                },
              }
            : false,
          comments: {
            where: { parentId: null, status: "VISIBLE" },
            orderBy: { likeCount: "desc" },
            take: 3,
            select: {
              id: true,
              body: true,
              likeCount: true,
              author: {
                select: {
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isChampion: true,
                  country: { select: { flagEmoji: true } },
                },
              },
            },
          },
          _count: {
            select: {
              translationPayloads: true,
              reactions: true,
              comments: true,
            },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    // Batch-fetch user vote states for returned posts
    let userVotes: Record<string, number> = {};
    if (sessionUser && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const votes = await prisma.postVote.findMany({
        where: { postId: { in: postIds }, userId: sessionUser.id },
        select: { postId: true, value: true },
      });
      for (const v of votes) userVotes[v.postId] = v.value;
    }

    const enrichedPosts = posts.map((p) => ({
      ...p,
      userVote: userVotes[p.id] ?? 0,
    }));

    // Fire-and-forget: backfill missing translatedTitle for posts with translation payloads
    if (translateTo) {
      backfillMissingTitleTranslations(enrichedPosts, translateTo).catch((e) => { console.error("Failed to backfill title translations:", e); });
    }

    return NextResponse.json({
      posts: enrichedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: {
        "Cache-Control": blockedIds.length > 0
          ? "private, no-store"
          : "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Error listing posts:", error);
    return NextResponse.json(
      { error: "Failed to list posts" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/posts — Create a new post with images
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "posts");
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

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = createPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      title,
      body: postBody,
      category,
      tags,
      sourceLanguage,
      visibility,
      seasonId,
      images,
    } = parsed.data;

    const post = await prisma.post.create({
      data: {
        title,
        body: postBody ?? null,
        category: category ?? null,
        tags: tags ?? [],
        sourceLanguage: sourceLanguage as LanguageCode,
        visibility: visibility || "PUBLIC",
        status: "PUBLISHED",
        authorId: user.id,
        countryId: user.countryId || null,
        seasonId: seasonId ?? null,
        images: images?.length
          ? {
              create: images.map((img, index) => ({
                originalUrl: img.url,
                cleanUrl: img.cleanUrl ?? null,
                width: img.width ?? null,
                height: img.height ?? null,
                mimeType: img.mimeType ?? null,
                fileSizeBytes: img.fileSizeBytes ?? null,
                altText: img.altText ?? null,
                orderIndex: index,
              })),
            }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        country: {
          select: {
            id: true,
            nameEn: true,
            flagEmoji: true,
          },
        },
        images: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    // If images are present and auto-translate is desired, the client should
    // call POST /api/translate separately after post creation.

    // Award XP for creating a post (fire and forget)
    awardXp(user.id, XP_AWARDS.POST_CREATED).catch(() => {});

    // Update upload streak and check badges (fire and forget)
    updateUploadStreak(user.id).catch(console.error);
    checkAndAwardBadges(user.id).catch(console.error);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
