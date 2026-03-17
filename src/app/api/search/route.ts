import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/search?q=keyword&type=posts|users&limit=20
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const type = searchParams.get("type") || "posts";
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

    if (type !== "posts" && type !== "users") {
      return NextResponse.json(
        { error: "type must be 'posts' or 'users'" },
        { status: 400 }
      );
    }

    if (type === "posts") {
      const posts = await prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { body: { contains: query, mode: "insensitive" } },
            { tags: { has: query } },
          ],
        },
        orderBy: { createdAt: "desc" },
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

      return NextResponse.json({
        type: "posts",
        query,
        results: posts,
        count: posts.length,
      });
    }

    // type === "users"
    const users = await prisma.user.findMany({
      where: {
        OR: [
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

    return NextResponse.json({
      type: "users",
      query,
      results: users,
      count: users.length,
    });
  } catch (error) {
    console.error("Error searching:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
