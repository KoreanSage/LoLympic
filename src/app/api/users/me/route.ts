import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { VALID_LANGUAGES } from "@/lib/constants";

// GET /api/users/me — Get current user's profile
export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        countryId: true,
        preferredLanguage: true,
        uiLanguage: true,
        createdAt: true,
        emailVerified: true,
        passwordHash: true,
        uploadStreakCount: true,
        uploadStreakLastDate: true,
        country: {
          select: { id: true, nameEn: true, flagEmoji: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { passwordHash, ...userWithoutHash } = user;
    return NextResponse.json({ ...userWithoutHash, hasPassword: !!passwordHash });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PATCH /api/users/me — Update current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { username, displayName, bio, countryId, avatarUrl, preferredLanguage, uiLanguage } = body as {
      username?: string;
      displayName?: string;
      bio?: string;
      countryId?: string;
      avatarUrl?: string;
      preferredLanguage?: string;
      uiLanguage?: string;
    };

    const data: Record<string, unknown> = {};

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 30) {
        return NextResponse.json({ error: "Username must be 3-30 characters" }, { status: 400 });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
      }
      // Check uniqueness
      const existing = await prisma.user.findUnique({ where: { username: trimmed } });
      if (existing && existing.id !== sessionUser.id) {
        return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
      }
      data.username = trimmed;
    }

    if (displayName !== undefined) {
      if (displayName.length > 50) {
        return NextResponse.json({ error: "Display name too long (max 50)" }, { status: 400 });
      }
      data.displayName = displayName || null;
    }

    if (bio !== undefined) {
      if (bio.length > 200) {
        return NextResponse.json({ error: "Bio too long (max 200)" }, { status: 400 });
      }
      data.bio = bio || null;
    }

    if (countryId !== undefined) {
      data.countryId = countryId;
    }

    if (avatarUrl !== undefined) {
      data.avatarUrl = avatarUrl || null;
    }

    if (preferredLanguage !== undefined && (VALID_LANGUAGES as readonly string[]).includes(preferredLanguage)) {
      data.preferredLanguage = preferredLanguage;
    }
    if (uiLanguage !== undefined && (VALID_LANGUAGES as readonly string[]).includes(uiLanguage)) {
      data.uiLanguage = uiLanguage;
    }

    // Verify user still exists in DB before updating
    const userExists = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true },
    });
    if (!userExists) {
      return NextResponse.json({ error: "User not found. Please log out and log in again." }, { status: 401 });
    }

    const updated = await prisma.user.update({
      where: { id: sessionUser.id },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        countryId: true,
        preferredLanguage: true,
        uiLanguage: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
