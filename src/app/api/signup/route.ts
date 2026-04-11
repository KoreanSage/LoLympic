import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma, LanguageCode } from "@prisma/client";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { COUNTRY_LANGUAGE_MAP } from "@/lib/constants";

const signupSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  countryId: z.string().max(10).optional(),
  displayName: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  try {
    const rlKey = getRateLimitKey(req.headers, "signup");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.auth);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = signupSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, username, password, countryId, displayName } = parsed.data;

    // Check if email or username already exists
    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { username } }),
    ]);
    if (existingEmail || existingUsername) {
      return NextResponse.json(
        { error: "An account with this email or username already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email,
          username,
          displayName: displayName || username,
          passwordHash,
          countryId: countryId || "US",
          preferredLanguage: (COUNTRY_LANGUAGE_MAP[countryId ?? ""] ?? "en") as LanguageCode,
        },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          countryId: true,
        },
      });
    } catch (createError) {
      if (
        createError instanceof Prisma.PrismaClientKnownRequestError &&
        createError.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "An account with this email or username already exists" },
          { status: 409 }
        );
      }
      throw createError;
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
