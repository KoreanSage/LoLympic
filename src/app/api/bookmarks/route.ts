import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/bookmarks — save a post
export async function POST(req: NextRequest) {
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

// GET /api/bookmarks — list saved posts for current user
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const saves = await prisma.postSave.findMany({
    where: { userId: user.id },
    select: { postId: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ postIds: saves.map((s) => s.postId) });
}
