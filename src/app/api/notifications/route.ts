import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// GET /api/notifications — Get user notifications (paginated)
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;
    const unreadOnly = searchParams.get("unread") === "true";

    const where: Record<string, unknown> = {
      recipientId: user.id,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          actor: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          post: {
            select: {
              id: true,
              title: true,
              images: {
                orderBy: { orderIndex: "asc" },
                take: 1,
                select: { originalUrl: true },
              },
            },
          },
          comment: {
            select: {
              id: true,
              body: true,
            },
          },
          suggestion: {
            select: {
              id: true,
              type: true,
              proposedText: true,
            },
          },
        },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { recipientId: user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/notifications — Mark notifications as read
// ---------------------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "notifications");
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

    const body = await request.json();
    const { notificationIds, markAllRead } = body as {
      notificationIds?: string[];
      markAllRead?: boolean;
    };

    if (markAllRead) {
      // Mark all user's notifications as read
      const result = await prisma.notification.updateMany({
        where: {
          recipientId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      return NextResponse.json({
        message: "All notifications marked as read",
        updatedCount: result.count,
      });
    }

    if (!notificationIds?.length) {
      return NextResponse.json(
        { error: "Provide notificationIds array or set markAllRead: true" },
        { status: 400 }
      );
    }

    // Mark specific notifications as read (only if they belong to user)
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        recipientId: user.id,
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      message: "Notifications marked as read",
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 }
    );
  }
}
