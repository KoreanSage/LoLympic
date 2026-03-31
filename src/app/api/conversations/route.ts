import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { isBlocked } from "@/lib/block";

// GET /api/conversations — list user's conversations
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const participations = await prisma.conversationParticipant.findMany({
      where: { userId: user.id },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true, createdAt: true, senderId: true },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: "desc" } },
    });

    const conversations = participations.map((p) => {
      const otherParticipant = p.conversation.participants.find(
        (pp) => pp.userId !== user.id
      );
      const lastMessage = p.conversation.messages[0] || null;
      // Count unread: messages after lastReadAt that aren't from this user
      return {
        id: p.conversation.id,
        updatedAt: p.conversation.updatedAt.toISOString(),
        otherUser: otherParticipant?.user || {
          id: "unknown",
          username: "Deleted User",
          displayName: null,
          avatarUrl: null,
        },
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              createdAt: lastMessage.createdAt.toISOString(),
              senderId: lastMessage.senderId,
            }
          : null,
        lastReadAt: p.lastReadAt.toISOString(),
      };
    });

    // Get unread counts per conversation in a single query
    const conversationIds = conversations.map((c) => c.id);
    const lastReadMap = new Map(
      participations.map((p) => [p.conversation.id, p.lastReadAt])
    );

    // Batch unread counts: count messages after each conversation's lastReadAt
    const unreadPromises = conversationIds.map(async (convId) => {
      const lastRead = lastReadMap.get(convId);
      const count = await prisma.directMessage.count({
        where: {
          conversationId: convId,
          senderId: { not: user.id },
          ...(lastRead ? { createdAt: { gt: lastRead } } : {}),
        },
      });
      return { convId, count };
    });
    const unreadResults = await Promise.all(unreadPromises);
    const unreadMap = new Map(
      unreadResults.map((r) => [r.convId, r.count])
    );

    const conversationsWithUnread = conversations.map((conv) => ({
      ...conv,
      unreadCount: unreadMap.get(conv.id) || 0,
    }));

    return NextResponse.json({ conversations: conversationsWithUnread });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/conversations — create or find existing conversation
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "conversations");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { participantId } = await request.json();
    if (!participantId) {
      return NextResponse.json({ error: "participantId required" }, { status: 400 });
    }

    if (participantId === user.id) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }

    // Check if participant exists
    const otherUser = await prisma.user.findUnique({ where: { id: participantId } });
    if (!otherUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if block exists
    if (await isBlocked(user.id, participantId)) {
      return NextResponse.json({ error: "Cannot start a conversation with a blocked user" }, { status: 403 });
    }

    // Check if conversation already exists between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: user.id } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
    });

    if (existing) {
      return NextResponse.json({ conversationId: existing.id });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: user.id },
            { userId: participantId },
          ],
        },
      },
    });

    return NextResponse.json({ conversationId: conversation.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/conversations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
