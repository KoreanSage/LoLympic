import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createResetToken } from "@/lib/password-reset-tokens";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Generates a password-reset token and logs the reset link.
 * Always returns 200 to avoid leaking whether the email exists.
 */
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers as any, "forgot-password");
    const rl = checkRateLimit(rlKey, RATE_LIMITS.auth);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user — but always return success to prevent enumeration
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true },
    });

    if (user && user.passwordHash) {
      // Only generate token for users with a password (credentials users)
      const token = createResetToken(user.id, user.email);

      // Build reset URL
      const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_URL ||
        "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      // Log the link (replace with email service later)
      console.log(
        `[PASSWORD RESET] User ${user.email} requested a password reset.\n  Reset link: ${resetUrl}`
      );
    }

    // Always return success — don't reveal whether the email exists
    return NextResponse.json({
      message:
        "If an account with that email exists, a password reset link has been generated. Check the server logs.",
    });
  } catch (error) {
    console.error("Forgot-password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
