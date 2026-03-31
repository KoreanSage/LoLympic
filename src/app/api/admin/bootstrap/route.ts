import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * POST /api/admin/bootstrap
 * Header: x-bootstrap-secret: <ADMIN_BOOTSTRAP_SECRET>
 *
 * Promotes the first registered user to SUPER_ADMIN,
 * but only if no SUPER_ADMIN currently exists.
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-bootstrap-secret");
    const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { error: "ADMIN_BOOTSTRAP_SECRET env var is not configured" },
        { status: 500 }
      );
    }

    if (
      !secret ||
      secret.length !== expectedSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expectedSecret))
    ) {
      return NextResponse.json(
        { error: "Invalid bootstrap secret" },
        { status: 401 }
      );
    }

    // Check if a SUPER_ADMIN already exists
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      select: { id: true, email: true, username: true },
    });

    if (existingSuperAdmin) {
      return NextResponse.json({
        message: "A SUPER_ADMIN already exists",
      });
    }

    // Promote the first registered user (oldest createdAt)
    const firstUser = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, username: true },
    });

    if (!firstUser) {
      return NextResponse.json(
        { error: "No users exist yet. Register a user first." },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: "SUPER_ADMIN" },
    });

    console.log(
      `[BOOTSTRAP] Promoted user ${firstUser.email} (${firstUser.username}) to SUPER_ADMIN`
    );

    return NextResponse.json({
      message: "Successfully promoted first user to SUPER_ADMIN",
      superAdmin: {
        id: firstUser.id,
        email: firstUser.email,
        username: firstUser.username,
      },
    });
  } catch (error) {
    console.error("Bootstrap error:", error);
    return NextResponse.json(
      { error: "Bootstrap failed" },
      { status: 500 }
    );
  }
}
