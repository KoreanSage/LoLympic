import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { LanguageCode } from "@prisma/client";
import crypto from "crypto";
import { updateRankingScore } from "@/lib/ranking";

// Vercel Hobby: max 60s, Pro: up to 300s
export const maxDuration = 60;

const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const genAI2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ---------------------------------------------------------------------------
// Language-specific translation instructions
// ---------------------------------------------------------------------------
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  ko: "Korean (한국어): Use short, punchy expressions. Meme culture in Korea favors 급식체 (school cafeteria slang), 신조어, and rhythmic wordplay. Keep sentences compact. Prefer colloquial register over formal.",
  ja: "Japanese (日本語): Subtle and restrained humor. Use appropriate levels of politeness for comedic effect. Japanese memes often rely on understatement, ツッコミ/ボケ dynamics, and visual puns. Preserve any double-meaning wordplay.",
  zh: "Chinese (中文): Compact and efficient. Chinese internet humor uses 网络用语, four-character idioms twisted for comedy, and phonetic puns. Keep character count low. Maximize impact per character.",
  en: "English: Sarcastic and exaggerated. English memes lean into irony, self-deprecation, and absurdist escalation. Use internet-native phrasing (all caps for emphasis, deliberate misspellings for tone). Match the energy.",
  es: "Spanish (Español): Expressive and colloquial. Spanish memes use regional slang, diminutives for comedic effect, and exaggerated emotion. Capture the warmth and dramatic flair. Consider Latin American vs. Iberian variations.",
};

// ---------------------------------------------------------------------------
// System prompt for Gemini translation
// ---------------------------------------------------------------------------
function buildTranslationSystemPrompt(
  sourceLanguage: string,
  targetLanguage: string
): string {
  const sourceLangInstruction =
    LANGUAGE_INSTRUCTIONS[sourceLanguage] || `Source language: ${sourceLanguage}`;
  const targetLangInstruction =
    LANGUAGE_INSTRUCTIONS[targetLanguage] || `Target language: ${targetLanguage}`;

  return `You are a world-class meme translator for LoLympic, a global meme translation platform.

Your mission: Create TRANSCENDENT translations — not literal word-for-word conversions, but culturally adapted versions that hit just as hard in the target language.

## Core Principles
1. **Preserve the FEELING**: humor, rhythm, tone, punchline timing, emotional impact
2. **Cultural adaptation > literal accuracy**: If a joke references a local celebrity, adapt it to an equivalent in the target culture
3. **Meme format awareness**: Impact font memes, reaction images, multi-panel comics each have different translation needs
4. **Register matching**: If the source is vulgar, the translation should be vulgar. If it's deadpan, stay deadpan.
5. **Visual-text harmony**: Translations must FIT the image — consider text length, placement, and visual flow

## Source Language Context
${sourceLangInstruction}

## Target Language Instructions
${targetLangInstruction}

## CRITICAL: Detect meme type and translate accordingly

**Type A — Overlay memes** (Impact font captions on top of a photo/reaction image):
- Translate ONLY the overlay caption text (usually 1-2 bold text regions at top/bottom)
- Do NOT translate small text, watermarks, or embedded UI

**Type B — Screenshot/conversation memes** (screenshots of posts, chats, forums, tweets):
- The ENTIRE text content IS the meme — translate ALL readable text
- Include: post content, comments, replies, usernames can stay original
- Translate each distinct text block (post body, comments, replies) as separate segments
- Keep UI labels (like buttons, timestamps, icons) untouched

**Type C — Multi-panel/comic memes**:
- Translate ALL dialogue and caption text in every panel
- Each speech bubble or text block = one segment

First determine the meme type, then translate ALL relevant text for that type.

## Your Task
1. Determine meme type (A, B, or C)
2. Identify ALL text regions that need translation for that type
3. For each region, provide bounding box as fractions 0.0-1.0 relative to image dimensions
   - IMPORTANT: Make bounding boxes GENEROUS — add ~5% padding on each side so the box fully covers all text including ascenders/descenders
   - It's better to have a slightly larger box than to clip any text
4. Translate with cultural adaptation
5. Match the original styling (size, weight, color, position)

## IMPORTANT: Language for cultureNote
Write ALL cultureNote fields (summary, explanation, translationNote) in the TARGET language (${targetLanguage}).
Do NOT write them in English unless the target language IS English.

## Response Format (JSON only, no markdown fences)
{
  "memeType": "A|B|C",
  "segments": [
    {
      "sourceText": "original text from image",
      "translatedText": "transcendent translation",
      "semanticRole": "HEADLINE|CAPTION|DIALOGUE|LABEL|WATERMARK|SUBTITLE|OVERLAY|OTHER",
      "box": { "x": 0.0, "y": 0.0, "width": 0.5, "height": 0.1 },
      "style": {
        "fontFamily": "suggested font name",
        "fontSize": 24,
        "fontWeight": 700,
        "color": "#FFFFFF",
        "textAlign": "CENTER",
        "strokeColor": "#000000",
        "strokeWidth": 2,
        "shadowColor": "rgba(0,0,0,0.5)"
      }
    }
  ],
  "cultureNote": {
    "summary": "One-line cultural context (in target language)",
    "explanation": "Detailed explanation of cultural references, humor mechanics, and why certain choices were made (in target language)",
    "translationNote": "Specific notes about translation decisions — what was adapted and why (in target language)"
  },
  "confidence": 0.85
}`;
}

// ---------------------------------------------------------------------------
// Types for the AI response
// ---------------------------------------------------------------------------
interface TranslationSegmentResponse {
  sourceText: string;
  translatedText: string;
  semanticRole: string;
  box: { x: number; y: number; width: number; height: number };
  style: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    textAlign?: string;
    strokeColor?: string;
    strokeWidth?: number;
    shadowColor?: string;
  };
}

interface CultureNoteResponse {
  summary: string;
  explanation: string;
  translationNote?: string;
}

interface AITranslationResult {
  segments: TranslationSegmentResponse[];
  cultureNote: CultureNoteResponse;
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toSemanticRole(
  role: string
): "HEADLINE" | "CAPTION" | "DIALOGUE" | "LABEL" | "WATERMARK" | "SUBTITLE" | "OVERLAY" | "OTHER" {
  const valid = [
    "HEADLINE", "CAPTION", "DIALOGUE", "LABEL",
    "WATERMARK", "SUBTITLE", "OVERLAY", "OTHER",
  ] as const;
  const upper = role.toUpperCase();
  return (valid as readonly string[]).includes(upper)
    ? (upper as (typeof valid)[number])
    : "OTHER";
}

function toTextAlign(align?: string): "LEFT" | "CENTER" | "RIGHT" {
  if (!align) return "CENTER";
  const upper = align.toUpperCase();
  if (upper === "LEFT" || upper === "CENTER" || upper === "RIGHT") return upper;
  return "CENTER";
}

function isValidLanguageCode(code: string): code is LanguageCode {
  return ["ko", "en", "ja", "zh", "es"].includes(code);
}

function extractMimeType(filePathOrUrl: string): string {
  const ext = filePathOrUrl.split(".").pop()?.toLowerCase().split("?")[0] || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] || "image/jpeg";
}

// Helper: Save generated image (Blob or local)
async function saveGeneratedImage(
  buffer: Buffer,
  prefix: string,
  ext: string
): Promise<string> {
  const filename = `${prefix}_${crypto.randomUUID()}${ext}`;

  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const mimeMap: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg" };
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      contentType: mimeMap[ext] || "image/jpeg",
    });
    return blob.url;
  } else {
    const path = await import("path");
    const fs = await import("fs/promises");
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    const filePath = path.join(path.resolve(uploadDir), filename);
    await fs.writeFile(filePath, buffer);
    return `/api/uploads/${filename}`;
  }
}

// Helper: Read image as base64 (from URL or local file)
async function readImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  // If it's a full URL (Blob or external), fetch it
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") || extractMimeType(imageUrl);
    return { base64: buffer.toString("base64"), mimeType };
  }

  // Local file path (/api/uploads/filename)
  const path = await import("path");
  const fs = await import("fs/promises");
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  const relativePath = imageUrl.replace(/^\/(api\/)?uploads\//, "");

  // Security: prevent path traversal
  if (relativePath.includes("..") || relativePath.includes("/") || relativePath.includes("\\")) {
    throw new Error("Invalid image path");
  }

  const absoluteUploadDir = path.resolve(uploadDir);
  const imagePath = path.resolve(uploadDir, relativePath);
  if (!imagePath.startsWith(absoluteUploadDir)) {
    throw new Error("Invalid image path");
  }

  const imageBuffer = await fs.readFile(imagePath);
  return {
    base64: imageBuffer.toString("base64"),
    mimeType: extractMimeType(imagePath),
  };
}

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

// ---------------------------------------------------------------------------
// Retry helper — retries a function up to `retries` times with delay
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.warn(`Attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Fire-and-forget: runs a promise in background, logs errors silently
// ---------------------------------------------------------------------------
function fireAndForget(promise: Promise<unknown>) {
  promise.catch((err) => console.error("Background task failed:", err));
}

// ---------------------------------------------------------------------------
// Generate clean image (text removed) using Gemini image editing
// ---------------------------------------------------------------------------
async function generateCleanImage(
  imageBase64: string,
  mimeType: string
): Promise<string | null> {
  try {
    const response = await genAI2.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Remove ALL readable text content from this image using context-aware inpainting.

What to remove:
- All text that conveys meaning (captions, post content, comments, dialogue, labels)
- Both overlay text (bold meme captions) AND embedded text (forum posts, chat messages, tweets)

What to KEEP (do NOT remove):
- Profile pictures, avatars, icons
- UI chrome (buttons, borders, layout frames)
- Timestamps, numerical stats (likes, shares counts)
- Usernames and handles
- Background images and photos

Replace each removed text area with the background that would naturally be behind it. Keep the overall layout structure intact. Output only the modified image.`,
            },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Extract image from response
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        const cleanImageBuffer = Buffer.from(part.inlineData.data, "base64");
        const ext = part.inlineData.mimeType?.includes("png") ? ".png" : ".jpg";
        return await saveGeneratedImage(cleanImageBuffer, "clean", ext);
      }
    }

    return null;
  } catch (err) {
    console.error("Clean image generation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generate translated image — replace original text with translated text
// ---------------------------------------------------------------------------
async function generateTranslatedImage(
  imageBase64: string,
  mimeType: string,
  segments: Array<{ sourceText: string; translatedText: string }>,
  targetLanguage: string
): Promise<string | null> {
  if (segments.length === 0) return null;

  try {
    const replacements = segments
      .map((s, i) => `${i + 1}. "${s.sourceText}" → "${s.translatedText}"`)
      .join("\n");

    const response = await genAI2.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Replace ALL the specified text in this image with the translated versions below. Keep the image layout, colors, fonts, and style exactly the same.

Text replacements:
${replacements}

Rules:
- Replace each original text with its translation IN THE SAME POSITION
- Match the original font style, size, weight, and color as closely as possible
- If translated text is longer, scale the font size down slightly to fit the same area
- The result should look like the image was originally created in ${targetLanguage}
- Keep all non-text elements (images, icons, profile pictures, UI chrome, timestamps) untouched
- Preserve the overall visual layout — do not rearrange anything

Output only the modified image.`,
            },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response?.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        const imgBuffer = Buffer.from(part.inlineData.data, "base64");
        const ext = part.inlineData.mimeType?.includes("png") ? ".png" : ".jpg";
        return await saveGeneratedImage(imgBuffer, `translated_${targetLanguage}`, ext);
      }
    }

    return null;
  } catch (err) {
    console.error(`Translated image generation failed for ${targetLanguage}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// POST /api/translate
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Rate limit: expensive AI calls
    const rlKey = getRateLimitKey(request.headers, "translate");
    const rl = checkRateLimit(rlKey, RATE_LIMITS.translate);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      postId,
      sourceLanguage,
      targetLanguages,
      imageUrl,
    }: {
      postId: string;
      sourceLanguage: string;
      targetLanguages: string[];
      imageUrl: string;
    } = body;

    // Validation
    if (!postId || !sourceLanguage || !targetLanguages?.length || !imageUrl) {
      return NextResponse.json(
        { error: "Missing required fields: postId, sourceLanguage, targetLanguages, imageUrl" },
        { status: 400 }
      );
    }

    if (!isValidLanguageCode(sourceLanguage)) {
      return NextResponse.json(
        { error: `Invalid source language: ${sourceLanguage}` },
        { status: 400 }
      );
    }

    for (const lang of targetLanguages) {
      if (!isValidLanguageCode(lang)) {
        return NextResponse.json(
          { error: `Invalid target language: ${lang}` },
          { status: 400 }
        );
      }
    }

    // Verify post exists
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Read image as base64 (supports both Blob URLs and local files)
    let imageBase64: string;
    let mimeType: string;
    try {
      const imageData = await readImageAsBase64(imageUrl);
      imageBase64 = imageData.base64;
      mimeType = imageData.mimeType;
    } catch (err) {
      console.error("Failed to read image:", err);
      return NextResponse.json(
        { error: "Could not read uploaded image file" },
        { status: 400 }
      );
    }

    // Process each target language
    const results: Record<string, unknown> = {};

    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLanguage) continue;

      const systemPrompt = buildTranslationSystemPrompt(sourceLanguage, targetLang);

      try {
        // Call Gemini with vision — WITH RETRY (up to 2 retries)
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: systemPrompt,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        });

        // Retry the full translate + parse cycle (up to 3 attempts)
        let parsed: AITranslationResult | null = null;
        let lastParseError = "";

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise((r) => setTimeout(r, 2000 * attempt));
              console.log(`Retry attempt ${attempt + 1} for ${targetLang}`);
            }

            const result = await model.generateContent([
              `Translate this meme from ${sourceLanguage} to ${targetLang}. Analyze the image, detect all text regions, and provide transcendent translations. Respond ONLY with valid JSON, no markdown fences.`,
              {
                inlineData: {
                  data: imageBase64,
                  mimeType,
                },
              },
            ]);
            const text = result.response.text();
            if (!text) {
              lastParseError = "Empty response from AI";
              continue;
            }

            const cleaned = stripMarkdownFences(text);
            parsed = JSON.parse(cleaned) as AITranslationResult;

            // Validate parsed result has segments
            if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
              lastParseError = "No segments in response";
              parsed = null;
              continue;
            }

            break; // Success
          } catch (err) {
            lastParseError = err instanceof Error ? err.message : String(err);
            console.warn(`Translate attempt ${attempt + 1} failed for ${targetLang}:`, lastParseError);
            parsed = null;
          }
        }

        if (!parsed) {
          console.error(`All translation attempts failed for ${targetLang}: ${lastParseError}`);
          results[targetLang] = { error: `Translation failed: ${lastParseError}` };
          continue;
        }

        // Store TranslationPayload + segments in a transaction
        const payload = await prisma.$transaction(async (tx) => {
          const latestPayload = await tx.translationPayload.findFirst({
            where: {
              postId,
              targetLanguage: targetLang as LanguageCode,
            },
            orderBy: { version: "desc" },
          });
          const nextVersion = (latestPayload?.version ?? 0) + 1;

          const translationPayload = await tx.translationPayload.create({
            data: {
              postId,
              sourceLanguage: sourceLanguage as LanguageCode,
              targetLanguage: targetLang as LanguageCode,
              version: nextVersion,
              status: "COMPLETED",
              confidence: parsed.confidence ?? null,
              creatorType: "AI",
              creatorId: null,
              segments: {
                create: parsed.segments.map((seg, index) => ({
                  orderIndex: index,
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
            include: { segments: true },
          });

          // Create CultureNote per target language
          if (parsed.cultureNote) {
            const existingNote = await tx.cultureNote.findFirst({
              where: { postId, language: targetLang as LanguageCode },
            });

            // Skip if culture note already exists for this language
            if (!existingNote) {
              const latestNote = await tx.cultureNote.findFirst({
                where: { postId },
                orderBy: { version: "desc" },
              });
              const noteVersion = (latestNote?.version ?? 0) + 1;

              await tx.cultureNote.create({
                data: {
                  postId,
                  language: targetLang as LanguageCode,
                  summary: parsed.cultureNote.summary || "",
                  explanation: parsed.cultureNote.explanation || "",
                  translationNote: parsed.cultureNote.translationNote ?? null,
                  creatorType: "AI",
                  status: "PUBLISHED",
                  confidence: parsed.confidence ?? null,
                  version: noteVersion,
                },
              });
            }
          }

          // Update post translation count
          await tx.post.update({
            where: { id: postId },
            data: { translationCount: { increment: 1 } },
          });

          return translationPayload;
        });

        // NOTE: Translated image generation is skipped here to avoid timeout.
        // It can be triggered separately via /api/translate/generate-image.

        results[targetLang] = {
          payloadId: payload.id,
          version: payload.version,
          segmentCount: payload.segments.length,
          confidence: payload.confidence,
        };
      } catch (langError) {
        console.error(`Translation error for ${targetLang}:`, langError);
        results[targetLang] = { error: `Translation failed for ${targetLang}` };
      }
    }

    // NOTE: Clean image generation is skipped here to avoid timeout.
    // It can be triggered separately via /api/translate/generate-image.

    // Update ranking score after translations complete
    updateRankingScore(postId).catch(() => {});

    return NextResponse.json({
      postId,
      sourceLanguage,
      translations: results,
    });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Internal server error during translation" },
      { status: 500 }
    );
  }
}
