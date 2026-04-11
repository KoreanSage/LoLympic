import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/community
 * Fetch all country board posts across all countries (global discussion feed)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = 30;

  const posts = await prisma.countryBoard.findMany({
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      country: { select: { id: true, nameEn: true, flagEmoji: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ posts });
}
