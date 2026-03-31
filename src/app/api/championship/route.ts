import { NextResponse } from "next/server";
import { getActiveChampionship } from "@/lib/championship";

/**
 * GET /api/championship
 * Returns the currently active championship info (phase, schedule, remaining time).
 */
export async function GET() {
  try {
    const championship = await getActiveChampionship();

    if (!championship) {
      return NextResponse.json({ championship: null });
    }

    const now = new Date();

    // Calculate remaining time for current phase
    let phaseEndAt: Date | null = null;
    switch (championship.phase) {
      case "NOMINATION":
        phaseEndAt = championship.nominationEndAt;
        break;
      case "REPRESENTATIVE":
        phaseEndAt = championship.representativeEndAt;
        break;
      case "UPLOAD":
        phaseEndAt = championship.uploadEndAt;
        break;
      case "CHAMPIONSHIP":
        phaseEndAt = championship.battleEndAt;
        break;
      case "COMPLETED":
        phaseEndAt = null;
        break;
    }

    const remainingMs = phaseEndAt ? Math.max(0, phaseEndAt.getTime() - now.getTime()) : 0;

    return NextResponse.json({
      championship: {
        id: championship.id,
        year: championship.year,
        phase: championship.phase,
        schedule: {
          nominationStartAt: championship.nominationStartAt,
          nominationEndAt: championship.nominationEndAt,
          representativeStartAt: championship.representativeStartAt,
          representativeEndAt: championship.representativeEndAt,
          uploadStartAt: championship.uploadStartAt,
          uploadEndAt: championship.uploadEndAt,
          battleStartAt: championship.battleStartAt,
          battleEndAt: championship.battleEndAt,
          resultAt: championship.resultAt,
        },
        remainingMs,
        phaseEndAt,
        championUserId: championship.championUserId,
        championCountryId: championship.championCountryId,
        championPostId: championship.championPostId,
        candidateCount: championship.candidates.length,
        postCount: championship.posts.length,
      },
    });
  } catch (error) {
    console.error("Championship GET error:", error);
    return NextResponse.json({ error: "Failed to fetch championship" }, { status: 500 });
  }
}
