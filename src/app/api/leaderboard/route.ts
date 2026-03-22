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

    // Battle leaderboard is always realtime (not season-dependent)
    if (type === "battle") {
      return handleBattleLeaderboard(limit);
    }

    // If we have a season, try season stats first — fallback to realtime if empty
    if (resolvedSeasonId) {
      const result = await handleSeasonLeaderboard(type, resolvedSeasonId, limit);
      const body = await result.json();
      if (body.entries && body.entries.length > 0) {
        return NextResponse.json(body);
      }
      // Season stats empty — fall through to realtime
    }

    // No season or empty season stats: fallback to realtime
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
// Battle leaderboard (always realtime)
// ---------------------------------------------------------------------------
async function handleBattleLeaderboard(limit: number) {
  const posts = await prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      battleWins: { gt: 0 },
    },
    orderBy: [{ battleWins: "desc" }, { reactionCount: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      reactionCount: true,
      battleWins: true,
      battleLosses: true,
      images: {
        orderBy: { orderIndex: "asc" },
        take: 1,
        select: { originalUrl: true },
      },
      author: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      country: {
        select: { id: true, flagEmoji: true, nameEn: true },
      },
    },
  });

  return NextResponse.json({
    type: "battle",
    source: "realtime",
    seasonId: null,
    entries: posts.map((p) => ({
      id: p.id,
      title: p.title,
      imageUrl: p.images[0]?.originalUrl || "",
      reactionCount: p.reactionCount,
      battleWins: p.battleWins,
      battleLosses: p.battleLosses,
      author: p.author,
      country: p.country,
    })),
  });
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
  // Current month boundaries for "this month's" rankings
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  switch (type) {
    case "country": {
      // Count reactions RECEIVED this month, grouped by post's country
      const countryReactions = await prisma.postReaction.groupBy({
        by: ["postId"],
        where: {
          createdAt: { gte: thisMonthStart, lt: nextMonthStart },
          post: {
            status: "PUBLISHED",
            visibility: "PUBLIC",
            countryId: { not: null },
          },
        },
        _count: { id: true },
      });

      // Fetch posts to get countryId mapping
      const postIds = countryReactions.map((r) => r.postId);
      const posts = await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, countryId: true },
      });
      const postCountryMap = new Map(posts.map((p) => [p.id, p.countryId]));

      // Aggregate by country
      const countryScoreMap = new Map<string, number>();
      for (const r of countryReactions) {
        const countryId = postCountryMap.get(r.postId);
        if (!countryId) continue;
        countryScoreMap.set(countryId, (countryScoreMap.get(countryId) || 0) + r._count.id);
      }

      // Also get post counts per country (all time for context)
      const countryStats = await prisma.post.groupBy({
        by: ["countryId"],
        where: {
          countryId: { not: null },
          status: "PUBLISHED",
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
          status: "PUBLISHED",
          visibility: "PUBLIC",
        },
        _count: { authorId: true },
      });
      const creatorCountMap = new Map(
        creatorCounts.map((c) => [c.countryId, c._count.authorId])
      );

      // Build entries using monthly reaction scores
      const allCountryIds = Array.from(new Set([
        ...countryStats.map((s) => s.countryId).filter((id): id is string => id !== null),
        ...Array.from(countryScoreMap.keys()),
      ]));

      const entries = allCountryIds
        .map((cid) => {
          const country = countryMap.get(cid);
          if (!country) return null;
          const stat = countryStats.find((s) => s.countryId === cid);
          const monthlyScore = countryScoreMap.get(cid) || 0;
          return {
            rank: 0,
            country,
            medal: null as "GOLD" | "SILVER" | "BRONZE" | null,
            score: monthlyScore, // This month's reactions received
            totalPosts: stat?._count.id ?? 0,
            totalCreators: creatorCountMap.get(cid) ?? 0,
            totalReactions: monthlyScore,
            totalShares: stat?._sum.shareCount ?? 0,
            totalTranslationViews: 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b!.score - a!.score)
        .slice(0, limit)
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
          status: "PUBLISHED",
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
          status: "PUBLISHED",
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
