import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/leaderboard?type=country|creator|meme[&seasonId=xxx][&limit=10]
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "country";
    const seasonId = searchParams.get("seasonId");
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    // If no seasonId, find current active season
    let resolvedSeasonId = seasonId;
    if (!resolvedSeasonId) {
      const activeSeason = await prisma.season.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      if (!activeSeason) {
        const recentSeason = await prisma.season.findFirst({
          where: { status: { in: ["COMPLETED", "JUDGING"] } },
          orderBy: { number: "desc" },
          select: { id: true },
        });
        resolvedSeasonId = recentSeason?.id ?? null;
      } else {
        resolvedSeasonId = activeSeason.id;
      }
    }

    // If we have a season, use season stats
    if (resolvedSeasonId) {
      return handleSeasonLeaderboard(type, resolvedSeasonId, limit);
    }

    // No season: fallback to realtime stats from actual posts/users
    return handleRealtimeLeaderboard(type, limit);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Season-based leaderboard (existing logic)
// ---------------------------------------------------------------------------
async function handleSeasonLeaderboard(
  type: string,
  seasonId: string,
  limit: number
) {
  switch (type) {
    case "country": {
      const stats = await prisma.countrySeasonStat.findMany({
        where: { seasonId },
        orderBy: { totalScore: "desc" },
        take: limit,
        include: {
          country: {
            select: {
              id: true,
              nameEn: true,
              nameLocal: true,
              flagEmoji: true,
              themeColor: true,
            },
          },
        },
      });

      return NextResponse.json({
        type: "country",
        source: "season",
        seasonId,
        entries: stats.map((stat, index) => ({
          rank: stat.rank ?? index + 1,
          country: stat.country,
          medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
          score: stat.totalScore,
          totalPosts: stat.totalPosts,
          totalCreators: stat.totalCreators,
          totalReactions: stat.totalReactions,
          totalShares: stat.totalShares,
          totalTranslationViews: stat.totalTranslationViews,
        })),
      });
    }

    case "creator": {
      const stats = await prisma.userSeasonStat.findMany({
        where: { seasonId },
        orderBy: { totalScore: "desc" },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              profileTitle: true,
              profileBorder: true,
              countryId: true,
              isChampion: true,
            },
          },
          country: {
            select: { id: true, nameEn: true, flagEmoji: true },
          },
        },
      });

      return NextResponse.json({
        type: "creator",
        source: "season",
        seasonId,
        entries: stats.map((stat, index) => ({
          rank: stat.globalRank ?? index + 1,
          user: stat.user,
          country: stat.country,
          medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
          score: stat.totalScore,
          totalPosts: stat.totalPosts,
          totalApprovedSuggestions: stat.totalApprovedSuggestions,
          totalCultureContributions: stat.totalCultureContributions,
        })),
      });
    }

    case "meme": {
      const stats = await prisma.postSeasonStat.findMany({
        where: { seasonId },
        orderBy: { totalScore: "desc" },
        take: limit,
        include: {
          post: {
            select: {
              id: true,
              title: true,
              authorId: true,
              reactionCount: true,
              commentCount: true,
              shareCount: true,
              translationCount: true,
              images: {
                orderBy: { orderIndex: "asc" },
                take: 1,
                select: { originalUrl: true, width: true, height: true },
              },
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                  isChampion: true,
                },
              },
            },
          },
          country: {
            select: { id: true, nameEn: true, flagEmoji: true },
          },
        },
      });

      return NextResponse.json({
        type: "meme",
        source: "season",
        seasonId,
        entries: stats.map((stat, index) => ({
          rank: stat.globalRank ?? index + 1,
          post: stat.post,
          country: stat.country,
          medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
          score: stat.totalScore,
          reactionScore: stat.reactionScore,
          commentScore: stat.commentScore,
          shareScore: stat.shareScore,
          translationScore: stat.translationScore,
          cultureScore: stat.cultureScore,
        })),
      });
    }

    default:
      return NextResponse.json(
        { error: "Invalid type. Must be: country, creator, or meme" },
        { status: 400 }
      );
  }
}

// ---------------------------------------------------------------------------
// Realtime leaderboard (no season — aggregate from posts/users directly)
// ---------------------------------------------------------------------------
async function handleRealtimeLeaderboard(type: string, limit: number) {
  switch (type) {
    case "country": {
      // Group posts by country, sum engagement
      const countryStats = await prisma.post.groupBy({
        by: ["countryId"],
        where: {
          countryId: { not: null },
          status: { in: ["PUBLISHED", "DRAFT"] },
          visibility: "PUBLIC",
        },
        _count: { id: true },
        _sum: { reactionCount: true, commentCount: true, shareCount: true },
        orderBy: { _sum: { reactionCount: "desc" } },
        take: limit,
      });

      // Fetch country details
      const countryIds = countryStats
        .map((s) => s.countryId)
        .filter((id): id is string => id !== null);

      const countries = await prisma.country.findMany({
        where: { id: { in: countryIds } },
        select: {
          id: true,
          nameEn: true,
          nameLocal: true,
          flagEmoji: true,
          themeColor: true,
        },
      });
      const countryMap = new Map(countries.map((c) => [c.id, c]));

      // Count unique creators per country
      const creatorCounts = await prisma.post.groupBy({
        by: ["countryId"],
        where: {
          countryId: { in: countryIds },
          status: { in: ["PUBLISHED", "DRAFT"] },
          visibility: "PUBLIC",
        },
        _count: { authorId: true },
      });
      const creatorCountMap = new Map(
        creatorCounts.map((c) => [c.countryId, c._count.authorId])
      );

      const entries = countryStats
        .map((stat, index) => {
          const country = countryMap.get(stat.countryId!);
          if (!country) return null;
          const reactions = stat._sum.reactionCount ?? 0;
          const comments = stat._sum.commentCount ?? 0;
          const shares = stat._sum.shareCount ?? 0;
          const score = reactions + comments * 2 + shares * 3;
          return {
            rank: index + 1,
            country,
            medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
            score,
            totalPosts: stat._count.id,
            totalCreators: creatorCountMap.get(stat.countryId!) ?? 0,
            totalReactions: reactions,
            totalShares: shares,
            totalTranslationViews: 0,
          };
        })
        .filter(Boolean)
        // Re-sort by computed score
        .sort((a, b) => b!.score - a!.score)
        .map((entry, index) => ({ ...entry!, rank: index + 1, medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null }));

      return NextResponse.json({
        type: "country",
        source: "realtime",
        seasonId: null,
        entries,
      });
    }

    case "creator": {
      // Get top users by post engagement
      const userStats = await prisma.post.groupBy({
        by: ["authorId"],
        where: {
          status: { in: ["PUBLISHED", "DRAFT"] },
          visibility: "PUBLIC",
        },
        _count: { id: true },
        _sum: { reactionCount: true, commentCount: true, shareCount: true },
        orderBy: { _sum: { reactionCount: "desc" } },
        take: limit,
      });

      const userIds = userStats.map((s) => s.authorId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          profileTitle: true,
          profileBorder: true,
          countryId: true,
          isChampion: true,
          country: {
            select: { id: true, nameEn: true, flagEmoji: true },
          },
        },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const entries = userStats
        .map((stat) => {
          const user = userMap.get(stat.authorId);
          if (!user) return null;
          const reactions = stat._sum.reactionCount ?? 0;
          const comments = stat._sum.commentCount ?? 0;
          const shares = stat._sum.shareCount ?? 0;
          const score = reactions + comments * 2 + shares * 3;
          return {
            rank: 0,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              profileTitle: user.profileTitle,
              profileBorder: user.profileBorder,
              countryId: user.countryId,
            },
            country: user.country,
            medal: null as "GOLD" | "SILVER" | "BRONZE" | null,
            score,
            totalPosts: stat._count.id,
            totalApprovedSuggestions: 0,
            totalCultureContributions: 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .map((entry, index) => ({
          ...entry!,
          rank: index + 1,
          medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
        }));

      return NextResponse.json({
        type: "creator",
        source: "realtime",
        seasonId: null,
        entries,
      });
    }

    case "meme": {
      // Top posts by engagement score
      const posts = await prisma.post.findMany({
        where: {
          status: { in: ["PUBLISHED", "DRAFT"] },
          visibility: "PUBLIC",
        },
        orderBy: [{ rankingScore: "desc" }, { reactionCount: "desc" }],
        take: limit,
        select: {
          id: true,
          title: true,
          authorId: true,
          countryId: true,
          reactionCount: true,
          commentCount: true,
          shareCount: true,
          translationCount: true,
          rankingScore: true,
          images: {
            orderBy: { orderIndex: "asc" },
            take: 1,
            select: { originalUrl: true, width: true, height: true },
          },
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          country: {
            select: { id: true, nameEn: true, flagEmoji: true },
          },
        },
      });

      const entries = posts.map((post, index) => {
        const score =
          post.reactionCount +
          post.commentCount * 2 +
          post.shareCount * 3;
        return {
          rank: index + 1,
          post: {
            id: post.id,
            title: post.title,
            authorId: post.authorId,
            reactionCount: post.reactionCount,
            commentCount: post.commentCount,
            shareCount: post.shareCount,
            translationCount: post.translationCount,
            images: post.images,
            author: post.author,
          },
          country: post.country,
          medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
          score,
          reactionScore: post.reactionCount,
          commentScore: post.commentCount * 2,
          shareScore: post.shareCount * 3,
          translationScore: 0,
          cultureScore: 0,
        };
      });

      return NextResponse.json({
        type: "meme",
        source: "realtime",
        seasonId: null,
        entries,
      });
    }

    default:
      return NextResponse.json(
        { error: "Invalid type. Must be: country, creator, or meme" },
        { status: 400 }
      );
  }
}
