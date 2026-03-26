import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { consumeResetToken } from "@/lib/password-reset-tokens";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/auth/reset-password
 * Body: { token: string, password: string }
 *
 * Validates the reset token and updates the user's password.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit to prevent brute-force token guessing
    const rlKey = getRateLimitKey(request.headers, "reset-password");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.auth);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const { token, password } = await request.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Reset token is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate & consume token (single-use, now DB-backed)
    const result = await consumeResetToken(token);
    if (!result) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: result.userId },
      data: { passwordHash },
    });

    console.log(`[PASSWORD RESET] Password updated for user ${result.email}`);

    return NextResponse.json({
      message: "Password has been reset successfully. You can now sign in.",
    });
  } catch (error) {
    console.error("Reset-password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
