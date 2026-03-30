import prisma from "@/lib/prisma";

/**
 * Get all user IDs that the given user has blocked OR has been blocked by.
 * Used to filter content in feeds, comments, search, DMs, etc.
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: { blockerId: true, blockedId: true },
  });

  const ids = new Set<string>();
  for (const b of blocks) {
    if (b.blockerId !== userId) ids.add(b.blockerId);
    if (b.blockedId !== userId) ids.add(b.blockedId);
  }
  return Array.from(ids);
}

/**
 * Check if either user has blocked the other.
 */
export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
  });
  return !!block;
}
