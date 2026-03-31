import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.countryBoard.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = user.role && ["ADMIN", "SUPER_ADMIN"].includes(user.role);

  if (post.authorId !== user.id && !isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.countryBoard.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
