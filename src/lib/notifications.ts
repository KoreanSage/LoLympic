import prisma from "@/lib/prisma";

type NotificationType =
  | "REACTION"
  | "COMMENT"
  | "REPLY"
  | "SUGGESTION"
  | "SUGGESTION_APPROVED"
  | "MEDAL_AWARDED"
  | "REWARD_GRANTED"
  | "FOLLOW"
  | "SEASON_START"
  | "SEASON_END"
  | "SYSTEM"
  | "DIRECT_MESSAGE";

interface CreateNotificationParams {
  recipientId: string;
  type: NotificationType;
  actorId?: string;
  postId?: string;
  commentId?: string;
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Create a single notification (non-blocking, catches errors silently)
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    await prisma.notification.create({
      data: {
        recipientId: params.recipientId,
        type: params.type,
        actorId: params.actorId ?? null,
        postId: params.postId ?? null,
        commentId: params.commentId ?? null,
        metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
      },
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/**
 * Send a notification to ALL users (for announcements like monthly winners, season events)
 * Sends in batches to avoid overwhelming the DB.
 */
export async function broadcastNotification(params: {
  type: NotificationType;
  actorId?: string;
  postId?: string;
  metadata?: Record<string, string | number | boolean>;
  excludeUserId?: string;
}) {
  try {
    const BATCH_SIZE = 500;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const users = await prisma.user.findMany({
        where: params.excludeUserId
          ? { id: { not: params.excludeUserId } }
          : undefined,
        select: { id: true },
        skip,
        take: BATCH_SIZE,
      });

      if (users.length === 0) {
        hasMore = false;
        break;
      }

      await prisma.notification.createMany({
        data: users.map((u) => ({
          recipientId: u.id,
          type: params.type,
          actorId: params.actorId ?? null,
          postId: params.postId ?? null,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
        })),
      });

      skip += BATCH_SIZE;
      if (users.length < BATCH_SIZE) hasMore = false;
    }
  } catch (err) {
    console.error("Failed to broadcast notification:", err);
  }
}
