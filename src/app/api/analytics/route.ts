import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/analytics — Log analytics events.
 * Privacy-respecting: no auth required, no PII stored.
 * Rate limited to prevent abuse.
 *
 * Accepted events: page_view, meme_upload, meme_share, battle_vote, language_switch
 */

const ALLOWED_EVENTS = new Set([
  "page_view",
  "meme_upload",
  "meme_share",
  "battle_vote",
  "language_switch",
]);

export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "analytics");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.read);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const body = await request.json();
    const { event, data, timestamp } = body as {
      event?: string;
      data?: Record<string, unknown>;
      timestamp?: number;
    };

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: "Unknown event type" }, { status: 400 });
    }

    // Log the event (in production, this could write to a database or external service)
    console.log(
      JSON.stringify({
        type: "analytics",
        event,
        data: data || {},
        timestamp: timestamp || Date.now(),
      })
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
