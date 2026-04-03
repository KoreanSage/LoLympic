import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// Helper: pick a random battle pair
// ---------------------------------------------------------------------------
async function getRandomPair(excludePostIds: string[], userId?: string, userLanguage?: string) {
  // Build where clause
  const where: any = {
    status: "PUBLISHED",
    visibility: "PUBLIC",
    // Must have at least one translatable image (not video, not GIF)
    images: {
      some: {
        OR: [
          { mimeType: { notIn: ["video/mp4", "video/webm", "image/gif"] } },
          { mimeType: null }, // legacy posts without mimeType
        ],
      },
    },
  };

  // Filter by user's preferred language: show posts that have translations for their language
  // Only show posts with COMPLETED translations that have translated images
  if (userLanguage) {
    where.OR = [
      { sourceLanguage: userLanguage }, // Posts already in user's language
      {
        translationPayloads: {
          some: {
            targetLanguage: userLanguage,
            status: { in: ["COMPLETED", "APPROVED"] },
            translatedImageUrl: { not: null }, // Must have translated image
          },
        },
      },
    ];
  }

  // Exclude user's own posts
  if (userId) {
    where.authorId = { not: userId };
  }

  // Exclude recently seen posts
  if (excludePostIds.length > 0) {
    where.id = { notIn: excludePostIds };
  }

  const count = await prisma.post.count({ where });
  if (count < 2) {
    // Fallback: try without language filter but still pass language for translations
    if (userLanguage) {
      return getRandomPairFallback(excludePostIds, userId, userLanguage);
    }
    return null;
  }

  // Pick two random distinct posts
  const offset1 = Math.floor(Math.random() * count);
  let offset2 = Math.floor(Math.random() * (count - 1));
  if (offset2 >= offset1) offset2 += 1;

  const select: any = {
    id: true,
    title: true,
    reactionCount: true,
    battleWins: true,
    battleLosses: true,
    _count: { select: { images: true } },
    images: {
      orderBy: { orderIndex: "asc" as const },
      take: 1,
      select: { originalUrl: true, cleanUrl: true },
    },
    author: {
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
      },
    },
    country: {
      select: {
        id: true,
        flagEmoji: true,
        nameEn: true,
      },
    },
  };

  // Include translation for user's language if available (must have image)
  if (userLanguage) {
    select.translationPayloads = {
      where: {
        targetLanguage: userLanguage,
        status: { in: ["COMPLETED", "APPROVED"] },
        translatedImageUrl: { not: null },
      },
      orderBy: { version: "desc" as const },
      take: 1,
      select: {
        translatedTitle: true,
        translatedImageUrl: true,
      },
    };
  }

  const [left, right] = await Promise.all([
    prisma.post.findFirst({ where, skip: offset1, select }),
    prisma.post.findFirst({ where, skip: offset2, select }),
  ]);

  if (!left || !right || left.id === right.id) return null;

  const format = (p: any) => {
    const translation = p.translationPayloads?.[0];
    const translatedImg = translation?.translatedImageUrl?.startsWith("http")
      ? translation.translatedImageUrl
      : null;
    // Prefer translated image > clean image (text removed) > original
    const imageUrl = translatedImg
      || p.images[0]?.cleanUrl
      || p.images[0]?.originalUrl
      || "";
    return {
      id: p.id,
      title: translation?.translatedTitle || p.title,
      imageUrl,
      imageCount: p._count.images,
      reactionCount: p.reactionCount,
      battleWins: p.battleWins,
      battleLosses: p.battleLosses,
      author: p.author,
      country: p.country,
    };
  };

  return { left: format(left), right: format(right) };
}

// ---------------------------------------------------------------------------
// Fallback: no language WHERE filter, but still fetch translations for display
// ---------------------------------------------------------------------------
async function getRandomPairFallback(excludePostIds: string[], userId?: string, userLanguage?: string) {
  const where: any = {
    status: "PUBLISHED",
    visibility: "PUBLIC",
    images: {
      some: {
        OR: [
          { mimeType: { notIn: ["video/mp4", "video/webm", "image/gif"] } },
          { mimeType: null },
        ],
      },
    },
  };

  if (userId) where.authorId = { not: userId };
  if (excludePostIds.length > 0) where.id = { notIn: excludePostIds };

  const count = await prisma.post.count({ where });
  if (count < 2) return null;

  const offset1 = Math.floor(Math.random() * count);
  let offset2 = Math.floor(Math.random() * (count - 1));
  if (offset2 >= offset1) offset2 += 1;

  const select: any = {
    id: true,
    title: true,
    reactionCount: true,
    battleWins: true,
    battleLosses: true,
    _count: { select: { images: true } },
    images: {
      orderBy: { orderIndex: "asc" as const },
      take: 1,
      select: { originalUrl: true, cleanUrl: true },
    },
    author: { select: { username: true, displayName: true, avatarUrl: true } },
    country: { select: { id: true, flagEmoji: true, nameEn: true } },
  };

  // Still fetch translations so we can show translated title/image (must have image)
  if (userLanguage) {
    select.translationPayloads = {
      where: {
        targetLanguage: userLanguage,
        status: { in: ["COMPLETED", "APPROVED"] },
        translatedImageUrl: { not: null },
      },
      orderBy: { version: "desc" as const },
      take: 1,
      select: { translatedTitle: true, translatedImageUrl: true },
    };
  }

  const [left, right] = await Promise.all([
    prisma.post.findFirst({ where, skip: offset1, select }),
    prisma.post.findFirst({ where, skip: offset2, select }),
  ]);

  if (!left || !right || left.id === right.id) return null;

  const format = (p: any) => {
    const translation = p.translationPayloads?.[0];
    const translatedImg = translation?.translatedImageUrl?.startsWith("http")
      ? translation.translatedImageUrl
      : null;
    const imageUrl = translatedImg
      || p.images[0]?.cleanUrl
      || p.images[0]?.originalUrl
      || "";
    return {
      id: p.id,
      title: translation?.translatedTitle || p.title,
      imageUrl,
      imageCount: p._count.images,
      reactionCount: p.reactionCount,
      battleWins: p.battleWins,
      battleLosses: p.battleLosses,
      author: p.author,
      country: p.country,
    };
  };

  return { left: format(left), right: format(right) };
}

// ---------------------------------------------------------------------------
// GET /api/battle — Get a random battle pair
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    const { searchParams } = new URL(request.url);
    const userLanguage = searchParams.get("lang") || user?.preferredLanguage || null;

    // Get recently seen post IDs (last 30 battles) to avoid repetition
    let recentPostIds: string[] = [];
    if (user) {
      const recentBattles = await prisma.battle.findMany({
        where: { voterId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { leftPostId: true, rightPostId: true },
      });
      recentPostIds = recentBattles.flatMap((b) => [b.leftPostId, b.rightPostId]);
    }

    const pair = await getRandomPair(recentPostIds, user?.id, userLanguage || undefined);

    if (!pair) {
      return NextResponse.json({ noBattle: true, message: "Not enough posts for battle" });
    }

    return NextResponse.json(pair);
  } catch (error) {
    console.error("Battle GET error:", error);
    return NextResponse.json({ error: "Failed to get battle" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/battle — Submit a vote
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "battle");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Login required" }, { status: 401 });
    }

    const body = await request.json();
    const { leftPostId, rightPostId, chosenPostId } = body;

    if (!leftPostId || !rightPostId || !chosenPostId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (chosenPostId !== leftPostId && chosenPostId !== rightPostId) {
      return NextResponse.json({ error: "chosenPostId must match left or right" }, { status: 400 });
    }

    const loserId = chosenPostId === leftPostId ? rightPostId : leftPostId;

    // Execute in transaction: record battle + update stats
    await prisma.$transaction([
      prisma.battle.create({
        data: {
          leftPostId,
          rightPostId,
          voterId: user.id,
          chosenPostId,
        },
      }),
      // Winner: +1 win, +5 reaction bonus
      prisma.post.update({
        where: { id: chosenPostId },
        data: {
          battleWins: { increment: 1 },
          reactionCount: { increment: 5 },
        },
      }),
      // Loser: +1 loss
      prisma.post.update({
        where: { id: loserId },
        data: {
          battleLosses: { increment: 1 },
        },
      }),
    ]);

    // Pre-fetch next battle pair
    const userLanguage = body.lang || user?.preferredLanguage || undefined;
    const recentBattles = await prisma.battle.findMany({
      where: { voterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { leftPostId: true, rightPostId: true },
    });
    const recentPostIds = recentBattles.flatMap((b) => [b.leftPostId, b.rightPostId]);
    const nextBattle = await getRandomPair(recentPostIds, user.id, userLanguage);

    return NextResponse.json({
      success: true,
      winnerId: chosenPostId,
      loserId,
      nextBattle: nextBattle || null,
    });
  } catch (error) {
    console.error("Battle POST error:", error);
    return NextResponse.json({ error: "Failed to submit vote" }, { status: 500 });
  }
}
