import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const revalidate = 3600; // ISR: revalidate every hour

export async function GET() {
  try {
    const [posts, translations, users, countries] = await Promise.all([
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.translationPayload.count({ where: { status: { in: ["COMPLETED", "APPROVED"] } } }),
      prisma.user.count(),
      prisma.country.count(),
    ]);

    return NextResponse.json(
      { posts, translations, users, countries, languages: 7 },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ posts: 0, translations: 0, users: 0, countries: 0, languages: 7 });
  }
}
