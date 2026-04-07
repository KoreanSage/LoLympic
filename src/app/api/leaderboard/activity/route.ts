import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/leaderboard/activity — recent activity feed
export async function GET() {
  try {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    const [recentReactions, recentPosts] = await Promise.all([
      prisma.postReaction.findMany({
        where: { createdAt: { gte: fiveMinAgo } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          type: true,
          user: {
            select: { username: true, displayName: true, country: { select: { flagEmoji: true } } },
          },
          post: {
            select: { id: true, title: true, author: { select: { username: true } } },
          },
        },
      }),
      prisma.post.findMany({
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          createdAt: { gte: fifteenMinAgo },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: {
            select: { username: true, displayName: true, country: { select: { flagEmoji: true } } },
          },
        },
      }),
    ]);

    const activities: Array<{
      id: string;
      type: "reaction" | "post";
      username: string;
      displayName: string | null;
      countryFlag: string;
      message: string;
      postId?: string;
      createdAt: string;
    }> = [];

    for (const r of recentReactions) {
      activities.push({
        id: `r-${r.id}`,
        type: "reaction",
        username: r.user.username,
        displayName: r.user.displayName,
        countryFlag: r.user.country?.flagEmoji || "",
        message: `reacted to "${r.post.title}"`,
        postId: r.post.id,
        createdAt: r.createdAt.toISOString(),
      });
    }

    for (const p of recentPosts) {
      activities.push({
        id: `p-${p.id}`,
        type: "post",
        username: p.author.username,
        displayName: p.author.displayName,
        countryFlag: p.author.country?.flagEmoji || "",
        message: `uploaded a new meme`,
        postId: p.id,
        createdAt: p.createdAt.toISOString(),
      });
    }

    // Sort by time desc, take top 15
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const top = activities.slice(0, 15);

    return NextResponse.json(
      { activities: top },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("Error fetching activity feed:", error);
    return NextResponse.json({ activities: [] }, { status: 500 });
  }
}
