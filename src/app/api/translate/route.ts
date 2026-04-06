import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
// TODO: Both @google/generative-ai and @google/genai are used here.
// Do NOT remove either — the translate route relies on both SDKs
// (@google/generative-ai for text generation, @google/genai for image analysis).
// Consolidate to a single SDK when API parity is achieved.
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { LanguageCode } from "@prisma/client";
import crypto from "crypto";
import { updateRankingScore } from "@/lib/ranking";
import { runLamaInpainting } from "@/lib/replicate";
import { generateInpaintingMask } from "@/lib/mask-generator";
import sharp from "sharp";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const TRANSLATE_LANGUAGES = ["ko", "en", "ja", "zh", "es", "hi", "ar"] as const;

const translateSchema = z.object({
  postId: z.string().min(1, "postId is required"),
  sourceLanguage: z.enum(TRANSLATE_LANGUAGES, {
    errorMap: () => ({ message: `sourceLanguage must be one of: ${TRANSLATE_LANGUAGES.join(", ")}` }),
  }),
  targetLanguages: z
    .array(
      z.enum(TRANSLATE_LANGUAGES, {
        errorMap: () => ({ message: `Each target language must be one of: ${TRANSLATE_LANGUAGES.join(", ")}` }),
      })
    )
    .min(1, "At least one target language is required")
    .max(7),
  imageUrl: z.string().url().optional(),
});

// Vercel Hobby: max 60s, Pro: up to 300s
export const maxDuration = 60;

const USE_R2 = !!(
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_ENDPOINT &&
  process.env.R2_BUCKET_NAME
);
const USE_BLOB = !USE_R2 && !!process.env.BLOB_READ_WRITE_TOKEN;

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

let genAI2: GoogleGenAI | null = null;
function getGenAI2() {
  if (!genAI2) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    genAI2 = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAI2;
}

// ---------------------------------------------------------------------------
// Language-specific translation instructions
// ---------------------------------------------------------------------------
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  ko: "Korean (한국어): Use short, punchy expressions. Meme culture in Korea favors 급식체 (school cafeteria slang), 신조어, and rhythmic wordplay. Keep sentences compact. Prefer colloquial register over formal.",
  ja: "Japanese (日本語): Subtle and restrained humor. Use appropriate levels of politeness for comedic effect. Japanese memes often rely on understatement, ツッコミ/ボケ dynamics, and visual puns. Preserve any double-meaning wordplay.",
  zh: "Chinese (中文): Compact and efficient. Chinese internet humor uses 网络用语, four-character idioms twisted for comedy, and phonetic puns. Keep character count low. Maximize impact per character.",
  en: "English: Sarcastic and exaggerated. English memes lean into irony, self-deprecation, and absurdist escalation. Use internet-native phrasing (all caps for emphasis, deliberate misspellings for tone). Match the energy.",
  es: "Spanish (Español): Expressive and colloquial. Spanish memes use regional slang, diminutives for comedic effect, and exaggerated emotion. Capture the warmth and dramatic flair. Consider Latin American vs. Iberian variations.",
  hi: "Hindi (हिन्दी): Bollywood-influenced humor with dramatic flair. Hindi memes use Hinglish (Hindi-English mix), filmi dialogues, and cultural references. Use colloquial Delhi/Mumbai street Hindi for authenticity. Embrace the dramatic and emotional style.",
  ar: "Arabic (العربية): Rich and expressive. Arabic memes blend Modern Standard Arabic with dialect (Egyptian/Gulf). Use internet-native Arabic expressions, cultural references, and wordplay. Keep it casual and relatable. Use Egyptian dialect when unsure.",
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

  return `You are a world-class meme translator for mimzy, a global meme translation platform.

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

## CRITICAL: Do NOT hallucinate text
If the image contains NO readable text at all (just illustrations, photos, or icons without words), return an EMPTY segments array: "segments": []. NEVER invent, add, or imagine text that is not visually present in the image.

## Your Task
1. First, check if the image actually contains readable text. If not, return empty segments.
2. Determine meme type (A, B, or C)
3. Identify ALL text regions that need translation for that type
4. For each region, provide bounding box as fractions 0.0-1.0 relative to image dimensions
   - IMPORTANT: Make bounding boxes GENEROUS — add ~5% padding on each side so the box fully covers all text including ascenders/descenders
   - It's better to have a slightly larger box than to clip any text
5. Translate with cultural adaptation
6. Match the original styling (size, weight, color, position)

## IMPORTANT: Language for cultureNote
Write cultureNote in the TARGET language (${targetLanguage}). Keep it SHORT.

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
    "summary": "1-2 sentence: what makes this meme funny and any cultural references (in target language)",
    "explanation": "1-2 sentence: key translation choices or adaptations made (in target language)"
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
  memeType?: string;
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
  return ["ko", "en", "ja", "zh", "es", "hi", "ar"].includes(code);
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

// Helper: Save generated image (R2 > Blob > local)
async function saveGeneratedImage(
  buffer: Buffer,
  prefix: string,
  ext: string
): Promise<string> {
  const filename = `uploads/${prefix}_${crypto.randomUUID()}${ext}`;
  const mimeMap: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
  const contentType = mimeMap[ext] || "image/jpeg";

  if (USE_R2) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await s3.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: filename,
      Body: buffer,
      ContentType: contentType,
    }));
    const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
    return `${publicUrl}/${filename}`;
  } else if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
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
// Content moderation: check Gemini safety ratings (fire-and-forget)
// ---------------------------------------------------------------------------
async function checkContentSafety(postId: string, response: any) {
  try {
    const safetyRatings = response?.candidates?.[0]?.safetyRatings;
    if (!safetyRatings) return;

    const hasHigh = safetyRatings.some((r: any) => r.probability === "HIGH");
    const hasMedium = safetyRatings.some((r: any) => r.probability === "MEDIUM");

    if (hasHigh) {
      await prisma.post.update({
        where: { id: postId },
        data: { moderationFlag: "BLOCKED", status: "UNDER_REVIEW" },
      });
    } else if (hasMedium) {
      await prisma.post.update({
        where: { id: postId },
        data: { moderationFlag: "REVIEW" },
      });
    } else {
      await prisma.post.update({
        where: { id: postId },
        data: { moderationFlag: "SAFE" },
      });
    }
  } catch (e) {
    console.error("Content safety check failed:", e);
  }
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
// ---------------------------------------------------------------------------
// Generate clean images for all post images
// Uses LaMa inpainting (primary) with Gemini fallback
// ---------------------------------------------------------------------------
async function generateCleanImagesForPost(
  postId: string,
  imageDataList: Array<{ base64: string; mimeType: string }>,
  imageUrls: string[]
) {
  // Get post images from DB
  const postImages = await prisma.postImage.findMany({
    where: { postId },
    orderBy: { orderIndex: "asc" },
    select: { id: true, cleanUrl: true, orderIndex: true },
  });

  for (let i = 0; i < postImages.length && i < imageDataList.length; i++) {
    const dbImage = postImages[i];
    const imgData = imageDataList[i];
    if (dbImage.cleanUrl || !imgData.base64) {
      console.debug(`[CleanImage] Skipping postImage ${dbImage.id} — already cached or no data`);
      continue; // Skip if already has clean image cached or no data
    }

    try {
      let cleanUrl: string | null = null;

      // Primary: Try LaMa inpainting (mask-based, higher quality)
      try {
        const imageBuffer = Buffer.from(imgData.base64, "base64");

        // Get segments from DB to build the mask
        const segments = await prisma.translationSegment.findMany({
          where: {
            translationPayload: { postId },
            imageIndex: dbImage.orderIndex,
          },
          select: {
            boxX: true,
            boxY: true,
            boxWidth: true,
            boxHeight: true,
            semanticRole: true,
          },
        });

        if (segments.length > 0) {
          const metadata = await sharp(imageBuffer).metadata();
          const imgWidth = metadata.width;
          const imgHeight = metadata.height;

          if (imgWidth && imgHeight) {
            const maskBuffer = await generateInpaintingMask(segments, imgWidth, imgHeight);
            const lamaOutputUrl = await runLamaInpainting(imageBuffer, maskBuffer, imgData.mimeType);

            // Download the clean image from LaMa output URL
            const cleanRes = await fetch(lamaOutputUrl);
            if (cleanRes.ok) {
              const cleanRaw = Buffer.from(await cleanRes.arrayBuffer());
              // Compress to WebP for ~97% storage savings
              const sharp = (await import("sharp")).default;
              const cleanBuffer = await sharp(cleanRaw).webp({ quality: 85 }).toBuffer();
              // Verify the WebP is valid
              const meta = await sharp(cleanBuffer).metadata();
              if (!meta.width || !meta.height) throw new Error("WebP validation failed");
              cleanUrl = await saveGeneratedImage(cleanBuffer, "clean_lama", ".webp");
              console.debug(`[LaMa] Clean image generated for postImage ${dbImage.id}`);
            }
          }
        }
      } catch (lamaErr) {
        console.warn(`[LaMa] Failed for postImage ${dbImage.id}, falling back to Gemini:`, lamaErr);
      }

      // Fallback: Gemini inpainting
      if (!cleanUrl) {
        cleanUrl = await generateCleanImage(imgData.base64, imgData.mimeType);
        if (cleanUrl) {
          console.debug(`[Gemini fallback] Clean image generated for postImage ${dbImage.id}`);
        }
      }

      if (cleanUrl) {
        await prisma.postImage.update({
          where: { id: dbImage.id },
          data: { cleanUrl },
        });
      }
    } catch (err) {
      console.error(`Clean image generation failed for postImage ${dbImage.id}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Generate clean image (text removed) using Gemini image editing
// ---------------------------------------------------------------------------
async function generateCleanImage(
  imageBase64: string,
  mimeType: string
): Promise<string | null> {
  try {
    const response = await getGenAI2().models.generateContent({
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
        const cleanImageRaw = Buffer.from(part.inlineData.data, "base64");
        // Compress to WebP for storage savings
        const sharp = (await import("sharp")).default;
        const cleanImageBuffer = await sharp(cleanImageRaw).webp({ quality: 85 }).toBuffer();
        const meta = await sharp(cleanImageBuffer).metadata();
        if (!meta.width || !meta.height) throw new Error("WebP validation failed");
        return await saveGeneratedImage(cleanImageBuffer, "clean", ".webp");
      }
    }

    return null;
  } catch (err) {
    console.error("Clean image generation failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google Font fetcher for Satori (returns font ArrayBuffer)
// ---------------------------------------------------------------------------
async function fetchGoogleFont(fontFamily: string, text: string, weight: number = 900): Promise<ArrayBuffer> {
  const uniqueChars = Array.from(new Set(text.split(""))).join("");
  // Try requested weight first, fall back to 700 then 400
  const weights = [weight, 700, 400].filter((v, i, a) => a.indexOf(v) === i);

  for (const w of weights) {
    try {
      const cssUrl = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${w}&text=${encodeURIComponent(uniqueChars)}`;
      const cssRes = await fetch(cssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
        },
      });
      if (!cssRes.ok) continue;
      const css = await cssRes.text();
      const match = css.match(/src: url\((.+)\) format\('(woff|woff2|truetype)'\)/);
      if (!match || !match[1]) continue;
      const fontRes = await fetch(match[1]);
      if (!fontRes.ok) continue;
      return fontRes.arrayBuffer();
    } catch {
      continue;
    }
  }
  throw new Error(`Failed to fetch Google Font ${fontFamily} at any weight`);
}

// ---------------------------------------------------------------------------
// Map language code to Noto Sans font family for Google Fonts
// ---------------------------------------------------------------------------
function getFontFamilyForLang(lang: string): string {
  switch (lang) {
    case "ko": return "Noto+Sans+KR";
    case "ja": return "Noto+Sans+JP";
    case "zh": return "Noto+Sans+SC";
    case "ar": return "Noto+Sans+Arabic";
    case "hi": return "Noto+Sans+Devanagari";
    default: return "Noto+Sans";
  }
}

// ---------------------------------------------------------------------------
// Generate translated image — replace original text with translated text
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Generate translated image for a payload using inline Satori rendering
// Pipeline: LaMa clean image + Satori text overlay → final translated image
// Strategy: Get the clean image (text removed) → POST to /api/translate/compose-image
// Fallback: Gemini image editing if compose fails
// ---------------------------------------------------------------------------
async function generateTranslatedImageForPayload(
  payloadId: string,
  postId: string,
  segments: Array<{
    sourceText: string;
    translatedText: string;
    semanticRole: string;
    boxX: number;
    boxY: number;
    boxWidth: number;
    boxHeight: number;
    fontFamily?: string;
    fontWeight?: number;
    fontSizePixels?: number;
    color?: string;
    textAlign?: string;
    strokeColor?: string;
    strokeWidth?: number;
    isUppercase?: boolean;
    backgroundColor?: string;
  }>,
  targetLanguage: string
): Promise<void> {
  try {
    // 1. Find the image for this post (need dimensions + clean URL)
    const postImage = await prisma.postImage.findFirst({
      where: { postId },
      orderBy: { orderIndex: "asc" },
      select: { cleanUrl: true, originalUrl: true, mimeType: true },
    });

    if (!postImage) {
      console.warn(`No image found for post ${postId}, skipping translated image`);
      return;
    }

    // Wait for clean image generation to complete (it runs in parallel)
    let cleanUrl = postImage.cleanUrl;
    if (!cleanUrl) {
      // Wait up to 30s for clean image to be generated
      for (let retry = 0; retry < 6; retry++) {
        await new Promise((r) => setTimeout(r, 5000));
        const refreshed = await prisma.postImage.findFirst({
          where: { postId },
          orderBy: { orderIndex: "asc" },
          select: { cleanUrl: true },
        });
        if (refreshed?.cleanUrl) {
          cleanUrl = refreshed.cleanUrl;
          break;
        }
      }
    }

    // 2. Use LaMa clean image (text removed) as background
    const satoriCleanUrl = cleanUrl;
    if (!satoriCleanUrl) {
      console.warn(`[Satori] No clean image for post ${postId}, skipping translated image generation`);
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || (process.env.NEXTAUTH_URL)
      || "http://localhost:3000";

    const resolvedCleanUrl = satoriCleanUrl.startsWith("http")
      ? satoriCleanUrl
      : `${appUrl}${satoriCleanUrl}`;

    // 3. Get image dimensions via Sharp
    const cleanRes = await fetch(resolvedCleanUrl);
    if (!cleanRes.ok) throw new Error(`Failed to fetch clean image: ${cleanRes.status}`);
    const cleanBuffer = Buffer.from(await cleanRes.arrayBuffer());
    const metadata = await sharp(cleanBuffer).metadata();
    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 800;

    // 4a. For Arabic: use Sharp-based image-composer (Satori can't handle Arabic ligatures)
    if (targetLanguage === "ar") {
      const { composeTranslatedImage } = await import("@/lib/image-composer");
      const composerSegments = segments
        .filter(s => s.semanticRole !== "WATERMARK" && s.translatedText?.trim())
        .map(s => ({
          translatedText: s.translatedText,
          boxX: s.boxX,
          boxY: s.boxY,
          boxWidth: s.boxWidth,
          boxHeight: s.boxHeight,
          fontFamily: s.fontFamily,
          fontWeight: s.fontWeight,
          fontSizePixels: s.fontSizePixels,
          color: s.color,
          textAlign: s.textAlign,
          strokeColor: s.strokeColor,
          strokeWidth: s.strokeWidth,
          isUppercase: s.isUppercase,
          semanticRole: s.semanticRole,
        }));
      if (composerSegments.length === 0) return;

      const composedRaw = await composeTranslatedImage(Buffer.from(cleanBuffer), composerSegments, { watermark: false });
      const sharpMod = (await import("sharp")).default;
      const composedBuffer = await sharpMod(composedRaw).webp({ quality: 85 }).toBuffer();
      const url = await saveGeneratedImage(composedBuffer, `translated_sharp_${targetLanguage}`, ".webp");
      await prisma.translationPayload.update({ where: { id: payloadId }, data: { translatedImageUrl: url } });
      console.debug(`[Sharp] Arabic translated image saved for payload ${payloadId}: ${url}`);
      return;
    }

    // 4b. Inline Satori rendering (for all other languages)
    const visibleSegments = segments.filter(
      (s) => s.semanticRole !== "WATERMARK" && s.translatedText?.trim()
    );

    if (visibleSegments.length === 0) return;

    const fullText = visibleSegments.map((s) => s.translatedText).join("");
    const fontFamily = getFontFamilyForLang(targetLanguage);
    const fontBuffer = await fetchGoogleFont(fontFamily, fullText);

    // Determine coordinate normalization
    const maxCoord = Math.max(
      ...visibleSegments.map((s) =>
        Math.max(s.boxX + s.boxWidth, s.boxY + s.boxHeight)
      )
    );
    const norm = maxCoord > 1.5 ? (maxCoord > 100 ? 1000 : maxCoord) : 1;

    const safeW = Math.min(imgWidth, 2048);
    const safeH = Math.min(imgHeight, 2048);

    // Convert clean image to PNG data URI for Satori embedding
    // (Satori only supports PNG/JPEG, so decode WebP → PNG if needed)
    const satoriBuffer = metadata.format === "webp"
      ? Buffer.from(await sharp(cleanBuffer).png().toBuffer())
      : cleanBuffer;
    const cleanBase64 = satoriBuffer.toString("base64");
    const cleanMime = metadata.format === "jpeg" ? "image/jpeg" : "image/png";
    const cleanDataUri = `data:${cleanMime};base64,${cleanBase64}`;

    // Build React-like element tree for Satori
    const element = {
      type: "div",
      props: {
        style: {
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative" as const,
        },
        children: [
          {
            type: "img",
            props: {
              src: cleanDataUri,
              style: {
                position: "absolute" as const,
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover" as const,
              },
            },
          },
          ...visibleSegments.map((seg) => {
            const x = seg.boxX / norm;
            const y = seg.boxY / norm;
            const w = seg.boxWidth / norm;
            const h = seg.boxHeight / norm;

            // Smart font size: use original fontSizePixels if available,
            // otherwise calculate from box height
            const boxHeightPx = h * safeH;
            let fontSize: number;
            if (seg.fontSizePixels && seg.fontSizePixels > 8) {
              // Scale original font size proportionally
              fontSize = Math.max(12, Math.min(seg.fontSizePixels * 1.1, boxHeightPx * 0.85));
            } else {
              // Auto-calculate: fill ~70% of box height, adjust for text length
              const baseSize = boxHeightPx * 0.7;
              const boxWidthPx = w * safeW;
              const charsPerLine = Math.max(1, Math.floor(boxWidthPx / (baseSize * 0.55)));
              const textLen = seg.translatedText?.length || 1;
              const lines = Math.ceil(textLen / charsPerLine);
              fontSize = lines > 1
                ? Math.max(12, boxHeightPx / (lines * 1.3))
                : Math.max(12, Math.min(baseSize, 72));
            }

            // Use original text color if available, default to white with stroke
            const textColor = seg.color || "#FFFFFF";
            const isLight = textColor.toLowerCase() === "#ffffff" || textColor.toLowerCase() === "#fff" || textColor === "white";
            const strokeShadow = isLight
              ? "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, " +
                "-1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000"
              : "-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff";

            // Background color: skip gray/semi-transparent backgrounds that degrade quality
            // Only keep truly intentional backgrounds (solid white/black for screenshot memes)
            const rawBg = (seg.backgroundColor || "transparent").toLowerCase();
            const isGrayish = /^(#[89a-f][0-9a-f]{5}|#[89a-f]{3}|rgba?\(.*(128|150|170|180|190|200).*\)|gray|grey)/i.test(rawBg);
            const bgColor = (rawBg === "transparent" || isGrayish) ? "transparent" : rawBg;

            return {
              type: "div",
              props: {
                style: {
                  position: "absolute" as const,
                  left: `${x * 100}%`,
                  top: `${y * 100}%`,
                  width: `${w * 100}%`,
                  height: `${h * 100}%`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: seg.textAlign === "LEFT" ? "flex-start" : seg.textAlign === "RIGHT" ? "flex-end" : "center",
                  textAlign: "center" as const,
                  fontFamily: "Noto Sans",
                  fontSize: `${fontSize}px`,
                  fontWeight: 900,
                  color: textColor,
                  backgroundColor: bgColor,
                  textShadow: strokeShadow,
                  lineHeight: 1.2,
                  padding: bgColor !== "transparent" ? "2px 6px" : "0",
                  wordBreak: "keep-all" as const,
                  overflowWrap: "break-word" as const,
                },
                children: seg.translatedText,
              },
            };
          }),
        ],
      },
    };

    const svg = await satori(element as React.ReactNode, {
      width: safeW,
      height: safeH,
      fonts: [
        {
          name: "Noto Sans",
          data: Buffer.from(fontBuffer),
          style: "normal" as const,
          weight: 900,
        },
      ],
    });

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width" as const, value: safeW },
    });
    const composedRaw = Buffer.from(resvg.render().asPng());

    // 5. Compress to WebP + save to storage
    const sharpMod = (await import("sharp")).default;
    const composedBuffer = await sharpMod(composedRaw).webp({ quality: 85 }).toBuffer();
    const composedMeta = await sharpMod(composedBuffer).metadata();
    if (!composedMeta.width || !composedMeta.height) throw new Error("Translated WebP validation failed");
    const url = await saveGeneratedImage(composedBuffer, `translated_satori_${targetLanguage}`, ".webp");

    // 6. Update DB
    await prisma.translationPayload.update({
      where: { id: payloadId },
      data: { translatedImageUrl: url },
    });
    console.debug(`Translated image (Satori) saved for payload ${payloadId}: ${url}`);
  } catch (err) {
    console.error(`[Satori] Compose failed for payload ${payloadId}:`, err);
    // No fallback — Satori + LaMa is the only pipeline.
    // Frontend will use MemeRenderer canvas as client-side fallback.
  }
}

// ---------------------------------------------------------------------------
// Redis caching for translation results
// Cache key: meme_translation:{postId}:{lang}, TTL: 7 days
// ---------------------------------------------------------------------------
const TRANSLATION_CACHE_TTL = 604800; // 7 days in seconds

async function getCachedTranslation(
  postId: string,
  targetLang: string
): Promise<AITranslationResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const cacheKey = `meme_translation:${postId}:${targetLang}`;
    const res = await fetch(
      `${url}/get/${encodeURIComponent(cacheKey)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (data.result) {
      console.debug(`[Cache HIT] Translation for ${postId}:${targetLang}`);
      return JSON.parse(data.result) as AITranslationResult;
    }
    return null;
  } catch (err) {
    console.warn("[Cache] Redis read failed, proceeding without cache:", err);
    return null;
  }
}

async function setCachedTranslation(
  postId: string,
  targetLang: string,
  result: AITranslationResult
): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  try {
    const cacheKey = `meme_translation:${postId}:${targetLang}`;
    await fetch(
      `${url}/set/${encodeURIComponent(cacheKey)}/${encodeURIComponent(JSON.stringify(result))}/ex/${TRANSLATION_CACHE_TTL}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.debug(`[Cache SET] Translation for ${postId}:${targetLang}`);
  } catch (err) {
    console.warn("[Cache] Redis write failed:", err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/translate
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    // Rate limit: expensive AI calls
    const rlKey = getRateLimitKey(request.headers, "translate");
    const rl = await checkRateLimit(rlKey, RATE_LIMITS.translate);
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

    const rawBody = await request.json();
    const parsed = translateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { postId, sourceLanguage, targetLanguages, imageUrl } = parsed.data;

    // Verify post exists and get all images
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
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Build list of images to translate
    const imageUrls = post.images.length > 0
      ? post.images.map((img) => img.originalUrl)
      : imageUrl
        ? [imageUrl]
        : [];

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: "No images found for this post" },
        { status: 400 }
      );
    }

    // Read all images as base64
    const imageDataList: Array<{ base64: string; mimeType: string }> = [];
    for (const url of imageUrls) {
      try {
        const imageData = await readImageAsBase64(url);
        imageDataList.push(imageData);
      } catch (err) {
        console.error(`Failed to read image ${url}:`, err);
        imageDataList.push({ base64: "", mimeType: "image/jpeg" }); // placeholder for failed reads
      }
    }

    // Process each target language
    const results: Record<string, { payloadId?: string; version?: number; segmentCount?: number; confidence?: number | null; error?: string }> = {};
    const allSegmentsByLang: Record<string, Array<{
      sourceText: string;
      translatedText: string;
      semanticRole: string;
      boxX: number;
      boxY: number;
      boxWidth: number;
      boxHeight: number;
      fontFamily?: string;
      fontWeight?: number;
      fontSizePixels?: number;
      color?: string;
      textAlign?: string;
      strokeColor?: string;
      strokeWidth?: number;
      isUppercase?: boolean;
    }>> = {};

    // --- Pivot translation: reorder languages so English is processed first ---
    // For distant language pairs (ko→ar, ja→hi, etc.), we use English as a
    // reference to improve translation quality. English must be translated first.
    const { needsPivot, buildEnglishReferenceForImage, buildEnglishReferenceForText } = await import("@/lib/pivot-translation");
    const hasDistantPairs = targetLanguages.some(tl => tl !== sourceLanguage && needsPivot(sourceLanguage, tl));
    const needsEnglishFirst = hasDistantPairs && sourceLanguage !== "en";

    // Reorder: English first if needed for pivot
    const orderedTargetLanguages = [...targetLanguages];
    if (needsEnglishFirst) {
      const enIdx = orderedTargetLanguages.indexOf("en");
      if (enIdx > 0) {
        orderedTargetLanguages.splice(enIdx, 1);
        orderedTargetLanguages.unshift("en");
      } else if (enIdx === -1) {
        // English not in target list but we need it for pivot — add as internal-only
        orderedTargetLanguages.unshift("en");
      }
    }

    // Kick off clean image generation early (runs in parallel with translations)
    const cleanImagePromise = generateCleanImagesForPost(postId, imageDataList, imageUrls).catch(
      (e) => console.error("Clean image generation failed:", e)
    );

    // Cache for pivot: English translation results
    let englishSegmentsForPivot: Array<{ sourceText: string; translatedText: string }> = [];
    let englishTitle: string | null = null;
    let englishBody: string | null = null;
    const isEnglishInternalOnly = needsEnglishFirst && !targetLanguages.includes("en");

    for (const targetLang of orderedTargetLanguages) {
      if (targetLang === sourceLanguage) continue;

      // --- DB check: skip if a COMPLETED translation already exists for this language ---
      const existingPayload = await prisma.translationPayload.findFirst({
        where: {
          postId,
          targetLanguage: targetLang as LanguageCode,
          status: { in: ["COMPLETED", "APPROVED"] },
        },
        orderBy: { version: "desc" },
        select: { id: true, version: true, translatedTitle: true },
      });
      if (existingPayload) {
        console.debug(`[DB] Translation already exists for ${postId}:${targetLang} (v${existingPayload.version}), skipping Gemini call`);
        results[targetLang] = {
          payloadId: existingPayload.id,
          version: existingPayload.version,
          segmentCount: 0,
          confidence: null,
        };
        continue;
      }

      const systemPrompt = buildTranslationSystemPrompt(sourceLanguage, targetLang);

      try {
        // Check Redis cache before running Gemini analysis
        const cachedResult = await getCachedTranslation(postId, targetLang);

        const model = getGenAI().getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: systemPrompt,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        });

        // Translate ALL images IN PARALLEL and collect segments with imageIndex
        const allSegments: Array<TranslationSegmentResponse & { imageIndex: number }> = [];
        let firstParsed: AITranslationResult | null = null;
        const allCultureNotes: CultureNoteResponse[] = [];

        // If we have a cached result, use it instead of calling Gemini
        if (cachedResult && cachedResult.segments && cachedResult.segments.length > 0) {
          console.debug(`[Cache] Using cached translation for ${postId}:${targetLang}`);
          firstParsed = cachedResult;
          for (const seg of cachedResult.segments) {
            allSegments.push({ ...seg, imageIndex: (seg as any).imageIndex ?? 0 });
          }
          if (cachedResult.cultureNote) {
            allCultureNotes.push(cachedResult.cultureNote);
          }
        } else {
        // --- Begin Gemini translation (no cache hit) ---

        // Helper: translate a single image with retry (max 2 attempts)
        const translateSingleImage = async (
          imgIdx: number,
          imgData: { base64: string; mimeType: string },
        ): Promise<{ parsed: AITranslationResult | null; imgIdx: number }> => {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              if (attempt > 0) {
                await new Promise((r) => setTimeout(r, 1500));
              }
              // Build pivot reference if this is a distant language pair
              const pivotRef = needsPivot(sourceLanguage, targetLang) && englishSegmentsForPivot.length > 0
                ? "\n\n" + buildEnglishReferenceForImage(englishSegmentsForPivot)
                : "";
              const result = await model.generateContent([
                `Translate this meme from ${sourceLanguage} to ${targetLang}. Analyze the image and detect all EXISTING text regions. If the image has NO text at all, return empty segments array. NEVER invent or add text that is not in the image. Respond ONLY with valid JSON, no markdown fences.${imageDataList.length > 1 ? ` This is image ${imgIdx + 1} of ${imageDataList.length} in a multi-image post.` : ""}${pivotRef}`,
                {
                  inlineData: {
                    data: imgData.base64,
                    mimeType: imgData.mimeType,
                  },
                },
              ]);

              // Fire-and-forget content safety check on first image
              if (imgIdx === 0) {
                checkContentSafety(postId, result.response).catch(() => {});
              }

              const text = result.response.text();
              if (!text) continue;

              const cleaned = stripMarkdownFences(text);
              const parsed = JSON.parse(cleaned) as AITranslationResult;
              if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) continue;

              return { parsed, imgIdx };
            } catch (err) {
              console.warn(`Translate attempt ${attempt + 1} failed for ${targetLang} image ${imgIdx}:`, err instanceof Error ? err.message : String(err));
            }
          }
          return { parsed: null, imgIdx };
        };

        // Launch image translations with controlled concurrency (max 3 at a time)
        const validImages = imageDataList
          .map((imgData, idx) => ({ imgData, idx }))
          .filter(({ imgData }) => !!imgData.base64);

        const imageResults: Array<{ parsed: AITranslationResult | null; imgIdx: number }> = [];
        const IMG_CONCURRENCY = 3;
        for (let i = 0; i < validImages.length; i += IMG_CONCURRENCY) {
          const batch = validImages.slice(i, i + IMG_CONCURRENCY);
          const batchResults = await Promise.all(
            batch.map(({ imgData, idx }) => translateSingleImage(idx, imgData))
          );
          imageResults.push(...batchResults);
          // Small delay between batches to avoid rate limiting
          if (i + IMG_CONCURRENCY < validImages.length) {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        // Collect results (maintaining order)
        for (const { parsed, imgIdx } of imageResults.sort((a, b) => a.imgIdx - b.imgIdx)) {
          if (parsed) {
            if (!firstParsed) firstParsed = parsed;
            for (const seg of parsed.segments) {
              allSegments.push({ ...seg, imageIndex: imgIdx });
            }
            if (parsed.cultureNote) {
              allCultureNotes.push(parsed.cultureNote);
            }
          } else {
            console.warn(`Translation failed for ${targetLang} image ${imgIdx}`);
          }
        }

        if (allSegments.length === 0 || !firstParsed) {
          console.error(`All translation attempts failed for ${targetLang}`);
          results[targetLang] = { error: `Translation failed for all images` };
          continue;
        }

        // Cache the successful Gemini result for future use
        if (!cachedResult) {
          setCachedTranslation(postId, targetLang, {
            memeType: firstParsed.memeType,
            segments: allSegments.map(s => ({
              sourceText: s.sourceText,
              translatedText: s.translatedText,
              semanticRole: s.semanticRole,
              box: s.box,
              style: s.style,
              imageIndex: s.imageIndex,
            })),
            cultureNote: allCultureNotes.length > 0 ? allCultureNotes[0] : { summary: "", explanation: "" },
            confidence: firstParsed.confidence,
          }).catch(err => console.warn("[Cache] Failed to cache translation:", err));
        }

        } // --- End Gemini else block ---

        if (allSegments.length === 0 || !firstParsed) {
          // Already handled inside the else block with `continue`, but guard for cache path too
          console.error(`No segments available for ${targetLang}`);
          results[targetLang] = { error: `Translation failed for ${targetLang}` };
          continue;
        }

        // Track segments (with position info) for translated image generation later
        allSegmentsByLang[targetLang] = allSegments.map((s) => ({
          sourceText: s.sourceText,
          translatedText: s.translatedText,
          semanticRole: s.semanticRole,
          boxX: s.box.x,
          boxY: s.box.y,
          boxWidth: s.box.width,
          boxHeight: s.box.height,
          fontFamily: s.style.fontFamily,
          fontWeight: s.style.fontWeight,
          fontSizePixels: s.style.fontSize,
          color: s.style.color,
          textAlign: s.style.textAlign,
          strokeColor: s.style.strokeColor,
          strokeWidth: s.style.strokeWidth,
          isUppercase: undefined,
        }));

        // Cache English segments for pivot translation of distant languages
        if (targetLang === "en") {
          englishSegmentsForPivot = allSegments.map(s => ({
            sourceText: s.sourceText,
            translatedText: s.translatedText,
          }));
        }

        // Translate title & body text (in parallel) — uses lighter model for cost savings
        const targetName = LANGUAGE_INSTRUCTIONS[targetLang]?.split(":")[0] || targetLang;
        let translatedTitle: string | null = null;
        let translatedBody: string | null = null;

        // Check if title/body were already translated (e.g., by /api/translate/text)
        const existingTextTranslation = await prisma.translationPayload.findFirst({
          where: {
            postId,
            targetLanguage: targetLang as LanguageCode,
            translatedTitle: { not: null },
            status: { in: ["COMPLETED", "APPROVED"] },
          },
          orderBy: { version: "desc" },
          select: { translatedTitle: true, translatedBody: true },
        });
        if (existingTextTranslation?.translatedTitle) {
          translatedTitle = existingTextTranslation.translatedTitle;
          translatedBody = existingTextTranslation.translatedBody || translatedBody;
        } else {
          const textTranslations = await Promise.allSettled([
            // Title translation (gemini-2.5-flash-lite — cheaper, sufficient quality for text)
            (post.title && sourceLanguage !== targetLang) ? (async () => {
              const m = getGenAI().getGenerativeModel({
                model: "gemini-2.5-flash-lite",
                generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
              });
              const pivotHint = needsPivot(sourceLanguage, targetLang) && englishTitle
                ? `\n\nEnglish reference (for accuracy): "${englishTitle}"`
                : "";
              const r = await m.generateContent(
                `Translate the following meme title to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${post.title}${pivotHint}`
              );
              return r.response.text().trim();
            })() : Promise.resolve(null),
            // Body translation (gemini-2.5-flash-lite — cheaper, sufficient quality for text)
            (post.body && sourceLanguage !== targetLang) ? (async () => {
              const m = getGenAI().getGenerativeModel({
                model: "gemini-2.5-flash-lite",
                generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
              });
              const pivotHint = needsPivot(sourceLanguage, targetLang) && englishBody
                ? `\n\nEnglish reference (for accuracy): "${englishBody}"`
                : "";
              const r = await m.generateContent(
                `Translate the following meme description to ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.\n\n${post.body}${pivotHint}`
              );
              return r.response.text().trim();
            })() : Promise.resolve(null),
          ]);
          translatedTitle = textTranslations[0].status === "fulfilled" ? textTranslations[0].value : null;
          translatedBody = textTranslations[1].status === "fulfilled" ? textTranslations[1].value : null;
        }

        // Cache English title/body for pivot translation of distant languages
        if (targetLang === "en") {
          englishTitle = translatedTitle;
          englishBody = translatedBody;
        }

        // If English was internal-only (not requested by user), skip DB storage
        if (targetLang === "en" && isEnglishInternalOnly) {
          console.debug(`[Pivot] English translation completed (internal-only, not saving to DB)`);
          continue;
        }

        // Merge culture notes from all images into one combined note
        const mergedCultureNote: CultureNoteResponse | null = allCultureNotes.length > 0
          ? allCultureNotes.length === 1
            ? allCultureNotes[0]
            : {
                summary: allCultureNotes.map((n, i) => `[${i + 1}] ${n.summary}`).join("\n"),
                explanation: allCultureNotes.map((n, i) => `[${i + 1}] ${n.explanation}`).join("\n\n"),
                translationNote: allCultureNotes
                  .map((n, i) => n.translationNote ? `[${i + 1}] ${n.translationNote}` : null)
                  .filter(Boolean)
                  .join("\n") || undefined,
              }
          : null;

        // Store TranslationPayload + segments in a transaction
        const confidence = firstParsed.confidence ?? null;
        const memeType = firstParsed.memeType ?? null;
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
              confidence,
              memeType,
              translatedTitle,
              translatedBody,
              creatorType: "AI",
              creatorId: null,
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
            include: { segments: true },
          });

          // Create CultureNote per target language (merged from all images)
          if (mergedCultureNote) {
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
                  summary: mergedCultureNote.summary || "",
                  explanation: mergedCultureNote.explanation || "",
                  translationNote: mergedCultureNote.translationNote ?? null,
                  creatorType: "AI",
                  status: "PUBLISHED",
                  confidence,
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

    // Wait for clean images (started earlier, runs in parallel with translations)
    await cleanImagePromise;

    // Generate translated images for each language (parallel, awaited)
    const composePromises: Promise<void>[] = [];
    for (const tl of orderedTargetLanguages) {
      const lr = results[tl];
      if (lr?.payloadId && allSegmentsByLang[tl]?.length) {
        composePromises.push(
          generateTranslatedImageForPayload(lr.payloadId, postId, allSegmentsByLang[tl], tl)
            .catch((e) => console.error(`Compose failed for ${tl}:`, e))
        );
      }
    }
    await Promise.all(composePromises);

    // Update ranking score after translations complete
    updateRankingScore(postId).catch((e) => { console.error("Failed to update ranking score:", e); });

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
