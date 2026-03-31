import prisma from "./prisma";
import { checkAndAwardBadges } from "./badges";

export async function updateUploadStreak(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { uploadStreakCount: true, uploadStreakLastDate: true },
  });
  if (!user) return;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const lastDate = user.uploadStreakLastDate
    ? new Date(user.uploadStreakLastDate)
    : null;
  if (lastDate) lastDate.setUTCHours(0, 0, 0, 0);

  const isToday = lastDate?.getTime() === today.getTime();
  if (isToday) return; // Already uploaded today

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = lastDate?.getTime() === yesterday.getTime();

  const newStreak = isYesterday ? (user.uploadStreakCount ?? 0) + 1 : 1;

  await prisma.user.update({
    where: { id: userId },
    data: {
      uploadStreakCount: newStreak,
      uploadStreakLastDate: today,
    },
  });

  // Streak milestone bonus notifications
  if (newStreak === 7 || newStreak === 14 || newStreak === 30) {
    await prisma.notification.create({
      data: {
        recipientId: userId,
        type: "STREAK_BONUS",
        metadata: { streak: newStreak },
      },
    });
  }

  // Badge check
  await checkAndAwardBadges(userId);
}
