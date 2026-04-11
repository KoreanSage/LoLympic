import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";
import { VALID_LANGUAGES } from "@/lib/constants";

function toLanguageCode(lang: string): LanguageCode | null {
  return (VALID_LANGUAGES as readonly string[]).includes(lang)
    ? (lang as LanguageCode)
    : null;
}

/**
 * GET /api/winner-popup?lang=es
 * Returns the most recent winner announcement that the user may not have seen yet.
 * Checks for:
 *   1. Yearly champion (tournament final decided) — highest priority
 *   2. Monthly winner selected within the last 7 days
 *
 * The client uses localStorage to track which announcements the user has dismissed.
 */
export async function GET(req: NextRequest) {
  const rawLang = req.nextUrl.searchParams.get("lang") || "";
  const lang = toLanguageCode(rawLang); // null if missing / invalid
  try {
    const now = new Date();

    // ─── 1. Check for yearly champion (completed season with tournament winner) ───
    const completedSeason = await prisma.season.findFirst({
      where: {
        status: "COMPLETED",
        championPostId: { not: null },
        // Only show if completed recently (within 14 days)
        endAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { endAt: "desc" },
      select: {
        id: true,
        name: true,
        championPostId: true,
        championUserId: true,
        championCountryId: true,
        startAt: true,
        endAt: true,
      },
    });

    if (completedSeason?.championPostId) {
      const championPost = await prisma.post.findUnique({
        where: { id: completedSeason.championPostId },
        select: {
          id: true,
          title: true,
          sourceLanguage: true,
          reactionCount: true,
          images: { take: 1, orderBy: { orderIndex: "asc" }, select: { originalUrl: true } },
          author: { select: { username: true, displayName: true } },
          country: { select: { flagEmoji: true, nameEn: true } },
        },
      });

      // Fetch translated title and image if language is specified and different from source
      let translatedTitle: string | null = null;
      let translatedImageUrl: string | null = null;
      if (lang && championPost && championPost.sourceLanguage !== lang) {
        const tp = await prisma.translationPayload.findFirst({
          where: {
            postId: completedSeason.championPostId,
            targetLanguage: lang,
            status: { in: ["COMPLETED", "APPROVED"] },
          },
          orderBy: { createdAt: "desc" },
          select: { translatedTitle: true, translatedImageUrl: true },
        });
        translatedTitle = tp?.translatedTitle || null;
        translatedImageUrl = tp?.translatedImageUrl || null;
      }

      // Get country champion data
      let championCountry = null;
      if (completedSeason.championCountryId) {
        const country = await prisma.country.findUnique({
          where: { id: completedSeason.championCountryId },
          select: { flagEmoji: true, nameEn: true },
        });

        if (country) {
          // Get total reactions for this country during the season
          const countryReactions = await prisma.postReaction.groupBy({
            by: ["postId"],
            where: {
              createdAt: { gte: completedSeason.startAt, lte: completedSeason.endAt },
              post: {
                countryId: completedSeason.championCountryId,
                status: "PUBLISHED",
              },
            },
            _count: { id: true },
          });
          const totalReactions = countryReactions.reduce((sum, r) => sum + r._count.id, 0);

          championCountry = {
            flagEmoji: country.flagEmoji,
            nameEn: country.nameEn,
            totalReactions,
          };
        }
      }

      if (championPost) {
        const year = completedSeason.endAt.getFullYear();
        return NextResponse.json({
          winner: {
            type: "yearly",
            year,
            seasonName: completedSeason.name,
            post: {
              id: championPost.id,
              title: championPost.title,
              translatedTitle,
              translatedImageUrl,
              sourceLanguage: championPost.sourceLanguage,
              imageUrl: championPost.images[0]?.originalUrl || "",
            },
            author: {
              username: championPost.author.username,
              displayName: championPost.author.displayName,
            },
            country: championPost.country,
            fireCount: championPost.reactionCount,
            championCountry,
          },
        });
      }
    }

    // ─── 2. Check for recent monthly winner (within 7 days) ───
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentMonthlyWinner = await prisma.monthlyWinner.findFirst({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: "desc" },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            sourceLanguage: true,
            reactionCount: true,
            images: { take: 1, orderBy: { orderIndex: "asc" }, select: { originalUrl: true } },
          },
        },
        author: {
          select: { username: true, displayName: true },
        },
        country: {
          select: { flagEmoji: true, nameEn: true },
        },
      },
    });

    if (recentMonthlyWinner) {
      // Fetch translated title and image if language is specified and different from source
      let monthlyTranslatedTitle: string | null = null;
      let monthlyTranslatedImageUrl: string | null = null;
      if (lang && recentMonthlyWinner.post.sourceLanguage !== lang) {
        const tp = await prisma.translationPayload.findFirst({
          where: {
            postId: recentMonthlyWinner.post.id,
            targetLanguage: lang,
            status: { in: ["COMPLETED", "APPROVED"] },
          },
          orderBy: { createdAt: "desc" },
          select: { translatedTitle: true, translatedImageUrl: true },
        });
        monthlyTranslatedTitle = tp?.translatedTitle || null;
        monthlyTranslatedImageUrl = tp?.translatedImageUrl || null;
      }

      return NextResponse.json({
        winner: {
          type: "monthly",
          month: recentMonthlyWinner.month,
          year: recentMonthlyWinner.year,
          post: {
            id: recentMonthlyWinner.post.id,
            title: recentMonthlyWinner.post.title,
            translatedTitle: monthlyTranslatedTitle,
            translatedImageUrl: monthlyTranslatedImageUrl,
            sourceLanguage: recentMonthlyWinner.post.sourceLanguage,
            imageUrl: recentMonthlyWinner.post.images[0]?.originalUrl || "",
          },
          author: recentMonthlyWinner.author
            ? {
                username: recentMonthlyWinner.author.username,
                displayName: recentMonthlyWinner.author.displayName,
              }
            : null,
          country: recentMonthlyWinner.country
            ? {
                flagEmoji: recentMonthlyWinner.country.flagEmoji,
                nameEn: recentMonthlyWinner.country.nameEn,
              }
            : null,
          fireCount: recentMonthlyWinner.likeCount,
        },
      });
    }

    // No recent winner to announce
    return NextResponse.json({ winner: null });
  } catch (error) {
    console.error("Winner popup API error:", error);
    return NextResponse.json({ winner: null });
  }
}
