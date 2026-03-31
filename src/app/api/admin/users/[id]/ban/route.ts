import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

const banSchema = z.object({
  reason: z.string().max(500).optional(),
  durationDays: z.number().int().positive().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/admin/users/[id]/ban — Ban a user
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getSessionUser();
    if (
      !currentUser ||
      (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const raw = await request.json();
    const parsed = banSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { reason, durationDays } = parsed.data;

    if (!reason) {
      return NextResponse.json({ error: "reason required" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot ban yourself
    if (id === currentUser.id) {
      return NextResponse.json({ error: "Cannot ban yourself" }, { status: 400 });
    }

    const bannedAt = new Date();
    const bannedUntil =
      durationDays != null
        ? new Date(bannedAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
        : null; // null = permanent ban

    await prisma.user.update({
      where: { id },
      data: {
        isBanned: true,
        banReason: reason,
        bannedAt,
        bannedUntil,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin ban user error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]/ban — Unban a user
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getSessionUser();
    if (
      !currentUser ||
      (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.user.update({
      where: { id },
      data: {
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedUntil: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin unban user error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
