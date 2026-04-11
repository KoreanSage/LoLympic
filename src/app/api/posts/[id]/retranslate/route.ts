import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/posts/:id/retranslate
 *
 * Admin-only: Deletes all existing translations for a single post.
 * Client then calls /api/translate to regenerate them.
 *
 * Response: { success, deletedPayloads, deletedNotes, sourceLanguage }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: postId } = await params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, sourceLanguage: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Delete all translations + culture notes for this post
    const result = await prisma.$transaction(async (tx) => {
      const deletedNotes = await tx.cultureNote.deleteMany({
        where: { postId },
      });

      const deletedPayloads = await tx.translationPayload.deleteMany({
        where: { postId },
      });

      // Reset translation count
      await tx.post.update({
        where: { id: postId },
        data: { translationCount: 0 },
      });

      return {
        deletedPayloads: deletedPayloads.count,
        deletedNotes: deletedNotes.count,
      };
    });

    return NextResponse.json({
      success: true,
      sourceLanguage: post.sourceLanguage || "ko",
      ...result,
    });
  } catch (err) {
    console.error("Retranslate post error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
