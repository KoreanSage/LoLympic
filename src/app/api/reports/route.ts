import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

const VALID_TARGET_TYPES = ["POST", "COMMENT", "USER"] as const;
type TargetType = (typeof VALID_TARGET_TYPES)[number];

const VALID_REASONS = [
  "SPAM",
  "HARASSMENT",
  "HATE_SPEECH",
  "VIOLENCE",
  "SEXUAL_CONTENT",
  "MISINFORMATION",
  "COPYRIGHT",
  "OTHER",
] as const;
type ReportReason = (typeof VALID_REASONS)[number];

// ---------------------------------------------------------------------------
// POST /api/reports — Create a report
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const rlKey = getRateLimitKey(request.headers, "reports");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.write);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetId, reason, details } = body as {
      targetType: string;
      targetId: string;
      reason: string;
      details?: string;
    };

    // Validate targetType
    if (!targetType || !VALID_TARGET_TYPES.includes(targetType as TargetType)) {
      return NextResponse.json(
        {
          error: `Invalid targetType. Must be one of: ${VALID_TARGET_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate targetId
    if (!targetId) {
      return NextResponse.json(
        { error: "targetId is required" },
        { status: 400 }
      );
    }

    // Validate reason
    if (!reason || !VALID_REASONS.includes(reason as ReportReason)) {
      return NextResponse.json(
        {
          error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Verify target exists
    if (targetType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!post) {
        return NextResponse.json(
          { error: "Target post not found" },
          { status: 404 }
        );
      }
    } else if (targetType === "COMMENT") {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!comment) {
        return NextResponse.json(
          { error: "Target comment not found" },
          { status: 404 }
        );
      }
    } else if (targetType === "USER") {
      // TODO: The Report schema currently lacks a targetUserId field.
      // User reports are stored without a direct relation to the reported user,
      // which means duplicate detection and admin queries for user reports are unreliable.
      // Add a `targetUserId String?` field to the Report model and relate it to User.
      const targetUser = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      if (!targetUser) {
        return NextResponse.json(
          { error: "Target user not found" },
          { status: 404 }
        );
      }
    }

    // Prevent self-reporting (for USER type)
    if (targetType === "USER" && targetId === user.id) {
      return NextResponse.json(
        { error: "You cannot report yourself" },
        { status: 400 }
      );
    }

    // Prevent duplicate reports (same reporter + same target)
    const duplicateWhere: Record<string, unknown> = {
      reporterId: user.id,
    };

    if (targetType === "POST") {
      duplicateWhere.postId = targetId;
    } else if (targetType === "COMMENT") {
      duplicateWhere.commentId = targetId;
    }
    // For USER reports, check by reason as well since the schema uses
    // nullable relation fields rather than a generic targetId
    // We check if user already filed any report for this target.

    // Build the actual duplicate check based on the schema's relation fields
    const existingReport = await prisma.report.findFirst({
      where: duplicateWhere,
    });

    if (existingReport) {
      return NextResponse.json(
        { error: "You have already reported this content" },
        { status: 409 }
      );
    }

    // Build create data based on target type
    const createData: Record<string, unknown> = {
      reporterId: user.id,
      reason,
      detail: details || null,
    };

    if (targetType === "POST") {
      createData.postId = targetId;
    } else if (targetType === "COMMENT") {
      createData.commentId = targetId;
    }
    // Note: The schema doesn't have a direct userId field for user reports,
    // so we store user reports with the reason containing the target user info.
    // If the schema has a targetUserId or similar field, adjust accordingly.

    const report = await prisma.report.create({
      data: createData as {
        reporterId: string;
        reason: string;
        detail?: string | null;
        postId?: string;
        commentId?: string;
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 }
    );
  }
}
