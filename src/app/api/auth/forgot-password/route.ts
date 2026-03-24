import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/auth/forgot-password
 *
 * Password reset via email is not yet available (no email service configured).
 * Returns an honest response instead of silently failing.
 */
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "forgot-password");
    const rl = checkRateLimit(rlKey, RATE_LIMITS.auth);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Password reset is not yet available. Email delivery is coming soon. Please contact support for assistance.",
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("Forgot-password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
