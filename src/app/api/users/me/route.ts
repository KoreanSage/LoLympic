import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
        country: {
          select: { id: true, nameEn: true, flagEmoji: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
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
    const { displayName, bio, countryId, avatarUrl, preferredLanguage, uiLanguage } = body as {
      displayName?: string;
      bio?: string;
      countryId?: string;
      avatarUrl?: string;
      preferredLanguage?: string;
      uiLanguage?: string;
    };

    const data: Record<string, unknown> = {};

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

    const validLangs = ["ko", "en", "ja", "zh", "es"];
    if (preferredLanguage !== undefined && validLangs.includes(preferredLanguage)) {
      data.preferredLanguage = preferredLanguage;
    }
    if (uiLanguage !== undefined && validLangs.includes(uiLanguage)) {
      data.uiLanguage = uiLanguage;
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
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
