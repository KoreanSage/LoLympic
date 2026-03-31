import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const countryId = searchParams.get("countryId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  if (!countryId) return NextResponse.json({ error: "Missing countryId" }, { status: 400 });

  const posts = await prisma.countryBoard.findMany({
    where: { countryId },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, countryId: true },
  });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { countryId, body: postBody } = body;

  if (!countryId || !postBody?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (dbUser.countryId !== countryId)
    return NextResponse.json({ error: "You can only post in your own country board" }, { status: 403 });

  const post = await prisma.countryBoard.create({
    data: { countryId, authorId: dbUser.id, body: postBody.trim() },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
