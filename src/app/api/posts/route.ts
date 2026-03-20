import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode, PostStatus, Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/posts — List posts with pagination, filters, sorting
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    // Filters
    const countryId = searchParams.get("country");
    const language = searchParams.get("language") as LanguageCode | null;
    const seasonId = searchParams.get("season");
    const category = searchParams.get("category");

    // Translation language to include
    const translateTo = searchParams.get("translateTo") as LanguageCode | null;

    // Sorting
    const sort = searchParams.get("sort") || "recent";

    // Build where clause
    const where: Prisma.PostWhereInput = {
      status: PostStatus.PUBLISHED,
      visibility: "PUBLIC",
    };

    if (countryId) where.countryId = countryId;
    if (language) where.sourceLanguage = language;
    if (seasonId) where.seasonId = seasonId;
    if (category) where.category = category;

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
                where: { targetLanguage: translateTo, status: "COMPLETED" },
                orderBy: { version: "desc" as const },
                take: 1,
                include: {
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

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      body: postBody,
      category,
      tags,
      sourceLanguage,
      visibility,
      seasonId,
      images,
    }: {
      title: string;
      body?: string;
      category?: string;
      tags?: string[];
      sourceLanguage: string;
      visibility?: string;
      seasonId?: string;
      images?: Array<{
        url: string;
        cleanUrl?: string;
        width?: number;
        height?: number;
        mimeType?: string;
        fileSizeBytes?: number;
        altText?: string;
      }>;
    } = body;

    // Validation
    if (!title || !sourceLanguage) {
      return NextResponse.json(
        { error: "title and sourceLanguage are required" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: "Title must be 1-200 characters" },
        { status: 400 }
      );
    }

    if (postBody && (typeof postBody !== "string" || postBody.length > 5000)) {
      return NextResponse.json(
        { error: "Body must be under 5000 characters" },
        { status: 400 }
      );
    }

    if (tags && (!Array.isArray(tags) || tags.length > 10)) {
      return NextResponse.json(
        { error: "Maximum 10 tags allowed" },
        { status: 400 }
      );
    }

    if (images && (!Array.isArray(images) || images.length > 10)) {
      return NextResponse.json(
        { error: "Maximum 10 images allowed" },
        { status: 400 }
      );
    }

    if (!["ko", "en", "ja", "zh", "es", "hi", "ar"].includes(sourceLanguage)) {
      return NextResponse.json(
        { error: `Invalid sourceLanguage: ${sourceLanguage}` },
        { status: 400 }
      );
    }

    const post = await prisma.post.create({
      data: {
        title,
        body: postBody ?? null,
        category: category ?? null,
        tags: tags ?? [],
        sourceLanguage: sourceLanguage as LanguageCode,
        visibility: visibility === "UNLISTED" ? "UNLISTED" : visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
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

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
