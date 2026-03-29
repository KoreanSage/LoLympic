import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * GET /api/admin/reports — List all reports with pagination (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const status = searchParams.get("status"); // PENDING, REVIEWING, RESOLVED, DISMISSED

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          reporter: {
            select: { id: true, username: true, displayName: true },
          },
          post: {
            select: { id: true, title: true },
          },
          comment: {
            select: { id: true, body: true },
          },
        },
      }),
      prisma.report.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch reports:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/reports — Update report status (admin only)
 * Body: { reportId, status, resolutionNote?, deleteContent? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { reportId, status, resolutionNote, deleteContent } = body;

    if (!reportId || !status) {
      return NextResponse.json(
        { error: "reportId and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "REVIEWING", "RESOLVED", "DISMISSED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch the report first
    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // If deleteContent is requested, soft-delete the associated post or comment
    if (deleteContent) {
      if (report.postId) {
        await prisma.post.update({
          where: { id: report.postId },
          data: { status: "REMOVED" },
        }).catch(() => {
          // Post may already be removed
        });
      }
      if (report.commentId) {
        await prisma.comment.update({
          where: { id: report.commentId },
          data: { status: "REMOVED" },
        }).catch(() => {
          // Comment may already be removed
        });
      }
    }

    // Update the report status
    const updated = await prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        resolvedBy: user.id,
        resolvedAt: ["RESOLVED", "DISMISSED"].includes(status)
          ? new Date()
          : undefined,
        resolutionNote: resolutionNote || undefined,
      },
    });

    return NextResponse.json({ report: updated });
  } catch (error) {
    console.error("Failed to update report:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
