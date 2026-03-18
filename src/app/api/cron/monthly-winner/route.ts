import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { broadcastNotification } from "@/lib/notifications";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * GET /api/cron/monthly-winner
 * Vercel Cron Job — runs on the 1st of each month at 00:05 UTC.
 * Selects the post with the most likes from the previous month as the monthly winner.
 * Protected by CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    // Previous month
    const targetMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth is 0-indexed
    const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    // Find active season
    const season = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startAt: "desc" },
    });

    if (!season) {
      return NextResponse.json({ message: "No active season" });
    }

    // Check if winner already exists
    const existing = await prisma.monthlyWinner.findUnique({
      where: { seasonId_month: { seasonId: season.id, month: targetMonth } },
    });
    if (existing) {
      return NextResponse.json({ message: "Already selected", existing });
    }

    // Find top post from previous month
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 1);

    const topPost = await prisma.post.findFirst({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      orderBy: { reactionCount: "desc" },
      select: {
        id: true,
        authorId: true,
        countryId: true,
        reactionCount: true,
        title: true,
      },
    });

    if (!topPost) {
      return NextResponse.json({ message: "No eligible posts" });
    }

    const winner = await prisma.monthlyWinner.create({
      data: {
        seasonId: season.id,
        month: targetMonth,
        year: targetYear,
        postId: topPost.id,
        authorId: topPost.authorId,
        countryId: topPost.countryId,
        likeCount: topPost.reactionCount,
      },
    });

    // Broadcast notification to all users
    await broadcastNotification({
      type: "SYSTEM",
      postId: topPost.id,
      metadata: {
        subtype: "MONTHLY_WINNER",
        month: targetMonth,
        year: targetYear,
        monthName: MONTH_NAMES[targetMonth - 1],
        postTitle: topPost.title,
        likeCount: topPost.reactionCount,
      },
    });

    return NextResponse.json({ message: "Winner selected", winner });
  } catch (error) {
    console.error("Cron monthly-winner error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
