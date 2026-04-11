// ---------------------------------------------------------------------------
// TEMPORARY debug endpoint for diagnosing QStash publish failures.
// Remove after root cause is identified.
// ---------------------------------------------------------------------------
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const maxDuration = 10;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }

  const envCheck = {
    QSTASH_TOKEN_present: !!process.env.QSTASH_TOKEN,
    QSTASH_TOKEN_length: process.env.QSTASH_TOKEN?.length || 0,
    QSTASH_TOKEN_prefix: process.env.QSTASH_TOKEN?.slice(0, 10) || null,
    QSTASH_CURRENT_SIGNING_KEY_present: !!process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY_present: !!process.env.QSTASH_NEXT_SIGNING_KEY,
    QSTASH_WORKER_URL: process.env.QSTASH_WORKER_URL || null,
    QSTASH_URL: process.env.QSTASH_URL || null,
    NEXT_PUBLIC_TRANSLATE_ASYNC: process.env.NEXT_PUBLIC_TRANSLATE_ASYNC || null,
  };

  // Try a test publish
  let publishResult: Record<string, unknown> = { attempted: false };
  try {
    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: process.env.QSTASH_TOKEN! });
    const result = await client.publishJSON({
      url: process.env.QSTASH_WORKER_URL!,
      body: { test: true, timestamp: Date.now() },
      deduplicationId: `debug-test-${Date.now()}`,
    });
    publishResult = { attempted: true, success: true, result };
  } catch (err) {
    publishResult = {
      attempted: true,
      success: false,
      errorName: err instanceof Error ? err.name : "unknown",
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : null,
    };
  }

  return NextResponse.json({ env: envCheck, publishTest: publishResult });
}
