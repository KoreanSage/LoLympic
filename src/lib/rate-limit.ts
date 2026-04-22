/**
 * Rate limiter for API routes.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are set (production). Falls back to in-memory Map for development.
 *
 * SERVERLESS LIMITATION (in-memory mode): The Map resets on every cold start
 * and is NOT shared across Vercel serverless function instances. The Redis
 * mode solves this by providing distributed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
let warnedNoRedis = false;

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
  /** Expensive AI calls: 30 per minute. A single post upload fires 6 translate
   *  calls (one per target language), plus the post page's auto-retry can
   *  re-fire on navigation — 5/min was too tight and broke normal flows. */
  translate: { max: 30, windowSeconds: 60 } as RateLimitConfig,
  /** File uploads: 20 per minute */
  upload: { max: 20, windowSeconds: 60 } as RateLimitConfig,
  /** Auth attempts: 10 per minute */
  auth: { max: 10, windowSeconds: 60 } as RateLimitConfig,
  /** Write operations (post, comment, follow, report): 30 per minute */
  write: { max: 30, windowSeconds: 60 } as RateLimitConfig,
  /** Read operations: 120 per minute */
  read: { max: 120, windowSeconds: 60 } as RateLimitConfig,
} as const;

// ---------------------------------------------------------------------------
// Upstash Redis rate limiting (fetch-based, no SDK needed)
// ---------------------------------------------------------------------------

async function checkRedisRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: true } | { allowed: false; retryAfter: number } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // fallback to in-memory

  try {
    const redisKey = `rl:${key}`;
    const headers = { Authorization: `Bearer ${token}` };

    // INCR the key
    const incrRes = await fetch(
      `${url}/incr/${encodeURIComponent(redisKey)}`,
      { headers }
    );
    const incrData = await incrRes.json();
    const count = incrData.result as number;

    if (count === 1) {
      // First request in this window — set expiry
      await fetch(
        `${url}/pexpire/${encodeURIComponent(redisKey)}/${windowMs}`,
        { headers }
      );
    }

    if (count <= limit) {
      return { allowed: true };
    }

    // Over limit — estimate retry time from TTL
    const ttlRes = await fetch(
      `${url}/pttl/${encodeURIComponent(redisKey)}`,
      { headers }
    );
    const ttlData = await ttlRes.json();
    const ttlMs = (ttlData.result as number) || windowMs;

    return {
      allowed: false,
      retryAfter: Math.ceil(ttlMs / 1000),
    };
  } catch (err) {
    console.error("Redis rate limit error, falling back to in-memory:", err);
    return null; // fallback to in-memory
  }
}

/**
 * Check rate limit for a given key (usually IP or userId).
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
 *
 * Uses Upstash Redis in production, in-memory Map in development.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const windowMs = config.windowSeconds * 1000;

  // Try Redis first (production)
  const redisResult = await checkRedisRateLimit(key, config.max, windowMs);
  if (redisResult !== null) {
    return redisResult;
  }

  // Fallback: in-memory rate limiting
  if (!warnedNoRedis) {
    console.warn("[rate-limit] Using in-memory store — ineffective in serverless. Configure Redis for production.");
    warnedNoRedis = true;
  }
  return checkRateLimitInMemory(key, config);
}

/**
 * Synchronous in-memory rate limit check.
 * Kept as a named export for cases that need sync behavior.
 */
export function checkRateLimitInMemory(
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
 * Extract a rate-limit key. When `userId` is provided, key by user so shared
 * IPs (corporate NAT, mobile carriers) don't collide. Otherwise fall back to
 * the client IP from x-forwarded-for / x-real-ip.
 */
export function getRateLimitKey(
  headers: Headers,
  prefix: string,
  userId?: string | null,
): string {
  if (userId) return `${prefix}:u:${userId}`;
  const forwarded = headers.get("x-forwarded-for");
  const ip =
    (forwarded ? forwarded.split(",")[0]?.trim() : null) ||
    headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}
