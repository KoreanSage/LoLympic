import prisma from "./prisma";

/**
 * Compute and update the rankingScore for a post.
 *
 * Formula (HN-style decay):
 *   score = (reactions*2 + comments*3 + translations*5 + views*0.01)
 *           / (hoursSincePost/24 + 1)^1.2
 *
 * This naturally decays over time while boosting posts with engagement.
 * Called fire-and-forget after reactions/comments are created.
 */
export async function updateRankingScore(postId: string): Promise<void> {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        reactionCount: true,
        commentCount: true,
        translationCount: true,
        viewCount: true,
        createdAt: true,
      },
    });

    if (!post) return;

    const hoursSincePost =
      (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
    const dayAge = hoursSincePost / 24 + 1;
    const decay = Math.pow(dayAge, 1.2);

    const rawScore =
      post.reactionCount * 2 +
      post.commentCount * 3 +
      post.translationCount * 5 +
      post.viewCount * 0.01;

    const rankingScore = rawScore / decay;

    await prisma.post.update({
      where: { id: postId },
      data: { rankingScore },
    });
  } catch (err) {
    console.error("Failed to update ranking score:", err);
  }
}
