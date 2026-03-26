import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/follow — Follow a user
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "follow");
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

    const { followingId } = await request.json();
    if (!followingId) {
      return NextResponse.json({ error: "followingId required" }, { status: 400 });
    }

    if (followingId === user.id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: followingId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: user.id,
          followingId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ followed: true }); // already following
    }

    // Create follow
    await prisma.follow.create({
      data: {
        followerId: user.id,
        followingId,
      },
    });

    // Create notification only for NEW follows
    await prisma.notification.create({
      data: {
        recipientId: followingId,
        actorId: user.id,
        type: "FOLLOW",
      },
    }).catch((e) => { console.error("Failed to create follow notification:", e); }); // non-critical

    return NextResponse.json({ followed: true });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: "Failed to follow" }, { status: 500 });
  }
}

// DELETE /api/follow — Unfollow a user
export async function DELETE(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "follow");
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

    const { followingId } = await request.json();
    if (!followingId) {
      return NextResponse.json({ error: "followingId required" }, { status: 400 });
    }

    await prisma.follow.deleteMany({
      where: {
        followerId: user.id,
        followingId,
      },
    });

    return NextResponse.json({ followed: false });
  } catch (error) {
    console.error("Unfollow error:", error);
    return NextResponse.json({ error: "Failed to unfollow" }, { status: 500 });
  }
}
