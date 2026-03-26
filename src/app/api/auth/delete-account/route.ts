import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const rlKey = getRateLimitKey(req.headers, "delete-account");
  const rl = await checkRateLimit(rlKey, RATE_LIMITS.auth);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: string; confirmation?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { confirmation } = body;

  if (confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Please type DELETE to confirm account deletion" },
      { status: 400 }
    );
  }

  // For credential users, verify password
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (dbUser?.passwordHash) {
    if (!body.password) {
      return NextResponse.json(
        { error: "Password is required to delete your account" },
        { status: 400 }
      );
    }
    const isValid = await bcrypt.compare(body.password, dbUser.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 403 }
      );
    }
  }

  // Delete user - Prisma cascade will handle related data
  await prisma.user.delete({
    where: { id: user.id },
  });

  return NextResponse.json({ success: true });
}
