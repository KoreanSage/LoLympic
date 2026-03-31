import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

// GET /api/conversations/[id]/messages — paginated messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 50);

    // Verify user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = await prisma.directMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        forwardedPost: {
          select: {
            id: true,
            title: true,
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
            images: { select: { originalUrl: true }, take: 1 },
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;

    // Mark as read
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({
      messages: items.map((m) => ({
        id: m.id,
        body: m.body,
        imageUrl: m.imageUrl,
        imageWidth: m.imageWidth,
        imageHeight: m.imageHeight,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
        sender: m.sender,
        forwardedPost: m.forwardedPost ?? null,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (error) {
    console.error("GET messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/conversations/[id]/messages — send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rlKey = getRateLimitKey(request.headers, "messages");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: conversationId } = await params;
    const { body, imageUrl, imageWidth, imageHeight } = await request.json();

    const hasBody = body && typeof body === "string" && body.trim().length > 0;
    const hasImage = imageUrl && typeof imageUrl === "string";

    if (hasImage) {
      try {
        new URL(imageUrl);
      } catch {
        return NextResponse.json({ error: "Invalid imageUrl" }, { status: 400 });
      }
    }

    if (!hasBody && !hasImage) {
      return NextResponse.json({ error: "Message body or image required" }, { status: 400 });
    }

    if (hasBody && body.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });
    }

    // Verify user is a participant
    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Create message and update conversation timestamp
    const [message] = await prisma.$transaction([
      prisma.directMessage.create({
        data: {
          conversationId,
          senderId: user.id,
          body: hasBody ? body.trim() : "",
          ...(hasImage ? {
            imageUrl,
            imageWidth: imageWidth ?? null,
            imageHeight: imageHeight ?? null,
          } : {}),
        },
        include: {
          sender: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      // Update sender's lastReadAt
      prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: user.id,
          },
        },
        data: { lastReadAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      message: {
        id: message.id,
        body: message.body,
        imageUrl: message.imageUrl,
        imageWidth: message.imageWidth,
        imageHeight: message.imageHeight,
        createdAt: message.createdAt.toISOString(),
        senderId: message.senderId,
        sender: message.sender,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
