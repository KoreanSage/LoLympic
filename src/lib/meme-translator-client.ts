/**
 * Client for the Python MemeTranslator service.
 *
 * The Python service runs on a separate port (default: 8100)
 * and provides high-quality meme translation via a 4-stage pipeline:
 *   OCR → Inpainting → Translation → Rendering
 *
 * This client provides typed wrappers for calling the Python service
 * from Next.js API routes.
 */

const MEME_TRANSLATOR_URL =
  process.env.MEME_TRANSLATOR_URL || "http://localhost:8100";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranslateRequest {
  imageBase64: string;
  mimeType?: string;
  sourceLang?: string;
  targetLang?: string;
  memeType?: "A" | "B" | "C";
  renderMode?: "A" | "B";
  titleText?: string;
  cleanImageBase64?: string;
}

export interface TranslatedSegment {
  source_text: string;
  translated_text: string;
  semantic_role: string;
  is_translatable: boolean;
  box: { x: number; y: number; width: number; height: number };
}

export interface TranslateResponse {
  translated_image_base64: string;
  clean_image_base64: string | null;
  meme_type: string;
  render_mode: string;
  source_lang: string;
  target_lang: string;
  confidence: number;
  segments: TranslatedSegment[];
  culture_note: {
    summary: string;
    explanation: string;
    translation_note?: string;
  } | null;
  elapsed_ms: number;
}

export interface AnalyzeResponse {
  meme_type: string;
  render_mode: string;
  region_count: number;
  translatable_count: number;
  regions: Array<{
    source_text: string;
    semantic_role: string;
    is_translatable: boolean;
    box: { x: number; y: number; width: number; height: number };
    style: {
      font_size: number;
      font_weight: number;
      color: string;
      text_align: string;
    };
    confidence: number;
  }>;
  elapsed_ms: number;
}

// ---------------------------------------------------------------------------
// Client functions
// ---------------------------------------------------------------------------

/**
 * Check if the Python MemeTranslator service is running.
 */
export async function isServiceAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${MEME_TRANSLATOR_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Translate a meme image via the Python pipeline.
 *
 * Falls back gracefully if the Python service is unavailable.
 */
export async function translateMeme(
  req: TranslateRequest
): Promise<TranslateResponse | null> {
  try {
    const res = await fetch(`${MEME_TRANSLATOR_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: req.imageBase64,
        mime_type: req.mimeType || "image/jpeg",
        source_lang: req.sourceLang || "ko",
        target_lang: req.targetLang || "en",
        meme_type: req.memeType || null,
        render_mode: req.renderMode || null,
        title_text: req.titleText || null,
        clean_image_base64: req.cleanImageBase64 || null,
      }),
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    if (!res.ok) {
      console.error(`MemeTranslator error: ${res.status} ${res.statusText}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("MemeTranslator service unavailable:", err);
    return null;
  }
}

/**
 * Analyze a meme image (OCR only, no translation).
 */
export async function analyzeMeme(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<AnalyzeResponse | null> {
  try {
    const res = await fetch(`${MEME_TRANSLATOR_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_base64: imageBase64,
        mime_type: mimeType,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
