import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

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

    const rlKey = getRateLimitKey(request.headers, "admin_ban");
    const rl = await checkRateLimit(rlKey, { max: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { reason, durationDays } = await request.json();

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

    // Fire-and-forget audit log
    prisma.adminAuditLog.create({
      data: {
        adminId: currentUser.id,
        action: "BAN_USER",
        targetId: id,
        targetType: "USER",
        reason: reason || null,
        metadata: { duration: durationDays, bannedUntil: bannedUntil?.toISOString() ?? null },
      },
    }).catch((e) => console.error("Audit log failed:", e));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin ban user error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id]/ban — Unban a user
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const currentUser = await getSessionUser();
    if (
      !currentUser ||
      (currentUser.role !== "ADMIN" && currentUser.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const rlKey = getRateLimitKey(request.headers, "admin_ban");
    const rl = await checkRateLimit(rlKey, { max: 20, windowSeconds: 60 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    await prisma.user.update({
      where: { id },
      data: {
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedUntil: null,
      },
    });

    // Fire-and-forget audit log
    prisma.adminAuditLog.create({
      data: {
        adminId: currentUser.id,
        action: "UNBAN_USER",
        targetId: id,
        targetType: "USER",
      },
    }).catch((e) => console.error("Audit log failed:", e));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin unban user error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
