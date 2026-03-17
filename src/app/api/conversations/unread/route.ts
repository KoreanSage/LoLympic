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

    let totalUnread = 0;
    for (const p of participations) {
      const count = await prisma.directMessage.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: user.id },
          createdAt: { gt: p.lastReadAt },
        },
      });
      totalUnread += count;
    }

    return NextResponse.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("GET unread error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
