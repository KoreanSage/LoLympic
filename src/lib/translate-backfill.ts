import prisma from "@/lib/prisma";
import { VALID_LANGUAGES } from "@/lib/constants";
import { translateTitleOrDescription } from "@/lib/title-translation";

interface BackfillPayload {
  id: string;
  segments?: unknown[] | null;
  translatedTitle?: string | null;
  translatedBody?: string | null;
}

interface BackfillPost {
  title?: string | null;
  body?: string | null;
  sourceLanguage?: string | null;
  translationPayloads?: BackfillPayload[] | null;
}

function isValidLang(lang: string): boolean {
  return (VALID_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * Fire-and-forget: for posts that have translation payloads with segments
 * but missing translatedTitle, translate the title and backfill.
 *
 * All Gemini calls go through `translateTitleOrDescription` which does
 * echo-detection and script validation — if Gemini returns the source text
 * back (the ja-echo bug), we retry with a stricter prompt and fall back to
 * leaving the field NULL rather than persisting a bad translation.
 */
export async function backfillMissingTitleTranslations(
  posts: BackfillPost[],
  targetLang: string
) {
  if (!isValidLang(targetLang)) return;

  const toBackfill: Array<{ payloadId: string; title: string; sourceLanguage: string }> = [];

  for (const post of posts) {
    const payloads = post.translationPayloads;
    if (!payloads || payloads.length === 0) continue;
    const payload = payloads[0];
    // Has segments (was translated) but no translatedTitle
    if ((payload.segments?.length ?? 0) > 0 && !payload.translatedTitle && post.title) {
      toBackfill.push({
        payloadId: payload.id,
        title: post.title,
        sourceLanguage: post.sourceLanguage || "ko",
      });
    }
  }

  if (toBackfill.length === 0) return;

  // Process up to 5 at a time to avoid overloading Gemini
  for (const item of toBackfill.slice(0, 5)) {
    try {
      if (item.sourceLanguage === targetLang) continue;

      // Re-check if title was already filled by a concurrent request
      const freshPayload = await prisma.translationPayload.findUnique({
        where: { id: item.payloadId },
        select: { translatedTitle: true },
      });
      if (freshPayload?.translatedTitle) {
        console.debug(`[Backfill] Title already filled for ${item.payloadId}, skipping`);
        continue;
      }

      const translatedTitle = await translateTitleOrDescription({
        sourceText: item.title,
        sourceLanguage: item.sourceLanguage,
        targetLanguage: targetLang,
        kind: "title",
      });

      if (translatedTitle) {
        await prisma.translationPayload.update({
          where: { id: item.payloadId },
          data: { translatedTitle },
        });
      }
    } catch (e) {
      console.warn(`Backfill title translation failed for payload ${item.payloadId}:`, e);
    }
  }
}

/**
 * Same but for a single post (used in post detail API).
 * Returns { translatedTitle, translatedBody } if backfilled, or null.
 */
export async function backfillSinglePostTitle(
  post: BackfillPost,
  targetLang: string
): Promise<{ translatedTitle: string; translatedBody?: string } | null> {
  if (!isValidLang(targetLang)) return null;

  const payloads = post.translationPayloads;
  if (!payloads || payloads.length === 0) return null;
  const payload = payloads[0];
  if (!payload.segments?.length || payload.translatedTitle || !post.title) return null;
  if (post.sourceLanguage === targetLang) return null;

  try {
    // Re-check DB to avoid race condition with concurrent requests
    const freshPayload = await prisma.translationPayload.findUnique({
      where: { id: payload.id },
      select: { translatedTitle: true },
    });
    if (freshPayload?.translatedTitle) return { translatedTitle: freshPayload.translatedTitle };

    const sourceLang = post.sourceLanguage || "ko";
    const translatedTitle = await translateTitleOrDescription({
      sourceText: post.title,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      kind: "title",
    });
    if (!translatedTitle) return null;

    await prisma.translationPayload.update({
      where: { id: payload.id },
      data: { translatedTitle },
    });

    // Also update body if missing
    let translatedBody: string | undefined;
    if (!payload.translatedBody && post.body) {
      const body = await translateTitleOrDescription({
        sourceText: post.body,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        kind: "description",
      });
      if (body) {
        translatedBody = body;
        await prisma.translationPayload.update({
          where: { id: payload.id },
          data: { translatedBody },
        });
      }
    }

    return { translatedTitle, translatedBody };
  } catch (e) {
    console.warn("Backfill single post title failed:", e);
  }
  return null;
}
