import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/block/list — Returns list of users the current user has blocked
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        blocked: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const blockedUsers = blocks.map((b) => b.blocked);

    return NextResponse.json({ blockedUsers });
  } catch (error) {
    console.error("Block list error:", error);
    return NextResponse.json({ error: "Failed to fetch blocked users" }, { status: 500 });
  }
}
