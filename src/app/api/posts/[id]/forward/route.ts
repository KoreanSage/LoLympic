import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { isBlocked } from "@/lib/block";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/posts/[id]/forward — Forward post to a user via DM
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const rlKey = getRateLimitKey(request.headers, "forward");
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

    const { id: postId } = await params;
    const { userId, message } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot forward to yourself" }, { status: 400 });
    }

    // Check block relationship
    const blocked = await isBlocked(user.id, userId);
    if (blocked) {
      return NextResponse.json({ error: "Cannot send message to this user" }, { status: 403 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify post exists
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Find or create conversation between the two users
    let conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId } } },
        ],
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: user.id },
              { userId },
            ],
          },
        },
      });
    }

    // Create the forwarded message and increment shareCount
    await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          body: message || "",
          forwardedPostId: postId,
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { shareCount: { increment: 1 } },
      }),
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    // Create FORWARD notification (non-critical)
    await prisma.notification.create({
      data: {
        recipientId: userId,
        actorId: user.id,
        postId,
        type: "FORWARD",
      },
    }).catch((e) => { console.error("Failed to create forward notification:", e); });

    return NextResponse.json({ success: true, conversationId: conversation.id });
  } catch (error) {
    console.error("Forward error:", error);
    return NextResponse.json({ error: "Failed to forward" }, { status: 500 });
  }
}
