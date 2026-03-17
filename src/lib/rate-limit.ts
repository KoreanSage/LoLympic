/**
 * Simple in-memory rate limiter for API routes.
 * For production at scale, replace with Redis-based solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key);
  });
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/** Preset configs for different endpoint types */
export const RATE_LIMITS = {
  /** Expensive AI calls: 5 per minute */
  translate: { max: 5, windowSeconds: 60 } as RateLimitConfig,
  /** File uploads: 20 per minute */
  upload: { max: 20, windowSeconds: 60 } as RateLimitConfig,
  /** Auth attempts: 10 per minute */
  auth: { max: 10, windowSeconds: 60 } as RateLimitConfig,
  /** Write operations (post, comment, follow, report): 30 per minute */
  write: { max: 30, windowSeconds: 60 } as RateLimitConfig,
  /** Read operations: 120 per minute */
  read: { max: 120, windowSeconds: 60 } as RateLimitConfig,
} as const;

/**
 * Check rate limit for a given key (usually IP or userId).
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true };
  }

  if (entry.count < config.max) {
    entry.count++;
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfter: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/**
 * Extract a rate-limit key from headers (IP-based).
 * Works with Vercel, Cloudflare, and direct connections.
 */
export function getRateLimitKey(headers: Headers, prefix: string): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}
