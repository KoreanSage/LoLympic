import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/search?q=keyword&type=posts|users|all&limit=20
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const type = searchParams.get("type") || "all";
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    if (!query || query.length < 1) {
      return NextResponse.json(
        { error: "Search query (q) is required" },
        { status: 400 }
      );
    }

    if (!["posts", "users", "all"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'posts', 'users', or 'all'" },
        { status: 400 }
      );
    }

    // Split query into individual words for multi-word matching
    const words = query
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 10); // max 10 search terms

    const results: { posts?: any[]; users?: any[] } = {};

    // -----------------------------------------------------------------------
    // Post search
    // -----------------------------------------------------------------------
    if (type === "posts" || type === "all") {
      // Build OR conditions: each word matches title, body, or tags
      const wordConditions: Prisma.PostWhereInput[] = words.map((word) => ({
        OR: [
          { title: { contains: word, mode: "insensitive" as const } },
          { body: { contains: word, mode: "insensitive" as const } },
          { tags: { has: word } },
        ],
      }));

      // Also search in translation segments (translated text)
      const segmentMatches = await prisma.translationSegment.findMany({
        where: {
          OR: words.flatMap((word) => [
            { translatedText: { contains: word, mode: "insensitive" as const } },
            { sourceText: { contains: word, mode: "insensitive" as const } },
          ]),
        },
        select: {
          translationPayloadId: true,
        },
        take: 100,
      });

      // Look up postIds from the matching payloads
      const payloadIds = Array.from(
        new Set(segmentMatches.map((s) => s.translationPayloadId))
      );
      const payloads = payloadIds.length > 0
        ? await prisma.translationPayload.findMany({
            where: { id: { in: payloadIds } },
            select: { postId: true },
          })
        : [];
      const translationPostIds = Array.from(
        new Set(payloads.map((p) => p.postId))
      );

      // Combine: posts matching words directly OR having matching translations
      const posts = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          OR: [
            // All words match somewhere in the post (AND logic for multi-word)
            { AND: wordConditions },
            // Or any word matches in the full query as a phrase
            { title: { contains: query, mode: "insensitive" } },
            { body: { contains: query, mode: "insensitive" } },
            // Or post has matching translation segments
            ...(translationPostIds.length > 0
              ? [{ id: { in: translationPostIds } }]
              : []),
          ],
        },
        orderBy: [{ reactionCount: "desc" }, { createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          category: true,
          tags: true,
          createdAt: true,
          reactionCount: true,
          commentCount: true,
          viewCount: true,
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
            take: 1,
            select: {
              id: true,
              originalUrl: true,
              width: true,
              height: true,
            },
          },
        },
      });

      results.posts = posts;
    }

    // -----------------------------------------------------------------------
    // User search
    // -----------------------------------------------------------------------
    if (type === "users" || type === "all") {
      // Each word matches username, displayName, or bio
      const wordConditions: Prisma.UserWhereInput[] = words.map((word) => ({
        OR: [
          { username: { contains: word, mode: "insensitive" as const } },
          { displayName: { contains: word, mode: "insensitive" as const } },
          { bio: { contains: word, mode: "insensitive" as const } },
        ],
      }));

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { AND: wordConditions },
            { username: { contains: query, mode: "insensitive" } },
            { displayName: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          profileTitle: true,
          profileBorder: true,
          country: {
            select: {
              id: true,
              nameEn: true,
              flagEmoji: true,
            },
          },
          _count: {
            select: {
              followers: true,
              posts: true,
            },
          },
        },
      });

      results.users = users;
    }

    return NextResponse.json({
      query,
      ...results,
      postCount: results.posts?.length ?? 0,
      userCount: results.users?.length ?? 0,
    });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
