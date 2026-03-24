/**
 * Rate limiter for API routes.
 *
 * SERVERLESS LIMITATION: This uses an in-memory Map which resets on every
 * cold start and is NOT shared across Vercel serverless function instances.
 * However, it still provides meaningful protection within a single warm
 * instance (which can handle many sequential requests). For production at
 * scale, set the RATE_LIMIT_KV_URL environment variable to use Vercel KV
 * (backed by Upstash Redis) for distributed rate limiting.
 *
 * Acceptable for initial launch with low-to-moderate traffic.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes (only runs in warm instances)
if (typeof globalThis !== "undefined") {
  const interval = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (entry.resetAt < now) store.delete(key);
    });
  }, 5 * 60 * 1000);
  // Prevent the timer from keeping the process alive in edge cases
  if (interval && typeof interval === "object" && "unref" in interval) {
    interval.unref();
  }
}

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
 * Uses x-forwarded-for (set by Vercel/reverse proxies) to get the real
 * client IP, falling back to x-real-ip and then "unknown".
 */
export function getRateLimitKey(headers: Headers, prefix: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0]?.trim() : null) ||
    headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}
