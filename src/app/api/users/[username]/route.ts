import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        countryId: true,
        isChampion: true,
        totalXp: true,
        level: true,
        tier: true,
        postKarma: true,
        commentKarma: true,
        createdAt: true,
        country: {
          select: {
            id: true,
            nameEn: true,
            flagEmoji: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if current user is the profile owner
    const currentUser = await getSessionUser();
    const isOwnProfile = currentUser?.id === user.id;

    const postWhere = {
      authorId: user.id,
      status: "PUBLISHED" as const,
      ...(isOwnProfile ? {} : { visibility: "PUBLIC" as const }),
    };

    const [followerCount, followingCount, postCount, posts] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.post.count({ where: postWhere }),
      prisma.post.findMany({
        where: postWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
          images: {
            orderBy: { orderIndex: "asc" },
            take: 1,
            select: { originalUrl: true },
          },
          _count: {
            select: { reactions: true, comments: true },
          },
        },
      }),
    ]);

    // Check if current user follows this profile
    let isFollowing = false;
    if (currentUser && currentUser.id !== user.id) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUser.id,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!follow;
    }

    const totalPages = Math.ceil(postCount / limit);

    return NextResponse.json({
      ...user,
      followerCount,
      followingCount,
      postCount,
      posts,
      isFollowing,
      isOwnProfile,
      pagination: {
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
