import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  LanguageCode,
  SuggestionType,
  TargetEntityType,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/suggestions?postId=xxx[&type=TRANSLATION][&language=ko]
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const type = searchParams.get("type") as SuggestionType | null;
    const language = searchParams.get("language") as LanguageCode | null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    if (!postId) {
      return NextResponse.json(
        { error: "postId query parameter is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      postId,
      status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] },
    };

    if (type) where.type = type;
    if (language) where.targetLanguage = language;

    const [suggestions, total] = await Promise.all([
      prisma.suggestion.findMany({
        where,
        orderBy: [{ upvoteCount: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              countryId: true,
              isChampion: true,
            },
          },
        },
      }),
      prisma.suggestion.count({ where }),
    ]);

    // Get current user's votes
    let userVotes: Record<string, boolean> = {};
    try {
      const user = await getSessionUser();
      if (user) {
        const votes = await prisma.suggestionVote.findMany({
          where: {
            suggestionId: { in: suggestions.map((s) => s.id) },
            userId: user.id,
          },
        });
        userVotes = Object.fromEntries(
          votes.map((v) => [v.suggestionId, v.isUpvote])
        );
      }
    } catch {
      // Not logged in
    }

    return NextResponse.json({
      suggestions: suggestions.map((s) => ({
        ...s,
        userVote: userVotes[s.id] !== undefined ? (userVotes[s.id] ? "up" : "down") : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing suggestions:", error);
    return NextResponse.json(
      { error: "Failed to list suggestions" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/suggestions — Create new suggestion
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      postId,
      type,
      targetLanguage,
      targetEntityType,
      targetEntityId,
      originalText,
      proposedText,
      reason,
    }: {
      postId: string;
      type: string;
      targetLanguage?: string;
      targetEntityType: string;
      targetEntityId: string;
      originalText: string;
      proposedText: string;
      reason?: string;
    } = body;

    // Validation — only postId and proposedText are required now
    if (!postId || !proposedText) {
      return NextResponse.json(
        { error: "Required: postId, proposedText" },
        { status: 400 }
      );
    }

    if (originalText.length > 5000 || proposedText.length > 5000) {
      return NextResponse.json(
        { error: "Text fields must be under 5000 characters" },
        { status: 400 }
      );
    }

    if (reason && reason.length > 1000) {
      return NextResponse.json(
        { error: "Reason must be under 1000 characters" },
        { status: 400 }
      );
    }

    if (!["TRANSLATION", "CULTURE_NOTE"].includes(type)) {
      return NextResponse.json(
        { error: "type must be TRANSLATION or CULTURE_NOTE" },
        { status: 400 }
      );
    }

    if (
      !["TRANSLATION_PAYLOAD", "TRANSLATION_SEGMENT", "CULTURE_NOTE"].includes(
        targetEntityType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "targetEntityType must be TRANSLATION_PAYLOAD, TRANSLATION_SEGMENT, or CULTURE_NOTE",
        },
        { status: 400 }
      );
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, status: true },
    });
    if (!post || post.status === "REMOVED") {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        postId,
        authorId: user.id,
        type: type as SuggestionType,
        targetLanguage: targetLanguage
          ? (targetLanguage as LanguageCode)
          : null,
        targetEntityType: targetEntityType as TargetEntityType,
        targetEntityId,
        originalText,
        proposedText,
        reason: reason ?? null,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ suggestion }, { status: 201 });
  } catch (error) {
    console.error("Error creating suggestion:", error);
    return NextResponse.json(
      { error: "Failed to create suggestion" },
      { status: 500 }
    );
  }
}
