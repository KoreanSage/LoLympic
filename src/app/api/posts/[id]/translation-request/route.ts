import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { authorId: true, title: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (post.authorId === user.id)
    return NextResponse.json({ error: "Cannot request translation for own post" }, { status: 400 });

  // Deduplicate: check for existing request from same actor for same post
  const existing = await prisma.notification.findFirst({
    where: {
      recipientId: post.authorId,
      type: "TRANSLATION_REQUEST",
      postId: params.id,
      actorId: user.id,
    },
  });
  if (existing) return NextResponse.json({ message: "Already requested" });

  await prisma.notification.create({
    data: {
      recipientId: post.authorId,
      type: "TRANSLATION_REQUEST",
      postId: params.id,
      actorId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
