import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import sharp from "sharp";

/**
 * GET /api/posts/[id]/stats-card
 * Generates a shareable stats card image (PNG) for a meme post.
 * Shows: title, reaction count, view count, country breakdown, mimzy branding.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        title: true,
        reactionCount: true,
        commentCount: true,
        viewCount: true,
        shareCount: true,
        images: { take: 1, orderBy: { orderIndex: "asc" }, select: { originalUrl: true } },
        author: { select: { username: true, displayName: true, country: { select: { flagEmoji: true } } } },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Get reaction breakdown by reactor's country
    const countryReactions = await prisma.postReaction.findMany({
      where: { postId: id },
      select: {
        user: {
          select: { country: { select: { flagEmoji: true, nameEn: true } } },
        },
      },
    });

    const countryMap: Record<string, { flag: string; count: number }> = {};
    for (const r of countryReactions) {
      const flag = r.user.country?.flagEmoji || "\uD83C\uDF0D";
      const name = r.user.country?.nameEn || "Global";
      if (!countryMap[name]) countryMap[name] = { flag, count: 0 };
      countryMap[name].count++;
    }
    const topCountries = Object.entries(countryMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const W = 600;
    const H = 340;
    const title = (post.title || "Untitled").slice(0, 60);
    const author = post.author?.displayName || post.author?.username || "Unknown";
    const authorFlag = post.author?.country?.flagEmoji || "";

    const countryLines = topCountries.length > 0
      ? topCountries.map(([name, { flag, count }]) => `${flag} ${name}: ${count}`).join("   ")
      : "No reactions yet";

    const svg = `
      <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1a1500"/>
            <stop offset="100%" stop-color="#0d0d0d"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect x="0" y="0" width="100%" height="3" fill="#c9a84c"/>

        <text x="30" y="45" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#c9a84c">mimzy.gg</text>
        <text x="30" y="85" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#ffffff">${escapeXml(title)}</text>
        <text x="30" y="110" font-family="Arial,sans-serif" font-size="13" fill="#999999">by ${authorFlag} ${escapeXml(author)}</text>

        <line x1="30" y1="130" x2="570" y2="130" stroke="#333333" stroke-width="1"/>

        <text x="30" y="170" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="#c9a84c">${post.reactionCount}</text>
        <text x="30" y="190" font-family="Arial,sans-serif" font-size="11" fill="#999999">reactions</text>

        <text x="160" y="170" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="#ffffff">${post.viewCount}</text>
        <text x="160" y="190" font-family="Arial,sans-serif" font-size="11" fill="#999999">views</text>

        <text x="290" y="170" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="#ffffff">${post.commentCount}</text>
        <text x="290" y="190" font-family="Arial,sans-serif" font-size="11" fill="#999999">comments</text>

        <text x="420" y="170" font-family="Arial,sans-serif" font-size="36" font-weight="bold" fill="#ffffff">${post.shareCount}</text>
        <text x="420" y="190" font-family="Arial,sans-serif" font-size="11" fill="#999999">shares</text>

        <line x1="30" y1="210" x2="570" y2="210" stroke="#333333" stroke-width="1"/>

        <text x="30" y="240" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="#c9a84c">REACTIONS BY COUNTRY</text>
        <text x="30" y="265" font-family="Arial,sans-serif" font-size="13" fill="#cccccc">${escapeXml(countryLines)}</text>

        <rect x="0" y="${H - 30}" width="100%" height="30" fill="#c9a84c"/>
        <text x="${W / 2}" y="${H - 10}" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#0d0d0d" text-anchor="middle">Your Memes. 7 Languages. One Global Stage.</text>
      </svg>
    `;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    return new NextResponse(Buffer.from(pngBuffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="mimzy-stats.png"`,
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("Stats card error:", error);
    return NextResponse.json({ error: "Failed to generate stats card" }, { status: 500 });
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
