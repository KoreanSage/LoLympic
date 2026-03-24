import prisma from "@/lib/prisma";

/**
 * Generate an empty 16-slot tournament bracket for a season.
 * Creates 8 R16 + 4 QF + 2 SF + 1 Final with null post slots.
 * Schedule: Dec 27 R16, Dec 29 QF, Dec 30 SF, Dec 31 Final.
 *
 * 16 slots = 12 monthly winners + 4 wildcard (top liked non-winners)
 */
export async function generateEmptyBracket(seasonId: string): Promise<{ success: boolean; error?: string }> {
  const existing = await prisma.tournamentMatch.findFirst({ where: { seasonId } });
  if (existing) {
    return { success: false, error: "Tournament already generated" };
  }

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) {
    return { success: false, error: "Season not found" };
  }

  const year = season.endAt.getFullYear();

  // Round of 16: Dec 27-28
  const r16Start = new Date(year, 11, 27, 0, 0, 0);
  const r16End = new Date(year, 11, 28, 23, 59, 59);
  // Quarterfinals: Dec 29
  const qfStart = new Date(year, 11, 29, 0, 0, 0);
  const qfEnd = new Date(year, 11, 29, 23, 59, 59);
  // Semifinals: Dec 30
  const sfStart = new Date(year, 11, 30, 0, 0, 0);
  const sfEnd = new Date(year, 11, 30, 23, 59, 59);
  // Final: Dec 31
  const fStart = new Date(year, 11, 31, 0, 0, 0);
  const fEnd = new Date(year, 11, 31, 23, 59, 59);

  const matches = [
    // Round of 16 — 8 matches
    ...Array.from({ length: 8 }, (_, i) => ({
      seasonId, round: 1, matchIndex: i, startAt: r16Start, endAt: r16End,
    })),
    // Quarterfinals — 4 matches
    ...Array.from({ length: 4 }, (_, i) => ({
      seasonId, round: 2, matchIndex: i, startAt: qfStart, endAt: qfEnd,
    })),
    // Semifinals — 2 matches
    ...Array.from({ length: 2 }, (_, i) => ({
      seasonId, round: 3, matchIndex: i, startAt: sfStart, endAt: sfEnd,
    })),
    // Final — 1 match
    { seasonId, round: 4, matchIndex: 0, startAt: fStart, endAt: fEnd },
  ];

  await prisma.tournamentMatch.createMany({ data: matches });

  return { success: true };
}

/**
 * Assign a monthly winner post to a random empty R16 slot.
 */
export async function assignWinnerToSlot(
  seasonId: string,
  postId: string
): Promise<{ success: boolean; error?: string; slot?: { matchIndex: number; field: string }; remainingSlots?: number }> {
  if (!seasonId || !postId) {
    return { success: false, error: "seasonId and postId required" };
  }

  // Find all R16 matches (round=1) with at least one empty slot
  const r16Matches = await prisma.tournamentMatch.findMany({
    where: {
      seasonId,
      round: 1,
      OR: [{ post1Id: null }, { post2Id: null }],
    },
    orderBy: { matchIndex: "asc" },
  });

  if (r16Matches.length === 0) {
    return { success: false, error: "No empty slots available" };
  }

  // Collect all empty slots
  const emptySlots: { matchId: string; matchIndex: number; field: "post1Id" | "post2Id" }[] = [];
  for (const m of r16Matches) {
    if (m.post1Id === null) emptySlots.push({ matchId: m.id, matchIndex: m.matchIndex, field: "post1Id" });
    if (m.post2Id === null) emptySlots.push({ matchId: m.id, matchIndex: m.matchIndex, field: "post2Id" });
  }

  // Pick random empty slot
  const slot = emptySlots[Math.floor(Math.random() * emptySlots.length)];

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

/**
 * Fill remaining empty R16 slots with wildcard posts.
 * Wildcards = top liked posts from the season that are NOT already monthly winners.
 * Called when 12 monthly winners are placed but 4 slots remain.
 */
export async function fillWildcardSlots(seasonId: string): Promise<{ success: boolean; filled: number }> {
  // Count empty R16 slots
  const r16Matches = await prisma.tournamentMatch.findMany({
    where: {
      seasonId,
      round: 1,
      OR: [{ post1Id: null }, { post2Id: null }],
    },
    orderBy: { matchIndex: "asc" },
  });

  const emptySlots: { matchId: string; field: "post1Id" | "post2Id" }[] = [];
  for (const m of r16Matches) {
    if (m.post1Id === null) emptySlots.push({ matchId: m.id, field: "post1Id" });
    if (m.post2Id === null) emptySlots.push({ matchId: m.id, field: "post2Id" });
  }

  if (emptySlots.length === 0) return { success: true, filled: 0 };

  // Get all monthly winner postIds to exclude
  const monthlyWinners = await prisma.monthlyWinner.findMany({
    where: { seasonId },
    select: { postId: true },
  });
  const winnerPostIds = monthlyWinners.map((w) => w.postId);

  // Get already-placed tournament postIds to exclude
  const allR16 = await prisma.tournamentMatch.findMany({
    where: { seasonId, round: 1 },
    select: { post1Id: true, post2Id: true },
  });
  const placedIds = allR16.flatMap((m) => [m.post1Id, m.post2Id]).filter(Boolean) as string[];
  const excludeIds = Array.from(new Set([...winnerPostIds, ...placedIds]));

  // Find top liked posts not in excludeIds
  const wildcards = await prisma.post.findMany({
    where: {
      seasonId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      id: { notIn: excludeIds },
      images: { some: {} }, // must have images for tournament
    },
    orderBy: { reactionCount: "desc" },
    take: emptySlots.length,
    select: { id: true },
  });

  let filled = 0;
  for (let i = 0; i < Math.min(wildcards.length, emptySlots.length); i++) {
    await prisma.tournamentMatch.update({
      where: { id: emptySlots[i].matchId },
      data: { [emptySlots[i].field]: wildcards[i].id },
    });
    filled++;
  }

  return { success: true, filled };
}
