import prisma from "@/lib/prisma";
import { calculateRank, XP_AWARDS } from "@/lib/levels";

/**
 * Award XP to a user and recalculate their level/tier.
 * Uses atomic increment to avoid race conditions.
 * Fire-and-forget — does not throw on failure.
 */
export async function awardXp(
  userId: string,
  amount: number,
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { totalXp: { increment: amount } },
        select: { totalXp: true, level: true, tier: true },
      });

      const rank = calculateRank(user.totalXp);

      // Only update if level or tier actually changed
      if (rank.level !== user.level || rank.tier !== user.tier) {
        await tx.user.update({
          where: { id: userId },
          data: { level: rank.level, tier: rank.tier },
        });
      }
    });
  } catch (error) {
    console.error(`Failed to award ${amount} XP to user ${userId}:`, error);
  }
}

export { XP_AWARDS };
