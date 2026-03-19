import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/users/mentions?q=searchTerm&postId=xxx
 * Returns users for @mention autocomplete.
 * Priority: post participants > following > all users
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const postId = searchParams.get("postId") || "";

    if (q.length < 1) {
      return NextResponse.json({ users: [] });
    }

    const searchFilter = {
      OR: [
        { username: { contains: q, mode: "insensitive" as const } },
        { displayName: { contains: q, mode: "insensitive" as const } },
      ],
      id: { not: user.id }, // exclude self
    };

    // 1. Post participants (commenters on this post)
    let participantIds: string[] = [];
    if (postId) {
      const comments = await prisma.comment.findMany({
        where: { postId, status: "VISIBLE" },
        select: { authorId: true },
        distinct: ["authorId"],
      });
      participantIds = comments.map((c) => c.authorId).filter((id) => id !== user.id);
    }

    // 2. Following users
    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // Search all matching users
    const users = await prisma.user.findMany({
      where: searchFilter,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        country: { select: { flagEmoji: true } },
      },
      take: 20,
    });

    // Sort by priority: participants first, then following, then others
    const sorted = users.sort((a, b) => {
      const aIsParticipant = participantIds.includes(a.id) ? 0 : 1;
      const bIsParticipant = participantIds.includes(b.id) ? 0 : 1;
      if (aIsParticipant !== bIsParticipant) return aIsParticipant - bIsParticipant;

      const aIsFollowing = followingIds.includes(a.id) ? 0 : 1;
      const bIsFollowing = followingIds.includes(b.id) ? 0 : 1;
      return aIsFollowing - bIsFollowing;
    });

    return NextResponse.json({
      users: sorted.slice(0, 10).map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        countryFlag: u.country?.flagEmoji || null,
      })),
    });
  } catch (error) {
    console.error("Mentions search error:", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
