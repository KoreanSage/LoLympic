import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [users, posts, translations, activeSeason, monthlyWinners] =
      await Promise.all([
        prisma.user.count(),
        prisma.post.count(),
        prisma.translationPayload.count(),
        prisma.season.findFirst({
          where: { status: { in: ["ACTIVE", "JUDGING"] } },
          orderBy: { startAt: "desc" },
          select: { id: true, name: true, status: true },
        }),
        prisma.monthlyWinner.count(),
      ]);

    return NextResponse.json({
      users,
      posts,
      translations,
      activeSeason,
      monthlyWinners,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
