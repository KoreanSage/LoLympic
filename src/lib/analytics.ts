/**
 * Lightweight, privacy-respecting analytics client.
 * Sends events to /api/analytics (fire-and-forget).
 *
 * Events: page_view, meme_upload, meme_share, battle_vote, language_switch
 */
export function trackEvent(event: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, data, timestamp: Date.now() }),
  }).catch(() => {
    // fire and forget — silently ignore errors
  });
}
