import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Find active season
    const season = await prisma.season.findFirst({
      where: { status: { in: ["ACTIVE", "JUDGING", "COMPLETED"] } },
      orderBy: { startAt: "desc" },
    });

    // Total stats
    const [totalPosts, totalReactions, totalCountries] = await Promise.all([
      prisma.post.count({ where: { status: "PUBLISHED", visibility: "PUBLIC" } }),
      prisma.postReaction.count(),
      prisma.country.count({ where: { isActive: true } }),
    ]);

    // Top meme this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const topMemeThisMonth = await prisma.post.findFirst({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        createdAt: { gte: monthStart },
      },
      orderBy: { reactionCount: "desc" },
      select: {
        id: true,
        title: true,
        reactionCount: true,
        images: { take: 1, select: { originalUrl: true } },
        author: { select: { username: true, displayName: true } },
        country: { select: { flagEmoji: true, nameEn: true } },
      },
    });

    // Country rankings with scores
    const countryPosts = await prisma.post.groupBy({
      by: ["countryId"],
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        countryId: { not: null },
      },
      _sum: { reactionCount: true },
      _count: { id: true },
      orderBy: { _sum: { reactionCount: "desc" } },
      take: 15,
    });

    const countryIds = countryPosts.map((c) => c.countryId).filter(Boolean) as string[];
    const countries = await prisma.country.findMany({
      where: { id: { in: countryIds } },
      select: { id: true, nameEn: true, flagEmoji: true },
    });
    const countryMap = new Map(countries.map((c) => [c.id, c]));

    const rankings = countryPosts
      .filter((c) => c.countryId && countryMap.has(c.countryId))
      .map((c, i) => ({
        rank: i + 1,
        country: countryMap.get(c.countryId!)!,
        score: c._sum.reactionCount || 0,
        postCount: c._count.id,
      }));

    // Monthly leaders (for each month this season)
    const monthlyLeaders: Array<{
      month: number;
      year: number;
      country: { flagEmoji: string | null; nameEn: string } | null;
      postTitle: string;
      score: number;
    }> = [];

    if (season) {
      const winners = await prisma.monthlyWinner.findMany({
        where: { seasonId: season.id },
        orderBy: { month: "asc" },
        include: {
          country: { select: { flagEmoji: true, nameEn: true } },
          post: { select: { title: true, reactionCount: true } },
        },
      });
      for (const w of winners) {
        monthlyLeaders.push({
          month: w.month,
          year: w.year,
          country: w.country,
          postTitle: w.post.title,
          score: w.likeCount,
        });
      }
    }

    return NextResponse.json({
      season: season ? { id: season.id, name: season.name, status: season.status } : null,
      stats: {
        totalPosts,
        totalReactions,
        totalCountries,
        topMeme: topMemeThisMonth,
      },
      rankings,
      monthlyLeaders,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
