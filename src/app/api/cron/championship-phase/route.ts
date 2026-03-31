import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  createChampionship,
  nominateCandidates,
  tallyRepresentativeVotes,
  handleMissingPosts,
  tallyBattleVotes,
  finalizeChampionship,
} from "@/lib/championship";

/**
 * GET /api/cron/championship-phase
 * Cron job to manage championship phase transitions.
 * Runs daily during December.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed, December = 11
    const day = now.getDate();
    const actions: string[] = [];

    // Only run in December
    if (month !== 11) {
      return NextResponse.json({ actions: ["Not December, skipping"], timestamp: now.toISOString() });
    }

    // Ensure championship exists
    const activeSeason = await prisma.season.findFirst({
      where: { status: "ACTIVE" },
    });

    if (!activeSeason) {
      return NextResponse.json({ actions: ["No active season"], timestamp: now.toISOString() });
    }

    let championship = await prisma.championship.findUnique({ where: { year } });

    // Dec 1: Create championship & nominate
    if (day >= 1 && !championship) {
      championship = await createChampionship(activeSeason.id, year);
      actions.push(`Created championship for ${year}`);

      const result = await nominateCandidates(championship.id);
      actions.push(`Nominated ${result.created} candidates`);
    }

    if (!championship) {
      return NextResponse.json({ actions: ["No championship found"], timestamp: now.toISOString() });
    }

    // Phase transitions based on date
    if (day >= 1 && day <= 10 && championship.phase === "NOMINATION") {
      // Stay in NOMINATION phase, candidates being nominated
      actions.push("NOMINATION phase active");
    }

    if (day >= 1 && day <= 15 && championship.phase === "NOMINATION" && day > 10) {
      // Transition to REPRESENTATIVE voting phase
      await prisma.championship.update({
        where: { id: championship.id },
        data: { phase: "REPRESENTATIVE" },
      });
      actions.push("Transitioned to REPRESENTATIVE phase");
    }

    if (day === 1 && championship.phase === "NOMINATION") {
      // Also transition to REPRESENTATIVE on day 1 since voting starts on Dec 1
      await prisma.championship.update({
        where: { id: championship.id },
        data: { phase: "REPRESENTATIVE" },
      });
      actions.push("Transitioned to REPRESENTATIVE phase (voting open)");
    }

    if (day >= 16 && day <= 20 && championship.phase === "REPRESENTATIVE") {
      // Tally votes and transition to UPLOAD phase
      const tallyResult = await tallyRepresentativeVotes(championship.id);
      actions.push(`Tallied ${tallyResult.tallied} candidate votes`);

      await prisma.championship.update({
        where: { id: championship.id },
        data: { phase: "UPLOAD" },
      });
      actions.push("Transitioned to UPLOAD phase");
    }

    if (day >= 21 && championship.phase === "UPLOAD") {
      // Handle missing posts (substitute runner-ups)
      const missResult = await handleMissingPosts(championship.id);
      actions.push(`Processed ${missResult.substitutions} substitutions`);

      await prisma.championship.update({
        where: { id: championship.id },
        data: { phase: "CHAMPIONSHIP" },
      });
      actions.push("Transitioned to CHAMPIONSHIP phase");

      // Send vote-open notifications
      const allUsers = await prisma.user.findMany({
        select: { id: true },
        where: { isBanned: false },
      });

      if (allUsers.length > 0) {
        await prisma.notification.createMany({
          data: allUsers.map((u) => ({
            recipientId: u.id,
            type: "CHAMPIONSHIP_VOTE_OPEN" as const,
            metadata: { championshipId: championship!.id },
          })),
        });
        actions.push(`Sent vote-open notifications to ${allUsers.length} users`);
      }
    }

    if (day === 31 && championship.phase === "CHAMPIONSHIP") {
      // Tally battle votes
      const battleResult = await tallyBattleVotes(championship.id);
      actions.push(`Ranked ${battleResult.ranked} championship posts`);

      // Finalize
      const finalResult = await finalizeChampionship(championship.id);
      if (finalResult.success) {
        actions.push(`Championship finalized! Champion: ${finalResult.championUserId}`);
      } else {
        actions.push(`Finalization issue: ${finalResult.error}`);
      }
    }

    return NextResponse.json({ actions, timestamp: now.toISOString() });
  } catch (error) {
    console.error("Cron championship-phase error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
