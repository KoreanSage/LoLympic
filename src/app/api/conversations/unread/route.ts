import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/conversations/unread — total unread DM count
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const participations = await prisma.conversationParticipant.findMany({
      where: { userId: user.id },
      select: { conversationId: true, lastReadAt: true },
    });

    if (participations.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    // Single aggregation query instead of N+1 loop
    const unreadCounts = await prisma.directMessage.groupBy({
      by: ["conversationId"],
      where: {
        OR: participations.map((p) => ({
          conversationId: p.conversationId,
          senderId: { not: user.id },
          createdAt: { gt: p.lastReadAt },
        })),
      },
      _count: { id: true },
    });

    const totalUnread = unreadCounts.reduce((sum, g) => sum + g._count.id, 0);

    return NextResponse.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("GET unread error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
