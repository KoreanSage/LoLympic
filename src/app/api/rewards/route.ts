import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET /api/rewards — Get user's rewards and active grants
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all reward grants for this user
    const grants = await prisma.rewardGrant.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        reward: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            type: true,
            config: true,
            isActive: true,
          },
        },
        medal: {
          select: {
            id: true,
            type: true,
            scope: true,
            label: true,
            description: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
            number: true,
          },
        },
      },
    });

    // Separate active vs expired grants
    const now = new Date();
    const active = grants.filter(
      (g) =>
        g.reward.isActive &&
        g.validFrom <= now &&
        (!g.validUntil || g.validUntil > now)
    );
    const expired = grants.filter(
      (g) => g.validUntil && g.validUntil <= now
    );

    // Get user's medals
    const medals = await prisma.medal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            number: true,
          },
        },
      },
    });

    return NextResponse.json({
      userId: user.id,
      activeGrants: active,
      expiredGrants: expired,
      medals,
      totalMedals: {
        gold: medals.filter((m) => m.type === "GOLD").length,
        silver: medals.filter((m) => m.type === "SILVER").length,
        bronze: medals.filter((m) => m.type === "BRONZE").length,
      },
    });
  } catch (error) {
    console.error("Error fetching rewards:", error);
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}
