/**
 * Database-backed password reset token store.
 * Tokens expire after 1 hour and are single-use.
 *
 * Uses Prisma PasswordResetToken model for persistence across
 * serverless invocations (unlike the previous in-memory Map approach).
 */

import crypto from "crypto";
import prisma from "@/lib/prisma";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a reset token for a user.
 * Invalidates any previous unused tokens for the same user.
 */
export async function createResetToken(userId: string, email: string): Promise<string> {
  // Mark any existing unused tokens for this user as used
  await prisma.passwordResetToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const resetToken = crypto.randomBytes(32).toString("hex");

  await prisma.passwordResetToken.create({
    data: {
      token: resetToken,
      userId,
      email,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return resetToken;
}

/**
 * Validate and consume a reset token (single-use).
 * Returns { userId, email } or null if invalid/expired/already used.
 */
export async function consumeResetToken(
  token: string
): Promise<{ userId: string; email: string } | null> {
  const entry = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!entry) return null;

  // Already used?
  if (entry.used) return null;

  // Expired?
  if (entry.expiresAt <= new Date()) {
    // Mark as used to keep things clean
    await prisma.passwordResetToken.update({
      where: { id: entry.id },
      data: { used: true },
    });
    return null;
  }

  // Consume (mark as used)
  await prisma.passwordResetToken.update({
    where: { id: entry.id },
    data: { used: true },
  });

  return { userId: entry.userId, email: entry.email };
}
