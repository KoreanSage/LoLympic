import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";

// ---------------------------------------------------------------------------
// GET /api/leaderboard?type=country|creator|meme[&seasonId=xxx][&limit=10]
// ---------------------------------------------------------------------------
const LEADERBOARD_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "country";
    const seasonId = searchParams.get("seasonId");
    const lang = searchParams.get("lang") || null; // target language for translated titles
    const parsedLimit = parseInt(searchParams.get("limit") || "20", 10);
    const limit = Math.min(
      50,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 20)
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

    // My score breakdown
    if (type === "my-score") {
      const user = await getSessionUser();
      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      const postStats = await prisma.post.aggregate({
        where: { authorId: user.id, status: "PUBLISHED", visibility: "PUBLIC" },
        _sum: { reactionCount: true, commentCount: true, shareCount: true },
      });
      const reactions = postStats._sum.reactionCount ?? 0;
      const comments = postStats._sum.commentCount ?? 0;
      const shares = postStats._sum.shareCount ?? 0;
      const totalScore = reactions + comments * 2 + shares * 3;

      // Calculate rank
      const allCreatorStats = await prisma.post.groupBy({
        by: ["authorId"],
        where: { status: "PUBLISHED", visibility: "PUBLIC" },
        _sum: { reactionCount: true, commentCount: true, shareCount: true },
      });
      const scores = allCreatorStats.map((s) => {
        const r = s._sum.reactionCount ?? 0;
        const c = s._sum.commentCount ?? 0;
        const sh = s._sum.shareCount ?? 0;
        return r + c * 2 + sh * 3;
      }).sort((a, b) => b - a);
      const rank = scores.findIndex((s) => s <= totalScore) + 1;
      const totalUsers = scores.length;

      return NextResponse.json(
        { reactions, comments, shares, totalScore, rank: rank || totalUsers, totalUsers },
        { headers: LEADERBOARD_CACHE_HEADERS }
      );
    }

    // MVP (weekly + monthly)
    if (type === "mvp") {
      const now = new Date();
      // Week starts Monday (ISO-style): reduces confusion and matches common UX.
      const weekStart = new Date(now);
      const dow = weekStart.getDay(); // 0 = Sunday
      const offset = (dow + 6) % 7; // days since Monday
      weekStart.setDate(now.getDate() - offset);
      weekStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [weeklyReactions, monthlyReactions] = await Promise.all([
        prisma.postReaction.groupBy({
          by: ["postId"],
          where: { createdAt: { gte: weekStart } },
          _count: { id: true },
        }),
        prisma.postReaction.groupBy({
          by: ["postId"],
          where: { createdAt: { gte: monthStart } },
          _count: { id: true },
        }),
      ]);

      // Resolve ALL unique postIds in a single query to avoid duplicate N lookups.
      const allPostIds = Array.from(
        new Set([
          ...weeklyReactions.map((r) => r.postId),
          ...monthlyReactions.map((r) => r.postId),
        ])
      );
      const allPosts = allPostIds.length
        ? await prisma.post.findMany({
            where: { id: { in: allPostIds }, status: "PUBLISHED", visibility: "PUBLIC" },
            select: { id: true, authorId: true },
          })
        : [];
      const postAuthorMap = new Map(allPosts.map((p) => [p.id, p.authorId]));

      const aggregate = (reactions: Array<{ postId: string; _count: { id: number } }>) => {
        const authorScores = new Map<string, number>();
        for (const r of reactions) {
          const authorId = postAuthorMap.get(r.postId);
          if (!authorId) continue;
          authorScores.set(authorId, (authorScores.get(authorId) || 0) + r._count.id);
        }
        if (authorScores.size === 0) return null;
        return Array.from(authorScores.entries()).sort((a, b) => b[1] - a[1])[0];
      };

      const weeklyTop = aggregate(weeklyReactions);
      const monthlyTop = aggregate(monthlyReactions);

      // Batch-fetch both top authors in a single query.
      const authorIds = Array.from(
        new Set([weeklyTop?.[0], monthlyTop?.[0]].filter((x): x is string => !!x))
      );
      const users = authorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              country: { select: { flagEmoji: true } },
            },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      const buildMvp = (top: [string, number] | null) => {
        if (!top) return null;
        const user = userMap.get(top[0]);
        if (!user) return null;
        return {
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          countryFlag: user.country?.flagEmoji,
          reactionCount: top[1],
        };
      };

      return NextResponse.json(
        { weeklyMvp: buildMvp(weeklyTop), monthlyMvp: buildMvp(monthlyTop) },
        { headers: LEADERBOARD_CACHE_HEADERS }
      );
    }

    // Country matchup (top 2 countries this week)
    if (type === "country-matchup") {
      const now = new Date();
      const weekStart = new Date(now);
      const dow = weekStart.getDay();
      const offset = (dow + 6) % 7; // days since Monday
      weekStart.setDate(now.getDate() - offset);
      weekStart.setHours(0, 0, 0, 0);

      const weeklyReactions = await prisma.postReaction.groupBy({
        by: ["postId"],
        where: { createdAt: { gte: weekStart } },
        _count: { id: true },
      });

      const postIds = weeklyReactions.map((r) => r.postId);
      const posts = await prisma.post.findMany({
        where: { id: { in: postIds }, status: "PUBLISHED", visibility: "PUBLIC", countryId: { not: null } },
        select: { id: true, countryId: true },
      });
      const postCountryMap = new Map(posts.map((p) => [p.id, p.countryId]));

      const countryScores = new Map<string, number>();
      for (const r of weeklyReactions) {
        const countryId = postCountryMap.get(r.postId);
        if (!countryId) continue;
        countryScores.set(countryId, (countryScores.get(countryId) || 0) + r._count.id);
      }

      const sorted = Array.from(countryScores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2);
      if (sorted.length < 2) {
        return NextResponse.json({ matchup: null }, { headers: LEADERBOARD_CACHE_HEADERS });
      }

      const countryDetails = await prisma.country.findMany({
        where: { id: { in: sorted.map((s) => s[0]) } },
        select: { id: true, nameEn: true, flagEmoji: true },
      });
      const countryMap = new Map(countryDetails.map((c) => [c.id, c]));

      const matchup = sorted.map(([cid, count]) => ({
        country: countryMap.get(cid) || { id: cid, nameEn: cid, flagEmoji: "" },
        weeklyReactions: count,
      }));

      return NextResponse.json(
        { matchup },
        { headers: LEADERBOARD_CACHE_HEADERS }
      );
    }

    // Battle leaderboard is always realtime (not season-dependent)
    if (type === "battle") {
      const result = await handleBattleLeaderboard(limit);
      const body = await result.json();
      return NextResponse.json(body, { headers: LEADERBOARD_CACHE_HEADERS });
    }

    // If we have a season, try season stats first — fallback to realtime if empty
    if (resolvedSeasonId) {
      const result = await handleSeasonLeaderboard(type, resolvedSeasonId, limit, lang);
      const body = await result.json();
      if (body.entries && body.entries.length > 0) {
        return NextResponse.json(body, { headers: LEADERBOARD_CACHE_HEADERS });
      }
      // Season stats empty — fall through to realtime
    }

    // No season or empty season stats: fallback to realtime
    const result = await handleRealtimeLeaderboard(type, limit, lang);
    const body = await result.json();
    return NextResponse.json(body, { headers: LEADERBOARD_CACHE_HEADERS });
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
  limit: number,
  lang: string | null = null
) {
  switch (type) {
    case "country": {
      const stats = await prisma.countrySeasonStat.findMany({
        where: { seasonId },
        orderBy: { totalScore: "desc" },
        take: 100, // fetch all to recalculate per-user average
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

      // Count active users per country (users with >= 1 post in this season)
      const activeUserCounts = await prisma.post.groupBy({
        by: ["countryId", "authorId"],
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          countryId: { not: null },
          postSeasonStats: { some: { seasonId } },
        },
      });
      const activeUsersMap = new Map<string, number>();
      for (const row of activeUserCounts) {
        if (!row.countryId) continue;
        activeUsersMap.set(row.countryId, (activeUsersMap.get(row.countryId) || 0) + 1);
      }

      // Calculate per-user average: totalScore / max(activeUsers, 5)
      const entriesWithPerUser = stats.map((stat) => {
        const activeUsers = activeUsersMap.get(stat.countryId) || 0;
        const divisor = Math.max(activeUsers, 5);
        const perUserScore = Math.round((stat.totalScore / divisor) * 100) / 100;
        return {
          ...stat,
          activeUsers,
          perUserScore,
        };
      });

      // Sort by perUserScore (descending)
      entriesWithPerUser.sort((a, b) => b.perUserScore - a.perUserScore);

      // Apply limit and rank
      const sliced = entriesWithPerUser.slice(0, limit);

      return NextResponse.json({
        type: "country",
        source: "season",
        seasonId,
        entries: sliced.map((stat, index) => ({
          rank: index + 1,
          country: stat.country,
          medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
          score: stat.perUserScore,
          totalScore: stat.totalScore,
          perUserScore: stat.perUserScore,
          activeUsers: stat.activeUsers,
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
              tier: true,
              level: true,
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
              // Fetch all completed/approved translations (up to 7 languages) for fallback support
              translationPayloads: {
                where: { status: { in: ["COMPLETED", "APPROVED"] } },
                orderBy: { version: "desc" as const },
                take: 7,
                select: { targetLanguage: true, translatedTitle: true },
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
        entries: stats.map((stat, index) => {
          const post = stat.post;
          const payloads = Array.isArray((post as unknown as Record<string, unknown>).translationPayloads)
            ? ((post as unknown as Record<string, unknown>).translationPayloads as Array<{ targetLanguage: string; translatedTitle: string | null }>)
            : [];
          // Preferred language → English fallback → original title (no random-language fallback)
          const preferred = lang ? payloads.find((p) => p.targetLanguage === lang && p.translatedTitle) : null;
          const englishFallback = (!preferred && lang !== "en") ? payloads.find((p) => p.targetLanguage === "en" && p.translatedTitle) : null;
          const translatedTitle = preferred?.translatedTitle ?? englishFallback?.translatedTitle ?? null;
          return {
            rank: stat.globalRank ?? index + 1,
            post: {
              id: post.id,
              title: post.title,
              translatedTitle,
              authorId: post.authorId,
              reactionCount: post.reactionCount,
              commentCount: post.commentCount,
              shareCount: post.shareCount,
              translationCount: post.translationCount,
              images: post.images,
              author: post.author,
            },
            country: stat.country,
            medal: index < 3 ? (["GOLD", "SILVER", "BRONZE"] as const)[index] : null,
            score: stat.totalScore,
            reactionScore: stat.reactionScore,
            commentScore: stat.commentScore,
            shareScore: stat.shareScore,
            translationScore: stat.translationScore,
            cultureScore: stat.cultureScore,
          };
        }),
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
async function handleRealtimeLeaderboard(type: string, limit: number, lang: string | null = null) {
  // Current year boundaries for yearly rankings (resets only at year-end)
  const now = new Date();
  const thisYearStart = new Date(now.getFullYear(), 0, 1); // Jan 1
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1); // Jan 1 next year

  switch (type) {
    case "country": {
      // Count reactions RECEIVED this month, grouped by post's country
      const countryReactions = await prisma.postReaction.groupBy({
        by: ["postId"],
        where: {
          createdAt: { gte: thisYearStart, lt: nextYearStart },
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

      // Count active users per country (users who posted this month)
      const activeUsersByCountry = await prisma.post.groupBy({
        by: ["countryId", "authorId"],
        where: {
          status: "PUBLISHED",
          visibility: "PUBLIC",
          countryId: { in: countryIds },
          createdAt: { gte: thisYearStart, lt: nextYearStart },
        },
      });
      const activeUsersMap = new Map<string, number>();
      for (const row of activeUsersByCountry) {
        if (!row.countryId) continue;
        activeUsersMap.set(row.countryId, (activeUsersMap.get(row.countryId) || 0) + 1);
      }

      // Build entries using monthly reaction scores with per-user average
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
          const activeUsers = activeUsersMap.get(cid) || 0;
          const divisor = Math.max(activeUsers, 5);
          const perUserScore = Math.round((monthlyScore / divisor) * 100) / 100;
          return {
            rank: 0,
            country,
            medal: null as "GOLD" | "SILVER" | "BRONZE" | null,
            score: perUserScore,
            totalScore: monthlyScore,
            perUserScore,
            activeUsers,
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
          tier: true,
          level: true,
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
              tier: user.tier,
              level: user.level,
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
          // Fetch all completed/approved translations (up to 7 languages) for fallback support
          translationPayloads: {
            where: { status: { in: ["COMPLETED", "APPROVED"] } },
            orderBy: { version: "desc" as const },
            take: 7,
            select: { targetLanguage: true, translatedTitle: true },
          },
        },
      });

      const entries = posts.map((post, index) => {
        const payloads = Array.isArray((post as unknown as Record<string, unknown>).translationPayloads)
          ? ((post as unknown as Record<string, unknown>).translationPayloads as Array<{ targetLanguage: string; translatedTitle: string | null }>)
          : [];
        // Preferred language → English fallback → original title (no random-language fallback)
        const preferred = lang ? payloads.find((p) => p.targetLanguage === lang && p.translatedTitle) : null;
        const englishFallback = (!preferred && lang !== "en") ? payloads.find((p) => p.targetLanguage === "en" && p.translatedTitle) : null;
        const translatedTitle = preferred?.translatedTitle ?? englishFallback?.translatedTitle ?? null;
        const score =
          post.reactionCount +
          post.commentCount * 2 +
          post.shareCount * 3;
        return {
          rank: index + 1,
          post: {
            id: post.id,
            title: post.title,
            translatedTitle,
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
