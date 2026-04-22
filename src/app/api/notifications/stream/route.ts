import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * SSE endpoint that streams notification updates to the client.
 * Polls the DB every 5 seconds for new unread notifications.
 * Auto-closes after 5 minutes (Vercel serverless limit).
 *
 * No per-user connection limiter: in-memory counters don't work across
 * serverless instances (each instance has its own Map), and a sticky instance
 * accumulated stale counts from aborts that hadn't fired yet — manifesting as
 * spurious 429s on tab refresh / React strict-mode double-mount. Resource
 * bounds are enforced by MAX_DURATION_MS below.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = user.id;
  const watchPostId = request.nextUrl.searchParams.get("watchPostId");
  const MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  const POLL_INTERVAL_MS = 5000; // 5 seconds
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      }

      let lastCheckedAt = new Date();

      async function poll() {
        try {
          // Check if we've exceeded the max duration
          if (Date.now() - startTime > MAX_DURATION_MS) {
            send("close", { reason: "timeout" });
            controller.close();
            return;
          }

          // Check if the request was aborted
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          const [unreadCount, latestNotifications] = await Promise.all([
            prisma.notification.count({
              where: { recipientId: userId, isRead: false },
            }),
            prisma.notification.findMany({
              where: {
                recipientId: userId,
                createdAt: { gt: lastCheckedAt },
              },
              orderBy: { createdAt: "desc" },
              take: 5,
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
                  },
                },
              },
            }),
          ]);

          send("notification", {
            unreadCount,
            latest: latestNotifications,
          });

          // Poll for new comments on watched post
          if (watchPostId) {
            const newComments = await prisma.comment.findMany({
              where: {
                postId: watchPostId,
                createdAt: { gt: lastCheckedAt },
              },
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                body: true,
                authorId: true,
                author: {
                  select: {
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
                createdAt: true,
              },
            });

            if (newComments.length > 0) {
              send("comment", {
                postId: watchPostId,
                comments: newComments,
              });
            }
          }

          // Poll for new direct messages in user's conversations
          const conversationsWithNewMessages =
            await prisma.conversation.findMany({
              where: {
                participants: { some: { userId } },
                messages: { some: { createdAt: { gt: lastCheckedAt } } },
              },
              select: {
                id: true,
                messages: {
                  where: { createdAt: { gt: lastCheckedAt } },
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    body: true,
                    senderId: true,
                    sender: {
                      select: {
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                    forwardedPostId: true,
                    createdAt: true,
                  },
                },
              },
            });

          if (conversationsWithNewMessages.length > 0) {
            send("message", {
              conversations: conversationsWithNewMessages.map((c) => ({
                conversationId: c.id,
                messages: c.messages,
              })),
            });
          }

          lastCheckedAt = new Date();
        } catch (err) {
          console.error("SSE poll error:", err);
        }

        // Schedule next poll
        if (Date.now() - startTime < MAX_DURATION_MS && !request.signal.aborted) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }

      // Send initial heartbeat
      send("connected", { userId });

      // Start polling
      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
