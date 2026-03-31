import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a user is eligible to vote (account created 30+ days ago) */
export function isVoteEligible(userCreatedAt: Date): boolean {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return userCreatedAt <= thirtyDaysAgo;
}

/** Calculate weighted vote score: domestic 70% + foreign 30% */
export function calculateWeightedScore(
  domesticVotes: number,
  foreignVotes: number
): number {
  return domesticVotes * 0.7 + foreignVotes * 0.3;
}

// ---------------------------------------------------------------------------
// Championship lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a championship instance for the given season & year.
 * All dates follow the fixed December schedule.
 */
export async function createChampionship(seasonId: string, year: number) {
  const existing = await prisma.championship.findUnique({ where: { year } });
  if (existing) return existing;

  return prisma.championship.create({
    data: {
      seasonId,
      year,
      phase: "NOMINATION",
      nominationStartAt: new Date(year, 11, 1, 0, 0, 0),
      nominationEndAt: new Date(year, 11, 10, 23, 59, 59),
      representativeStartAt: new Date(year, 11, 1, 0, 0, 0),
      representativeEndAt: new Date(year, 11, 15, 23, 59, 59),
      uploadStartAt: new Date(year, 11, 16, 0, 0, 0),
      uploadEndAt: new Date(year, 11, 20, 23, 59, 59),
      battleStartAt: new Date(year, 11, 21, 0, 0, 0),
      battleEndAt: new Date(year, 11, 30, 23, 59, 59),
      resultAt: new Date(year, 11, 31, 0, 0, 0),
    },
  });
}

/**
 * Auto-nominate top 3 creators per country based on UserSeasonStat totalScore.
 * If a country has only 1 user, auto-elect them.
 */
export async function nominateCandidates(championshipId: string) {
  const championship = await prisma.championship.findUnique({
    where: { id: championshipId },
  });
  if (!championship) throw new Error("Championship not found");

  // Get all user season stats for this season, grouped by country
  const stats = await prisma.userSeasonStat.findMany({
    where: { seasonId: championship.seasonId, countryId: { not: null } },
    orderBy: { totalScore: "desc" },
    include: { user: { select: { id: true } } },
  });

  // Group by country
  const byCountry = new Map<string, typeof stats>();
  for (const s of stats) {
    if (!s.countryId) continue;
    const list = byCountry.get(s.countryId) || [];
    list.push(s);
    byCountry.set(s.countryId, list);
  }

  const candidates: Array<{
    championshipId: string;
    userId: string;
    countryId: string;
    rank: number;
    status: "NOMINATED" | "ELECTED";
    seasonScore: number;
    autoElected: boolean;
  }> = [];

  const countryEntries = Array.from(byCountry.entries());
  for (const [countryId, countryStats] of countryEntries) {
    const top3 = countryStats.slice(0, 3);
    const isSingleUser = countryStats.length === 1;

    for (let i = 0; i < top3.length; i++) {
      candidates.push({
        championshipId,
        userId: top3[i].user.id,
        countryId,
        rank: i + 1,
        status: isSingleUser ? "ELECTED" : "NOMINATED",
        seasonScore: top3[i].totalScore,
        autoElected: isSingleUser,
      });
    }
  }

  if (candidates.length === 0) return { created: 0 };

  // Bulk create (skip duplicates)
  const result = await prisma.championshipCandidate.createMany({
    data: candidates,
    skipDuplicates: true,
  });

  // Send notifications to nominated candidates
  const notifications = candidates.map((c) => ({
    recipientId: c.userId,
    type: "CHAMPIONSHIP_NOMINATED" as const,
    metadata: { championshipId, countryId: c.countryId, rank: c.rank, autoElected: c.autoElected },
  }));

  await prisma.notification.createMany({ data: notifications });

  return { created: result.count };
}

/**
 * Tally Phase 1 votes: determine representative per country.
 * Weighted scoring: domestic 70% + foreign 30%.
 */
export async function tallyRepresentativeVotes(championshipId: string) {
  const championship = await prisma.championship.findUnique({
    where: { id: championshipId },
    include: { candidates: true },
  });
  if (!championship) throw new Error("Championship not found");

  // Get all votes for this championship
  const votes = await prisma.championshipVote.findMany({
    where: { championshipId },
    include: { candidate: { select: { countryId: true } } },
  });

  // Group candidates by country
  const candidatesByCountry = new Map<string, typeof championship.candidates>();
  for (const c of championship.candidates) {
    // Skip auto-elected
    if (c.autoElected) continue;
    const list = candidatesByCountry.get(c.countryId) || [];
    list.push(c);
    candidatesByCountry.set(c.countryId, list);
  }

  const updates: Promise<unknown>[] = [];

  const countryCanEntries = Array.from(candidatesByCountry.entries());
  for (const [countryId, countryCandidates] of countryCanEntries) {
    // Calculate weighted scores for each candidate
    const scores = countryCandidates.map((candidate: typeof championship.candidates[number]) => {
      const candidateVotes = votes.filter((v) => v.candidateId === candidate.id);
      const domesticVotes = candidateVotes.filter((v) => v.voterCountryId === countryId).length;
      const foreignVotes = candidateVotes.filter((v) => v.voterCountryId !== countryId).length;
      const weightedScore = calculateWeightedScore(domesticVotes, foreignVotes);
      return {
        candidate,
        voteCount: candidateVotes.length,
        weightedScore,
      };
    });

    // Sort by weighted score desc, then by seasonScore desc as tiebreaker
    scores.sort((a, b) => {
      if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
      return b.candidate.seasonScore - a.candidate.seasonScore;
    });

    for (let i = 0; i < scores.length; i++) {
      const { candidate, voteCount, weightedScore } = scores[i];
      let status: "ELECTED" | "RUNNER_UP" | "ELIMINATED";
      if (i === 0) status = "ELECTED";
      else if (i === 1) status = "RUNNER_UP";
      else status = "ELIMINATED";

      updates.push(
        prisma.championshipCandidate.update({
          where: { id: candidate.id },
          data: { status, voteCount, weightedVoteScore: weightedScore },
        })
      );
    }
  }

  await Promise.all(updates);

  // Send election notifications
  const electedCandidates = await prisma.championshipCandidate.findMany({
    where: { championshipId, status: "ELECTED" },
  });

  if (electedCandidates.length > 0) {
    await prisma.notification.createMany({
      data: electedCandidates.map((c) => ({
        recipientId: c.userId,
        type: "CHAMPIONSHIP_ELECTED" as const,
        metadata: { championshipId, countryId: c.countryId },
      })),
    });
  }

  return { tallied: updates.length };
}

/**
 * Handle missing championship posts from elected representatives.
 * Promote RUNNER_UP to ELECTED if the original rep didn't post.
 */
export async function handleMissingPosts(championshipId: string) {
  const elected = await prisma.championshipCandidate.findMany({
    where: { championshipId, status: "ELECTED" },
  });

  const existingPosts = await prisma.championshipPost.findMany({
    where: { championshipId },
    select: { userId: true },
  });
  const postedUserIds = new Set(existingPosts.map((p) => p.userId));

  let substitutions = 0;

  for (const candidate of elected) {
    if (postedUserIds.has(candidate.userId)) continue;

    // This elected candidate hasn't posted - find runner-up
    const runnerUp = await prisma.championshipCandidate.findFirst({
      where: {
        championshipId,
        countryId: candidate.countryId,
        status: "RUNNER_UP",
      },
      orderBy: { weightedVoteScore: "desc" },
    });

    if (runnerUp) {
      await prisma.$transaction([
        prisma.championshipCandidate.update({
          where: { id: candidate.id },
          data: { status: "ELIMINATED" },
        }),
        prisma.championshipCandidate.update({
          where: { id: runnerUp.id },
          data: { status: "SUBSTITUTE" },
        }),
        prisma.notification.create({
          data: {
            recipientId: runnerUp.userId,
            type: "CHAMPIONSHIP_ELECTED",
            metadata: {
              championshipId,
              countryId: runnerUp.countryId,
              substitute: true,
            },
          },
        }),
      ]);
      substitutions++;
    } else {
      // No runner-up available, just eliminate
      await prisma.championshipCandidate.update({
        where: { id: candidate.id },
        data: { status: "ELIMINATED" },
      });
    }
  }

  return { substitutions };
}

/**
 * Tally Phase 2 battle votes and determine final rankings.
 * Tiebreak by the original post's reactionCount.
 */
export async function tallyBattleVotes(championshipId: string) {
  const posts = await prisma.championshipPost.findMany({
    where: { championshipId },
    include: {
      post: { select: { reactionCount: true } },
      _count: { select: { battleVotes: true } },
    },
  });

  // Update vote counts
  const updates = posts.map((p) =>
    prisma.championshipPost.update({
      where: { id: p.id },
      data: { battleVoteCount: p._count.battleVotes },
    })
  );
  await Promise.all(updates);

  // Sort for ranking: by battleVoteCount desc, then reactionCount desc
  const sorted = [...posts].sort((a, b) => {
    const aDiff = b._count.battleVotes - a._count.battleVotes;
    if (aDiff !== 0) return aDiff;
    return (b.post.reactionCount ?? 0) - (a.post.reactionCount ?? 0);
  });

  // Set final ranks
  const rankUpdates = sorted.map((p, i) =>
    prisma.championshipPost.update({
      where: { id: p.id },
      data: { finalRank: i + 1 },
    })
  );
  await Promise.all(rankUpdates);

  return { ranked: sorted.length };
}

/**
 * Finalize the championship: set champion, award badges, broadcast results.
 */
export async function finalizeChampionship(championshipId: string) {
  const winner = await prisma.championshipPost.findFirst({
    where: { championshipId, finalRank: 1 },
    include: { user: true },
  });

  if (!winner) return { success: false, error: "No winner found" };

  // Update championship with winner info
  await prisma.championship.update({
    where: { id: championshipId },
    data: {
      phase: "COMPLETED",
      championUserId: winner.userId,
      championCountryId: winner.countryId,
      championPostId: winner.postId,
    },
  });

  // Award champion status to user
  await prisma.user.update({
    where: { id: winner.userId },
    data: {
      isChampion: true,
      profileBorder: "gold",
    },
  });

  // Award badges
  const badgeData = [
    { userId: winner.userId, badgeKey: "CHAMPIONSHIP_CHAMPION" },
  ];

  // Runner-up badge
  const runnerUp = await prisma.championshipPost.findFirst({
    where: { championshipId, finalRank: 2 },
  });
  if (runnerUp) {
    badgeData.push({ userId: runnerUp.userId, badgeKey: "CHAMPIONSHIP_RUNNER_UP" });
  }

  // Representative badges for all participants
  const allPosts = await prisma.championshipPost.findMany({
    where: { championshipId },
    select: { userId: true },
  });
  for (const p of allPosts) {
    badgeData.push({ userId: p.userId, badgeKey: "CHAMPIONSHIP_REPRESENTATIVE" });
  }

  await prisma.userBadge.createMany({ data: badgeData, skipDuplicates: true });

  // Broadcast result notification to all users
  const allUsers = await prisma.user.findMany({
    select: { id: true },
    where: { isBanned: false },
  });

  if (allUsers.length > 0) {
    await prisma.notification.createMany({
      data: allUsers.map((u) => ({
        recipientId: u.id,
        type: "CHAMPIONSHIP_RESULT" as const,
        metadata: {
          championshipId,
          championUserId: winner.userId,
          championCountryId: winner.countryId,
        },
      })),
    });
  }

  return { success: true, championUserId: winner.userId };
}

/**
 * Get the currently active championship (if any).
 */
export async function getActiveChampionship() {
  const now = new Date();
  const year = now.getFullYear();

  return prisma.championship.findUnique({
    where: { year },
    include: {
      candidates: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              countryId: true,
            },
          },
          country: {
            select: { id: true, nameEn: true, flagEmoji: true },
          },
        },
        orderBy: [{ countryId: "asc" }, { rank: "asc" }],
      },
      posts: {
        include: {
          post: {
            select: {
              id: true,
              title: true,
              images: { select: { originalUrl: true }, take: 1 },
              reactionCount: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          country: {
            select: { id: true, nameEn: true, flagEmoji: true },
          },
        },
        orderBy: { battleVoteCount: "desc" },
      },
    },
  });
}
