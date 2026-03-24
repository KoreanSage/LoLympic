import prisma from "@/lib/prisma";

/**
 * Generate an empty 8-slot tournament bracket for a season.
 * Creates 4 QF + 2 SF + 1 Final with null post slots.
 * Schedule: Dec 29 QF, Dec 30 SF, Dec 31 Final.
 */
export async function generateEmptyBracket(seasonId: string): Promise<{ success: boolean; error?: string }> {
  // Check no existing tournament
  const existing = await prisma.tournamentMatch.findFirst({ where: { seasonId } });
  if (existing) {
    return { success: false, error: "Tournament already generated" };
  }

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) {
    return { success: false, error: "Season not found" };
  }

  const year = season.endAt.getFullYear();

  const qfStart = new Date(year, 11, 29, 0, 0, 0);
  const qfEnd = new Date(year, 11, 29, 23, 59, 59);
  const sfStart = new Date(year, 11, 30, 0, 0, 0);
  const sfEnd = new Date(year, 11, 30, 23, 59, 59);
  const fStart = new Date(year, 11, 31, 0, 0, 0);
  const fEnd = new Date(year, 11, 31, 23, 59, 59);

  await prisma.tournamentMatch.createMany({
    data: [
      { seasonId, round: 1, matchIndex: 0, startAt: qfStart, endAt: qfEnd },
      { seasonId, round: 1, matchIndex: 1, startAt: qfStart, endAt: qfEnd },
      { seasonId, round: 1, matchIndex: 2, startAt: qfStart, endAt: qfEnd },
      { seasonId, round: 1, matchIndex: 3, startAt: qfStart, endAt: qfEnd },
      { seasonId, round: 2, matchIndex: 0, startAt: sfStart, endAt: sfEnd },
      { seasonId, round: 2, matchIndex: 1, startAt: sfStart, endAt: sfEnd },
      { seasonId, round: 3, matchIndex: 0, startAt: fStart, endAt: fEnd },
    ],
  });

  return { success: true };
}

/**
 * Assign a monthly winner post to a random empty QF slot.
 * Returns info about the assigned slot.
 */
export async function assignWinnerToSlot(
  seasonId: string,
  postId: string
): Promise<{ success: boolean; error?: string; slot?: { matchIndex: number; field: string }; remainingSlots?: number }> {
  if (!seasonId || !postId) {
    return { success: false, error: "seasonId and postId required" };
  }

  // Find all QF matches (round=1) that have at least one empty slot
  const qfMatches = await prisma.tournamentMatch.findMany({
    where: {
      seasonId,
      round: 1,
      OR: [
        { post1Id: null },
        { post2Id: null },
      ],
    },
    orderBy: { matchIndex: "asc" },
  });

  if (qfMatches.length === 0) {
    return { success: false, error: "No empty slots available" };
  }

  // Collect all empty slots
  const emptySlots: { matchId: string; matchIndex: number; field: "post1Id" | "post2Id" }[] = [];
  for (const m of qfMatches) {
    if (m.post1Id === null) {
      emptySlots.push({ matchId: m.id, matchIndex: m.matchIndex, field: "post1Id" });
    }
    if (m.post2Id === null) {
      emptySlots.push({ matchId: m.id, matchIndex: m.matchIndex, field: "post2Id" });
    }
  }

  // Pick a random empty slot
  const randomIdx = Math.floor(Math.random() * emptySlots.length);
  const slot = emptySlots[randomIdx];

  await prisma.tournamentMatch.update({
    where: { id: slot.matchId },
    data: { [slot.field]: postId },
  });

  return {
    success: true,
    slot: { matchIndex: slot.matchIndex, field: slot.field },
    remainingSlots: emptySlots.length - 1,
  };
}
