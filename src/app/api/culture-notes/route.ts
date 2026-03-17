import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/culture-notes?postId=xxx[&language=ko]
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");
    const language = searchParams.get("language") as LanguageCode | null;

    if (!postId) {
      return NextResponse.json(
        { error: "postId query parameter is required" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      postId,
      status: { in: ["PUBLISHED", "APPROVED"] },
    };

    if (language) {
      where.language = language;
    }

    const notes = await prisma.cultureNote.findMany({
      where,
      orderBy: [{ language: "asc" }, { version: "desc" }],
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Group by language, return latest version per language
    const latestByLanguage = new Map<string, typeof notes[number]>();
    for (const note of notes) {
      const key = note.language;
      if (!latestByLanguage.has(key)) {
        latestByLanguage.set(key, note);
      }
    }

    return NextResponse.json({
      postId,
      notes: Array.from(latestByLanguage.values()),
    });
  } catch (error) {
    console.error("Error fetching culture notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch culture notes" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/culture-notes — Create community culture note
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
      language,
      summary,
      explanation,
      translationNote,
    }: {
      postId: string;
      language: string;
      summary: string;
      explanation: string;
      translationNote?: string;
    } = body;

    if (!postId || !language || !summary || !explanation) {
      return NextResponse.json(
        {
          error:
            "Required fields: postId, language, summary, explanation",
        },
        { status: 400 }
      );
    }

    if (summary.length > 500) {
      return NextResponse.json(
        { error: "Summary must be under 500 characters" },
        { status: 400 }
      );
    }

    if (explanation.length > 5000) {
      return NextResponse.json(
        { error: "Explanation must be under 5000 characters" },
        { status: 400 }
      );
    }

    if (translationNote && translationNote.length > 2000) {
      return NextResponse.json(
        { error: "Translation note must be under 2000 characters" },
        { status: 400 }
      );
    }

    if (!["ko", "en", "ja", "zh", "es"].includes(language)) {
      return NextResponse.json(
        { error: `Invalid language: ${language}` },
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

    // Get next version number
    const latest = await prisma.cultureNote.findFirst({
      where: { postId, language: language as LanguageCode },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const note = await prisma.cultureNote.create({
      data: {
        postId,
        language: language as LanguageCode,
        summary,
        explanation,
        translationNote: translationNote ?? null,
        creatorType: "COMMUNITY",
        creatorId: user.id,
        status: "DRAFT", // Community notes start as draft, need approval
        version: nextVersion,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Error creating culture note:", error);
    return NextResponse.json(
      { error: "Failed to create culture note" },
      { status: 500 }
    );
  }
}
