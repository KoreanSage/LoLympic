import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        countryId: true,
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

    const [followerCount, followingCount, postCount, posts] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.post.count({ where: { authorId: user.id, status: "PUBLISHED" } }),
      prisma.post.findMany({
        where: { authorId: user.id, status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 20,
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
    const currentUser = await getSessionUser();
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

    return NextResponse.json({
      ...user,
      followerCount,
      followingCount,
      postCount,
      posts,
      isFollowing,
      isOwnProfile: currentUser?.id === user.id,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
