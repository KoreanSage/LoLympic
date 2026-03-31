import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/championship/posts
 * Returns all championship posts (Phase 2).
 */
export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();

    const championship = await prisma.championship.findUnique({
      where: { year },
    });

    if (!championship) {
      return NextResponse.json({ posts: [] });
    }

    const posts = await prisma.championshipPost.findMany({
      where: { championshipId: championship.id },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            images: { select: { originalUrl: true }, take: 1 },
            reactionCount: true,
          },
        },
        user: {
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
      orderBy: { battleVoteCount: "desc" },
    });

    return NextResponse.json({
      championshipId: championship.id,
      phase: championship.phase,
      posts: posts.map((p) => ({
        id: p.id,
        postId: p.postId,
        userId: p.userId,
        countryId: p.countryId,
        battleVoteCount: p.battleVoteCount,
        finalRank: p.finalRank,
        post: p.post,
        user: p.user,
        country: p.country,
      })),
    });
  } catch (error) {
    console.error("Championship posts GET error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

/**
 * POST /api/championship/posts
 * Register a championship post. Body: { postId }
 * Rules:
 *  - Only ELECTED or SUBSTITUTE candidates can post
 *  - Must be within upload period (Dec 16-20)
 *  - Links an existing Post as ChampionshipPost
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const now = new Date();
    const year = now.getFullYear();

    const championship = await prisma.championship.findUnique({
      where: { year },
    });

    if (!championship) {
      return NextResponse.json({ error: "No active championship" }, { status: 400 });
    }

    // Check upload period
    if (now < championship.uploadStartAt || now > championship.uploadEndAt) {
      return NextResponse.json({ error: "Upload period is not active" }, { status: 400 });
    }

    // Check if user is an elected candidate
    const candidate = await prisma.championshipCandidate.findFirst({
      where: {
        championshipId: championship.id,
        userId: user.id,
        status: { in: ["ELECTED", "SUBSTITUTE"] },
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: "Only elected representatives can submit championship posts" }, { status: 403 });
    }

    // Check if this country already has a championship post
    const existingPost = await prisma.championshipPost.findUnique({
      where: {
        championshipId_countryId: {
          championshipId: championship.id,
          countryId: candidate.countryId,
        },
      },
    });

    if (existingPost) {
      return NextResponse.json({ error: "Your country already has a championship post" }, { status: 400 });
    }

    // Verify the post exists and belongs to the user
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, status: true },
    });

    if (!post || post.authorId !== user.id) {
      return NextResponse.json({ error: "Post not found or not owned by you" }, { status: 400 });
    }

    if (post.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Post must be published" }, { status: 400 });
    }

    // Create championship post
    const championshipPost = await prisma.championshipPost.create({
      data: {
        championshipId: championship.id,
        postId,
        userId: user.id,
        countryId: candidate.countryId,
      },
    });

    return NextResponse.json({ success: true, championshipPost: { id: championshipPost.id } });
  } catch (error) {
    console.error("Championship posts POST error:", error);
    return NextResponse.json({ error: "Failed to submit championship post" }, { status: 500 });
  }
}
