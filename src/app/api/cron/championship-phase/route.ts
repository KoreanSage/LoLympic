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

    // Track current phase locally so multiple transitions can happen in one run
    let currentPhase = championship.phase;

    // Phase transitions based on date
    // NOMINATION is brief: candidates are auto-nominated on creation (above).
    // Since representative voting starts Dec 1 alongside nomination,
    // immediately transition to REPRESENTATIVE phase so users can vote.
    if (currentPhase === "NOMINATION") {
      await prisma.championship.update({
        where: { id: championship.id },
        data: { phase: "REPRESENTATIVE" },
      });
      currentPhase = "REPRESENTATIVE";
      actions.push("Transitioned to REPRESENTATIVE phase (voting open)");
    }

    if (day >= 16 && currentPhase === "REPRESENTATIVE") {
      // Tally votes and transition to UPLOAD phase
      const tallyResult = await tallyRepresentativeVotes(championship.id);
      actions.push(`Tallied ${tallyResult.tallied} candidate votes`);

      await prisma.championship.update({
        where: { id: championship.id },
        data: { phase: "UPLOAD" },
      });
      currentPhase = "UPLOAD";
      actions.push("Transitioned to UPLOAD phase");
    }

    // On day 20 (last day of upload), check for missing posts early
    // so substitutes can still post before upload period ends
    if (day === 20 && currentPhase === "UPLOAD") {
      const missResult = await handleMissingPosts(championship.id);
      if (missResult.substitutions > 0) {
        actions.push(`Processed ${missResult.substitutions} substitutions (substitutes can still upload today)`);
      }
    }

    if (day >= 21 && currentPhase === "UPLOAD") {
      // Final missing posts check before transitioning
      const missResult = await handleMissingPosts(championship.id);
      if (missResult.substitutions > 0) {
        actions.push(`Processed ${missResult.substitutions} last-minute substitutions`);
      }

      await prisma.championship.update({
        where: { id: championship.id },
        data: { phase: "CHAMPIONSHIP" },
      });
      currentPhase = "CHAMPIONSHIP";
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

    if (day === 31 && currentPhase === "CHAMPIONSHIP") {
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
