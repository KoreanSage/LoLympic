import prisma from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const LANGUAGE_NAMES: Record<string, string> = {
  ko: "Korean (한국어)",
  en: "English",
  ja: "Japanese (日本語)",
  zh: "Chinese (中文)",
  es: "Spanish (Español)",
  hi: "Hindi (हिन्दी)",
  ar: "Arabic (العربية)",
};

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI;
}

/**
 * Fire-and-forget: for posts that have translation payloads with segments
 * but missing translatedTitle, translate the title and backfill.
 */
export async function backfillMissingTitleTranslations(
  posts: any[],
  targetLang: string
) {
  const toBackfill: Array<{ payloadId: string; title: string; sourceLanguage: string }> = [];

  for (const post of posts) {
    const payloads = post.translationPayloads;
    if (!payloads || payloads.length === 0) continue;
    const payload = payloads[0];
    // Has segments (was translated) but no translatedTitle
    if (payload.segments?.length > 0 && !payload.translatedTitle && post.title) {
      toBackfill.push({
        payloadId: payload.id,
        title: post.title,
        sourceLanguage: post.sourceLanguage || "ko",
      });
    }
  }

  if (toBackfill.length === 0) return;

  const targetName = LANGUAGE_NAMES[targetLang] || targetLang;
  const model = getGenAI().getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
  });

  // Process up to 5 at a time to avoid overloading
  for (const item of toBackfill.slice(0, 5)) {
    try {
      if (item.sourceLanguage === targetLang) continue;

      const result = await model.generateContent(
        `Translate the following meme title to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${item.title}`
      );
      const translatedTitle = result.response.text().trim();
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
 * Same but for a single post (used in post detail API)
 */
export async function backfillSinglePostTitle(
  post: any,
  targetLang: string
) {
  const payloads = post.translationPayloads;
  if (!payloads || payloads.length === 0) return;
  const payload = payloads[0];
  if (!payload.segments?.length || payload.translatedTitle || !post.title) return;
  if (post.sourceLanguage === targetLang) return;

  try {
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang;
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.0-flash-lite",
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });

    const result = await model.generateContent(
      `Translate the following meme title to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${post.title}`
    );
    const translatedTitle = result.response.text().trim();
    if (translatedTitle) {
      await prisma.translationPayload.update({
        where: { id: payload.id },
        data: { translatedTitle },
      });
      // Also update body if missing
      if (!payload.translatedBody && post.body) {
        const bodyResult = await model.generateContent(
          `Translate the following meme description to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${post.body}`
        );
        const translatedBody = bodyResult.response.text().trim();
        if (translatedBody) {
          await prisma.translationPayload.update({
            where: { id: payload.id },
            data: { translatedBody },
          });
        }
      }
    }
  } catch (e) {
    console.warn("Backfill single post title failed:", e);
  }
}
