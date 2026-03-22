/**
 * In-memory password reset token store.
 * Tokens expire after 1 hour and are cleaned up lazily.
 *
 * For production with multiple instances, migrate to a DB-backed store
 * or Redis. This is sufficient for a single-instance deployment.
 */

import crypto from "crypto";

interface TokenEntry {
  userId: string;
  email: string;
  expiresAt: number; // Date.now() millis
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const tokenStore = new Map<string, TokenEntry>();

/** Purge expired tokens (called on every write to keep the map lean). */
function purgeExpired() {
  const now = Date.now();
  Array.from(tokenStore.entries()).forEach(([token, entry]) => {
    if (entry.expiresAt <= now) {
      tokenStore.delete(token);
    }
  });
}

/** Create a reset token for a user. Invalidates any previous token for the same email. */
export function createResetToken(userId: string, email: string): string {
  purgeExpired();

  // Remove any existing token for this email
  Array.from(tokenStore.entries()).forEach(([token, entry]) => {
    if (entry.email === email) {
      tokenStore.delete(token);
    }
  });

  const resetToken = crypto.randomBytes(32).toString("hex");
  tokenStore.set(resetToken, {
    userId,
    email,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  return resetToken;
}

/** Validate and consume a reset token. Returns { userId, email } or null. */
export function consumeResetToken(
  token: string
): { userId: string; email: string } | null {
  const entry = tokenStore.get(token);
  if (!entry) return null;

  // Expired?
  if (entry.expiresAt <= Date.now()) {
    tokenStore.delete(token);
    return null;
  }

  // Consume (single-use)
  tokenStore.delete(token);
  return { userId: entry.userId, email: entry.email };
}
