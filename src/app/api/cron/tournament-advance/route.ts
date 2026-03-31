import { NextResponse } from "next/server";

/**
 * GET /api/cron/tournament-advance
 *
 * DEPRECATED: Tournament system has been replaced by the Championship system.
 * Championship phase advancement is handled by /api/cron/championship-phase.
 */
export async function GET() {
  return NextResponse.json({
    actions: ["Tournament cron disabled - replaced by championship system"],
    timestamp: new Date().toISOString(),
  });
}
