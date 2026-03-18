import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/users — List all users (admin only)
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        isChampion: true,
        createdAt: true,
        _count: { select: { posts: true } },
      },
      take: 200,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users — Update user role (admin only)
 * Body: { userId, role }
 */
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getSessionUser();
    if (
      !currentUser ||
      (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
    }

    const validRoles = ["USER", "MODERATOR", "ADMIN"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Prevent non-SUPER_ADMIN from granting ADMIN
    if (role === "ADMIN" && currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can grant ADMIN role" },
        { status: 403 }
      );
    }

    // Can't change own role
    if (userId === currentUser.id) {
      return NextResponse.json(
        { error: "Cannot change your own role" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, username: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("Admin update user error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
