import prisma from "@/lib/prisma";

/**
 * Update karma for a user. Fire-and-forget pattern matching xp.ts.
 * @param userId - The user whose karma to update
 * @param type - "post" or "comment" karma
 * @param delta - Amount to change (positive or negative)
 */
export async function updateKarma(
  userId: string,
  type: "post" | "comment",
  delta: number
): Promise<void> {
  try {
    const field = type === "post" ? "postKarma" : "commentKarma";
    await prisma.user.update({
      where: { id: userId },
      data: { [field]: { increment: delta } },
    });
  } catch (e) {
    console.error(`[karma] Failed to update ${type} karma for ${userId}:`, e);
  }
}
