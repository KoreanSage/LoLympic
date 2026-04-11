// ---------------------------------------------------------------------------
// POST /api/translate/worker
//
// QStash webhook endpoint that processes a single (postId, targetLanguage)
// translation job asynchronously. Called by QStash with a signed request —
// we verify the signature before running the pipeline.
//
// IMPORTANT: This runs the SAME translation logic as /api/translate but
// for ONE language at a time. All Gemini prompts, models, temperatures,
// LaMa inpainting, Satori rendering, etc. are identical — we just import
// the helpers from the original route file to guarantee quality parity.
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { LanguageCode } from "@prisma/client";
import { verifyQstashSignature, type TranslationJobPayload } from "@/lib/qstash";
import { updateRankingScore } from "@/lib/ranking";
import {
  getGenAI,
  LANGUAGE_INSTRUCTIONS,
  buildTranslationSystemPrompt,
  readImageAsBase64,
  stripMarkdownFences,
  toSemanticRole,
  toTextAlign,
  checkContentSafety,
  generateCleanImagesForPost,
  generateTranslatedImageForPayload,
  getCachedTranslation,
  setCachedTranslation,
  type TranslationSegmentResponse,
  type CultureNoteResponse,
  type AITranslationResult,
} from "@/app/api/translate/route";

// Vercel Pro: allow up to 5 minutes per worker invocation (one language).
// Hobby tier caps at 60s — on Hobby the worker will still finish for most
// posts, but 10-image posts require Pro.
export const maxDuration = 300;

type EnglishAnalysisSegment = TranslationSegmentResponse & { imageIndex: number };

interface EnglishAnalysis {
  segments: EnglishAnalysisSegment[];
  memeType: string | null;
  confidence: number | null;
  cultureNote: CultureNoteResponse | null;
}

// ---------------------------------------------------------------------------
// Run Phase 1 English analysis for all images in a post.
// Uses Redis cache if available (shared with the sync /api/translate path).
// ---------------------------------------------------------------------------
async function runEnglishAnalysis(
  postId: string,
  sourceLanguage: string,
  imageDataList: Array<{ base64: string; mimeType: string }>
): Promise<EnglishAnalysis | null> {
  // Check cache first
  const cached = await getCachedTranslation(postId, "en");
  if (cached && cached.segments && cached.segments.length > 0) {
    console.debug(`[Worker] Using cached English analysis for ${postId}`);
    return {
      segments: cached.segments.map((s) => ({
        ...s,
        imageIndex: (s as EnglishAnalysisSegment).imageIndex ?? 0,
      })),
      memeType: cached.memeType ?? null,
      confidence: cached.confidence ?? null,
      cultureNote: cached.cultureNote || null,
    };
  }

  const enSystemPrompt = buildTranslationSystemPrompt(sourceLanguage, "en");
  const enModel = getGenAI().getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: enSystemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  });

  const enSegments: EnglishAnalysisSegment[] = [];
  let enParsed: AITranslationResult | null = null;
  const enCultureNotes: CultureNoteResponse[] = [];

  const validImages = imageDataList
    .map((imgData, idx) => ({ imgData, idx }))
    .filter(({ imgData }) => !!imgData.base64);

  // Parallelize Gemini Flash analysis across images. Same API calls,
  // same retry behavior, just concurrent. Quality-identical.
  const analysisResults = await Promise.all(
    validImages.map(async ({ imgData, idx }) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
          const result = await enModel.generateContent([
            `Translate this meme from ${sourceLanguage} to en. Analyze the image and detect all EXISTING text regions. If the image has NO text at all, return empty segments array. NEVER invent or add text that is not in the image. Respond ONLY with valid JSON, no markdown fences.${imageDataList.length > 1 ? ` This is image ${idx + 1} of ${imageDataList.length} in a multi-image post.` : ""}`,
            { inlineData: { data: imgData.base64, mimeType: imgData.mimeType } },
          ]);
          if (idx === 0) checkContentSafety(postId, result.response).catch(() => {});
          const text = result.response.text();
          if (!text) continue;
          const parsed = JSON.parse(stripMarkdownFences(text)) as AITranslationResult;
          if (!Array.isArray(parsed.segments)) continue;
          return { idx, parsed };
        } catch (err) {
          console.warn(`[Worker] English analysis attempt ${attempt + 1} failed for image ${idx}:`, err instanceof Error ? err.message : String(err));
        }
      }
      return null;
    })
  );

  // Merge in original image order
  for (const r of analysisResults) {
    if (!r) continue;
    if (!enParsed) enParsed = r.parsed;
    for (const seg of r.parsed.segments) enSegments.push({ ...seg, imageIndex: r.idx });
    if (r.parsed.cultureNote) enCultureNotes.push(r.parsed.cultureNote);
  }

  if (!enParsed) return null;

  const analysis: EnglishAnalysis = {
    segments: enSegments,
    memeType: enParsed.memeType ?? null,
    confidence: enParsed.confidence ?? null,
    cultureNote: enCultureNotes[0] || null,
  };

  setCachedTranslation(postId, "en", {
    memeType: enParsed.memeType ?? "A",
    segments: enSegments.map((s) => ({ ...s })),
    cultureNote: enCultureNotes[0] || { summary: "", explanation: "" },
    confidence: enParsed.confidence,
  }).catch((err) => console.warn("[Worker] Failed to cache English analysis:", err));

  return analysis;
}

// ---------------------------------------------------------------------------
// Translate a single post to a single target language.
// Updates the existing PROCESSING TranslationPayload row in-place.
// ---------------------------------------------------------------------------
async function runTranslationForLanguage(opts: {
  postId: string;
  sourceLanguage: string;
  targetLanguage: string;
  existingPayloadId: string;
}): Promise<{ status: "COMPLETED" | "REJECTED"; error?: string }> {
  const { postId, sourceLanguage, targetLanguage, existingPayloadId } = opts;

  try {
    // 1. Load post + images
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        body: true,
        sourceLanguage: true,
        images: {
          orderBy: { orderIndex: "asc" },
          select: { originalUrl: true, mimeType: true },
        },
      },
    });
    if (!post) {
      await prisma.translationPayload
        .update({ where: { id: existingPayloadId }, data: { status: "REJECTED" } })
        .catch(() => {});
      return { status: "REJECTED", error: "Post not found" };
    }

    const imageUrls = post.images.map((img) => img.originalUrl);
    if (imageUrls.length === 0) {
      await prisma.translationPayload
        .update({ where: { id: existingPayloadId }, data: { status: "REJECTED" } })
        .catch(() => {});
      return { status: "REJECTED", error: "No images" };
    }

    // 2. Read images as base64
    const imageDataList: Array<{ base64: string; mimeType: string }> = [];
    for (const url of imageUrls) {
      try {
        const imageData = await readImageAsBase64(url);
        imageDataList.push(imageData);
      } catch (err) {
        console.error(`[Worker] Failed to read image ${url}:`, err);
        imageDataList.push({ base64: "", mimeType: "image/jpeg" });
      }
    }

    // 3. Kick off clean image generation (LaMa) in parallel with translations
    const cleanImagePromise = generateCleanImagesForPost(postId, imageDataList, imageUrls).catch(
      (e) => console.error("[Worker] Clean image generation failed:", e)
    );

    // 4. PHASE 1 — English image analysis (shared across languages via Redis cache)
    const englishAnalysis = await runEnglishAnalysis(postId, sourceLanguage, imageDataList);

    // 5. PHASE 2 — translate to target language (or use English directly)
    const allSegments: Array<TranslationSegmentResponse & { imageIndex: number }> = [];
    let confidence: number | null = null;
    let memeType: string | null = null;
    let cultureNote: CultureNoteResponse | null = null;

    if (!englishAnalysis || englishAnalysis.segments.length === 0) {
      // Image has no text — empty payload
      confidence = 0.9;
      memeType = "A";
    } else if (targetLanguage === "en") {
      allSegments.push(...englishAnalysis.segments);
      confidence = englishAnalysis.confidence;
      memeType = englishAnalysis.memeType;
      cultureNote = englishAnalysis.cultureNote;
    } else {
      // Try cache
      const cachedTarget = await getCachedTranslation(postId, targetLanguage);
      if (cachedTarget && cachedTarget.segments && cachedTarget.segments.length > 0) {
        console.debug(`[Worker] Using cached ${targetLanguage} translation for ${postId}`);
        for (const seg of cachedTarget.segments) {
          allSegments.push({
            ...seg,
            imageIndex: (seg as EnglishAnalysisSegment).imageIndex ?? 0,
          });
        }
        confidence = cachedTarget.confidence ?? englishAnalysis.confidence;
        memeType = cachedTarget.memeType ?? englishAnalysis.memeType;
        cultureNote = cachedTarget.cultureNote || null;
      } else {
        // Run flash-lite segment re-translation. CRITICAL: do NOT include the
        // original source text in the prompt — at low temperature flash-lite
        // tends to paraphrase the source back instead of translating to the
        // target language (e.g. Japanese prompt → Korean output bug).
        const targetLangInstruction =
          LANGUAGE_INSTRUCTIONS[targetLanguage] || `Target language: ${targetLanguage}`;
        const targetLangName = targetLangInstruction.split(":")[0] || targetLanguage;
        const segmentTexts = englishAnalysis.segments.map((s) => s.translatedText);

        const liteModel = getGenAI().getGenerativeModel({
          model: "gemini-2.5-flash-lite",
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        });

        // Build the prompt without any non-English text to avoid language drift
        const buildPrompt = (extraGuard = "") => `You are a professional translator for mimzy, a global meme platform.

${targetLangInstruction}

TASK: Translate each English meme text below to ${targetLangName}.
CRITICAL RULES:
- Output MUST be in ${targetLangName} only. Do NOT output Korean, English, or any other language.
- Keep the humor, tone, and cultural adaptation. Short, punchy, native-feeling.
- Preserve the array order — one output per input.
${extraGuard}

English texts to translate:
${segmentTexts.map((t, i) => `${i + 1}. "${t}"`).join("\n")}

Also write a SHORT culture note about this meme in ${targetLangName}.

Return JSON only (no markdown fences):
{
  "translations": ["translated text 1", "translated text 2", ...],
  "cultureNote": { "summary": "...", "explanation": "..." }
}`;

        // Helper: detect if output accidentally came back in the source language
        // instead of the target (e.g. Korean output for a Japanese target).
        const looksWrongLanguage = (text: string): boolean => {
          if (!text || !text.trim()) return false;
          const hasHangul = /[\uAC00-\uD7AF]/.test(text);
          const hasHiragana = /[\u3040-\u309F]/.test(text);
          const hasKatakana = /[\u30A0-\u30FF]/.test(text);
          const hasCJKExt = /[\u4E00-\u9FFF]/.test(text);
          const hasArabic = /[\u0600-\u06FF]/.test(text);
          const hasCyrillic = /[\u0400-\u04FF]/.test(text);
          // Korean script in a non-Korean target is the main bug
          if (targetLanguage !== "ko" && hasHangul) return true;
          // Arabic script in a non-Arabic target
          if (targetLanguage !== "ar" && hasArabic) return true;
          // Japanese target should have at least some kana OR CJK
          if (targetLanguage === "ja" && !hasHiragana && !hasKatakana && !hasCJKExt && /[a-zA-Z]/.test(text) === false) return true;
          return false;
        };

        let segParsed: { translations: string[]; cultureNote?: CultureNoteResponse } | null = null;
        let attempt = 0;
        const MAX_ATTEMPTS = 2;
        while (attempt < MAX_ATTEMPTS && !segParsed) {
          attempt++;
          try {
            const extraGuard = attempt > 1
              ? `- Previous attempt returned the WRONG language. You MUST output in ${targetLangName} this time.`
              : "";
            const result = await liteModel.generateContent(buildPrompt(extraGuard));
            const text = result.response.text();
            if (!text) continue;
            const parsed = JSON.parse(stripMarkdownFences(text)) as {
              translations: string[];
              cultureNote?: CultureNoteResponse;
            };
            if (!Array.isArray(parsed.translations)) continue;
            // Check if any translation came back in the wrong language
            const wrongLang = parsed.translations.some((t) => looksWrongLanguage(t));
            if (wrongLang && attempt < MAX_ATTEMPTS) {
              console.warn(`[Worker] ${targetLanguage} output in wrong language, retrying (attempt ${attempt})`);
              continue;
            }
            segParsed = parsed;
          } catch (err) {
            console.warn(`[Worker] Phase 2 attempt ${attempt} failed:`, err);
          }
        }

        if (segParsed && Array.isArray(segParsed.translations)) {
          for (let i = 0; i < englishAnalysis.segments.length; i++) {
            const enSeg = englishAnalysis.segments[i];
            const translation = segParsed.translations[i];
            // If still wrong language after retries, fall back to English
            const finalText = translation && !looksWrongLanguage(translation)
              ? translation
              : enSeg.translatedText;
            allSegments.push({
              sourceText: enSeg.sourceText,
              translatedText: finalText,
              semanticRole: enSeg.semanticRole,
              box: enSeg.box,
              style: enSeg.style,
              imageIndex: enSeg.imageIndex,
            });
          }
          confidence = englishAnalysis.confidence ?? 0.85;
          memeType = englishAnalysis.memeType ?? "A";
          cultureNote = segParsed.cultureNote || null;

          setCachedTranslation(postId, targetLanguage, {
            memeType: memeType || "A",
            segments: allSegments.map((s) => ({ ...s })),
            cultureNote: segParsed.cultureNote || { summary: "", explanation: "" },
            confidence,
          }).catch((err) => console.warn("[Worker] Failed to cache:", err));
        }
      }
    }

    // 6. Translate title/body (flash-lite, cheap)
    let translatedTitle: string | null = null;
    let translatedBody: string | null = null;
    if (targetLanguage !== sourceLanguage) {
      const targetName =
        LANGUAGE_INSTRUCTIONS[targetLanguage]?.split(":")[0] || targetLanguage;
      const [titleResult, bodyResult] = await Promise.allSettled([
        post.title
          ? (async () => {
              const m = getGenAI().getGenerativeModel({
                model: "gemini-2.5-flash-lite",
                generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
              });
              const r = await m.generateContent(
                `Translate the following meme title to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${post.title}`
              );
              return r.response.text().trim();
            })()
          : Promise.resolve(null),
        post.body
          ? (async () => {
              const m = getGenAI().getGenerativeModel({
                model: "gemini-2.5-flash-lite",
                generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
              });
              const r = await m.generateContent(
                `Translate the following meme description to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${post.body}`
              );
              return r.response.text().trim();
            })()
          : Promise.resolve(null),
      ]);
      translatedTitle = titleResult.status === "fulfilled" ? titleResult.value : null;
      translatedBody = bodyResult.status === "fulfilled" ? bodyResult.value : null;
    }

    // 7. UPDATE the existing PROCESSING payload row (no new row, preserves version)
    await prisma.$transaction(async (tx) => {
      // Clear any stale segments from previous attempts
      await tx.translationSegment.deleteMany({
        where: { translationPayloadId: existingPayloadId },
      });

      await tx.translationPayload.update({
        where: { id: existingPayloadId },
        data: {
          status: "COMPLETED",
          confidence,
          memeType,
          translatedTitle,
          translatedBody,
          segments: {
            create: allSegments.map((seg, index) => ({
              orderIndex: index,
              imageIndex: seg.imageIndex,
              sourceText: seg.sourceText,
              translatedText: seg.translatedText,
              semanticRole: toSemanticRole(seg.semanticRole),
              boxX: seg.box?.x ?? null,
              boxY: seg.box?.y ?? null,
              boxWidth: seg.box?.width ?? null,
              boxHeight: seg.box?.height ?? null,
              fontFamily: seg.style?.fontFamily ?? null,
              fontWeight: seg.style?.fontWeight ?? null,
              fontSizePixels: seg.style?.fontSize ?? null,
              color: seg.style?.color ?? null,
              textAlign: toTextAlign(seg.style?.textAlign),
              strokeColor: seg.style?.strokeColor ?? null,
              strokeWidth: seg.style?.strokeWidth ?? null,
              shadowColor: seg.style?.shadowColor ?? null,
            })),
          },
        },
      });

      // Create CultureNote if not exists for this language
      if (cultureNote) {
        const existingNote = await tx.cultureNote.findFirst({
          where: { postId, language: targetLanguage as LanguageCode },
        });
        if (!existingNote) {
          const latestNote = await tx.cultureNote.findFirst({
            where: { postId },
            orderBy: { version: "desc" },
          });
          const noteVersion = (latestNote?.version ?? 0) + 1;
          await tx.cultureNote.create({
            data: {
              postId,
              language: targetLanguage as LanguageCode,
              summary: cultureNote.summary || "",
              explanation: cultureNote.explanation || "",
              translationNote: cultureNote.translationNote ?? null,
              creatorType: "AI",
              status: "PUBLISHED",
              confidence,
              version: noteVersion,
            },
          });
        }
      }

      // Increment post translation count
      await tx.post.update({
        where: { id: postId },
        data: { translationCount: { increment: 1 } },
      });
    });

    // 8. Wait for clean image (LaMa) to finish, then compose translated image
    await cleanImagePromise;

    if (allSegments.length > 0) {
      const segmentsForCompose = allSegments.map((s) => ({
        sourceText: s.sourceText,
        translatedText: s.translatedText,
        semanticRole: s.semanticRole,
        boxX: s.box?.x ?? 0,
        boxY: s.box?.y ?? 0,
        boxWidth: s.box?.width ?? 0,
        boxHeight: s.box?.height ?? 0,
        fontFamily: s.style?.fontFamily,
        fontWeight: s.style?.fontWeight,
        fontSizePixels: s.style?.fontSize,
        color: s.style?.color,
        textAlign: s.style?.textAlign,
        strokeColor: s.style?.strokeColor,
        strokeWidth: s.style?.strokeWidth,
        isUppercase: undefined,
        imageIndex: s.imageIndex,
      }));

      await generateTranslatedImageForPayload(
        existingPayloadId,
        postId,
        segmentsForCompose,
        targetLanguage
      ).catch((e) => console.error(`[Worker] Compose failed for ${targetLanguage}:`, e));
    }

    return { status: "COMPLETED" };
  } catch (err) {
    console.error(`[Worker] Translation failed for ${opts.targetLanguage}:`, err);
    await prisma.translationPayload
      .update({
        where: { id: existingPayloadId },
        data: { status: "REJECTED" },
      })
      .catch(() => {});
    return { status: "REJECTED", error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// POST /api/translate/worker — QStash webhook handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // 1. Verify QStash signature
  const signature = request.headers.get("Upstash-Signature");
  const bodyText = await request.text();

  try {
    await verifyQstashSignature(signature, bodyText);
  } catch (err) {
    console.warn("[Worker] Signature verification failed:", err);
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: TranslationJobPayload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const { postId, sourceLanguage, targetLanguage, payloadId } = payload;
  if (!postId || !sourceLanguage || !targetLanguage || !payloadId) {
    return new NextResponse("Missing required fields", { status: 400 });
  }

  // 2. Idempotency — if payload already COMPLETED/APPROVED, ack immediately.
  //    We return 200 (not 409) so QStash marks the job done and doesn't retry.
  const current = await prisma.translationPayload.findUnique({
    where: { id: payloadId },
    select: { id: true, status: true, postId: true },
  });
  if (!current) {
    return NextResponse.json({ ok: true, skipped: "payload not found" });
  }
  if (current.status === "COMPLETED" || current.status === "APPROVED") {
    return NextResponse.json({ ok: true, skipped: "already completed" });
  }

  // 3. Run the translation pipeline. The pipeline itself mutates the payload
  //    row (status → COMPLETED/REJECTED) — see runTranslationForLanguage.
  try {
    const result = await runTranslationForLanguage({
      postId,
      sourceLanguage,
      targetLanguage,
      existingPayloadId: payloadId,
    });

    // 4. Settle the post atomically: recount remaining PROCESSING payloads and
    //    flip the post to PUBLISHED in a single transaction so a concurrent
    //    enqueue can't sneak a new PROCESSING row in between our count and
    //    our update.
    try {
      await prisma.$transaction(async (tx) => {
        const remaining = await tx.translationPayload.count({
          where: { postId, status: "PROCESSING" },
        });
        if (remaining === 0) {
          await tx.post.update({
            where: { id: postId },
            data: { status: "PUBLISHED" },
          });
        }
      });
    } catch (settleErr) {
      console.warn("[Worker] Post settle transaction failed:", settleErr);
    }

    // Ranking update is fire-and-forget but errors are logged (not silent).
    updateRankingScore(postId).catch((e) =>
      console.warn("[Worker] Ranking update failed:", e)
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Worker] Unhandled error:", err);
    // Return 5xx so QStash retries
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
