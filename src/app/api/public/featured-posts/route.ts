import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const revalidate = 1800;

export async function GET() {
  try {
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { reactionCount: "desc" },
      take: 4,
      include: {
        images: {
          take: 1,
          orderBy: { orderIndex: "asc" },
          select: { originalUrl: true },
        },
        translationPayloads: {
          where: { status: { in: ["COMPLETED", "APPROVED"] }, translatedImageUrl: { not: null } },
          take: 1,
          orderBy: { version: "desc" },
          select: { translatedImageUrl: true, targetLanguage: true },
        },
        author: {
          select: { username: true, displayName: true },
        },
        country: {
          select: { nameEn: true, flagEmoji: true },
        },
      },
    });

    const result = posts.map(p => ({
      id: p.id,
      title: p.title,
      imageUrl: p.images[0]?.originalUrl || null,
      translatedImageUrl: p.translationPayloads[0]?.translatedImageUrl || null,
      reactionCount: p.reactionCount,
      commentCount: p.commentCount,
      author: p.author?.displayName || p.author?.username || "Anonymous",
      country: p.country ? { name: p.country.nameEn, flag: p.country.flagEmoji } : null,
    }));

    return NextResponse.json(
      { posts: result },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ posts: [] });
  }
}
