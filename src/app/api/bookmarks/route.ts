import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

// POST /api/bookmarks — save a post
export async function POST(req: NextRequest) {
  const rlKey = getRateLimitKey(req.headers, "bookmark");
  const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { postId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { postId } = body;
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  // Verify post exists
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Upsert bookmark (idempotent)
  await prisma.postSave.upsert({
    where: { postId_userId: { postId, userId: user.id } },
    create: { postId, userId: user.id },
    update: {},
  });

  return NextResponse.json({ saved: true });
}

// DELETE /api/bookmarks — remove a saved post
export async function DELETE(req: NextRequest) {
  const rlKey = getRateLimitKey(req.headers, "bookmark");
  const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { postId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { postId } = body;
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  await prisma.postSave.deleteMany({
    where: { postId, userId: user.id },
  });

  return NextResponse.json({ saved: false });
}

// GET /api/bookmarks — list saved posts for current user (paginated)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  const skip = (page - 1) * limit;

  const [saves, totalCount] = await Promise.all([
    prisma.postSave.findMany({
      where: { userId: user.id },
      select: { postId: true },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.postSave.count({
      where: { userId: user.id },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return NextResponse.json({
    postIds: saves.map((s) => s.postId),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  });
}
