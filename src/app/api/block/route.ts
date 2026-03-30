import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/block?userId=xxx — Check if a specific user is blocked
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const block = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: user.id,
          blockedId: userId,
        },
      },
    });

    return NextResponse.json({ isBlocked: !!block });
  } catch (error) {
    console.error("Check block error:", error);
    return NextResponse.json({ error: "Failed to check block status" }, { status: 500 });
  }
}

// POST /api/block — Block a user
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "block");
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

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if already blocked (idempotent)
    const existing = await prisma.userBlock.findUnique({
      where: {
        blockerId_blockedId: {
          blockerId: user.id,
          blockedId: userId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ blocked: true }); // already blocked
    }

    // Create block and remove follows in both directions
    await prisma.$transaction([
      prisma.userBlock.create({
        data: {
          blockerId: user.id,
          blockedId: userId,
        },
      }),
      // Remove follow: blocker -> blocked
      prisma.follow.deleteMany({
        where: {
          followerId: user.id,
          followingId: userId,
        },
      }),
      // Remove follow: blocked -> blocker
      prisma.follow.deleteMany({
        where: {
          followerId: userId,
          followingId: user.id,
        },
      }),
    ]);

    return NextResponse.json({ blocked: true });
  } catch (error) {
    console.error("Block error:", error);
    return NextResponse.json({ error: "Failed to block" }, { status: 500 });
  }
}

// DELETE /api/block — Unblock a user
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    await prisma.userBlock.deleteMany({
      where: {
        blockerId: user.id,
        blockedId: userId,
      },
    });

    return NextResponse.json({ blocked: false });
  } catch (error) {
    console.error("Unblock error:", error);
    return NextResponse.json({ error: "Failed to unblock" }, { status: 500 });
  }
}
