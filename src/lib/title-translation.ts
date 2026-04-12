// ---------------------------------------------------------------------------
// Title / description translation helper with echo detection and retry.
//
// BACKGROUND
// Gemini 2.5 flash-lite occasionally refuses to translate a title and echoes
// the source text back (sometimes with minor whitespace reformatting, e.g.
// "밥먹을땐" → "밥먹을 땐"). We've seen this happen ~5% of the time on casual
// Korean sentences when translating to Japanese. The failure mode looks like
// a successful response so the caller can't tell something went wrong.
//
// DEFENSE
// 1. Echo detection — if the normalised translated text is ≥90% similar to
//    the normalised source, treat the attempt as failed.
// 2. Script validation — each target language has a "must contain at least
//    one of these characters" rule. Japanese titles without a single
//    hiragana/katakana are almost certainly not Japanese; Korean titles with
//    kana are wrong; etc.
// 3. Retry with a stricter prompt that quotes the previous bad attempt back
//    to Gemini and explicitly states what the output script must be.
//
// All 5 places in the codebase that translate titles to Gemini should use
// `translateTitleOrDescription` instead of rolling their own prompt.
// ---------------------------------------------------------------------------
import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// Language metadata
// ---------------------------------------------------------------------------

const LANGUAGE_NAMES: Record<string, string> = {
  ko: "Korean (한국어)",
  en: "English",
  ja: "Japanese (日本語)",
  zh: "Chinese (中文 / 简体)",
  es: "Spanish (Español)",
  hi: "Hinglish (Hindi written in Roman/Latin script, NO Devanagari)",
  ar: "Arabic (العربية)",
};

/** Scripts that are INVALID in the target language — if any of these appear,
 * the "translation" is almost certainly the source text bleeding through.
 *
 * This is the SOLE validation strategy. We tried two other checks during
 * the investigation in #112/#113/#114 — similarity-based echo detection
 * and required-script validation — and both produced more false positives
 * than the bug they caught:
 *
 *   - similarity detection → rejected legitimate brand names and proper
 *     nouns ("Google", "LOL", "McDonald's", "64")
 *   - required-script → rejected valid short Japanese outputs like "Google"
 *     (JP uses Latin for brand names)
 *
 * The forbidden-script check alone catches the real ko→ja echo bug
 * (hangul in a "Japanese" output) without triggering on legitimate same-
 * script pairs. See src/lib/title-translation.ts docstring for context. */
const FORBIDDEN_SCRIPTS: Record<string, RegExp[]> = {
  ja: [/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/], // no Hangul in Japanese
  ko: [/[\u3040-\u309F\u30A0-\u30FF]/],              // no kana in Korean
  zh: [
    /[\u3040-\u309F\u30A0-\u30FF]/, // no kana in Chinese
    /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/, // no Hangul in Chinese
  ],
  hi: [/[\u0900-\u097F]/], // Hinglish must be Roman, not Devanagari
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Strip common wrappings Gemini sometimes adds around its output:
 * surrounding quotes, "Title:" prefix, trailing newlines. */
function stripWrapping(s: string): string {
  return s
    .trim()
    .replace(/^["'「『]+|["'」』]+$/g, "")
    .replace(/^(Title|Translation|Translated|Output|Answer)\s*:\s*/i, "")
    .trim();
}

export function isValidTranslation(
  translated: string,
  _source: string,
  targetLang: string,
  _sourceLang?: string
): boolean {
  const cleaned = stripWrapping(translated);
  if (!cleaned) return false;

  const forbidden = FORBIDDEN_SCRIPTS[targetLang];
  if (forbidden && forbidden.some((re) => re.test(cleaned))) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function scriptHint(targetLang: string): string {
  switch (targetLang) {
    case "ja":
      return " The output MUST be written in Japanese script (hiragana, katakana, and/or kanji). DO NOT return Korean hangul.";
    case "ko":
      return " The output MUST be written in Korean hangul. DO NOT return Japanese kana.";
    case "zh":
      return " The output MUST be written in Chinese characters only. DO NOT include Japanese kana or Korean hangul.";
    case "ar":
      return " The output MUST be written in Arabic script.";
    case "hi":
      return " The output MUST be written in Roman/Latin script only (Hinglish). DO NOT use Devanagari.";
    default:
      return "";
  }
}

function buildInitialPrompt(opts: {
  sourceText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  kind: "title" | "description";
  englishReference?: string | null;
}): string {
  const targetName = LANGUAGE_NAMES[opts.targetLanguage] || opts.targetLanguage;
  const sourceName = opts.sourceLanguage
    ? LANGUAGE_NAMES[opts.sourceLanguage] || opts.sourceLanguage
    : null;
  const fromClause = sourceName ? ` from ${sourceName}` : "";
  const pivot = opts.englishReference
    ? `\n\nEnglish reference (for accuracy): "${opts.englishReference}"`
    : "";
  return `Translate the following meme ${opts.kind}${fromClause} into ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.${scriptHint(opts.targetLanguage)}

${opts.sourceText}${pivot}`;
}

function buildRetryPrompt(
  opts: {
    sourceText: string;
    sourceLanguage?: string;
    targetLanguage: string;
    kind: "title" | "description";
  },
  previousAttempt: string
): string {
  const targetName = LANGUAGE_NAMES[opts.targetLanguage] || opts.targetLanguage;
  const sourceName = opts.sourceLanguage
    ? LANGUAGE_NAMES[opts.sourceLanguage] || opts.sourceLanguage
    : "the detected source language";
  return `Your previous response was "${previousAttempt}" — that is NOT a valid ${targetName} translation. It looks like the source text or contains the wrong script.

Translate this ${sourceName} meme ${opts.kind} into ${targetName}.${scriptHint(opts.targetLanguage)} Output ONLY the translated ${opts.kind}, no quotes, no label, no explanation.

${opts.sourceText}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let _defaultGenAI: GoogleGenerativeAI | null = null;
function getDefaultModel(maxOutputTokens: number): GenerativeModel {
  if (!_defaultGenAI) {
    _defaultGenAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return _defaultGenAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { temperature: 0.3, maxOutputTokens },
  });
}

export interface TitleTranslationOptions {
  sourceText: string;
  /** Omit when the source language is unknown (e.g. comment translation) —
   * the helper will emit a prompt without a "from X" clause and let Gemini
   * auto-detect. */
  sourceLanguage?: string;
  targetLanguage: string;
  /** "title" defaults to 512 tokens, "description" to 1024. */
  kind?: "title" | "description";
  /** Optional English pivot reference to improve distant-language pairs. */
  englishReference?: string | null;
  /** Override the Gemini model (used by routes that already have one). */
  model?: GenerativeModel;
}

/**
 * Translate a title or description with echo detection + retry.
 *
 * Returns the validated translation string, or `null` if both attempts
 * produce invalid output (echo, wrong script, empty).
 *
 * The caller should treat `null` as a failure and fall back to either the
 * source text or the English translation, NOT persist `null` as the user-
 * facing title.
 */
export async function translateTitleOrDescription(
  opts: TitleTranslationOptions
): Promise<string | null> {
  // Same language — identity translation, no API call needed.
  if (opts.sourceLanguage === opts.targetLanguage) return opts.sourceText;
  // Empty input — nothing to translate.
  if (!opts.sourceText || !opts.sourceText.trim()) return null;

  const kind = opts.kind ?? "title";
  const model = opts.model ?? getDefaultModel(kind === "title" ? 512 : 1024);

  // Attempt 1 — normal prompt
  let attempt1Raw: string | null = null;
  try {
    const r = await model.generateContent(
      buildInitialPrompt({ ...opts, kind })
    );
    attempt1Raw = (r.response.text() ?? "").trim();
  } catch (err) {
    console.warn(
      `[title-translation] attempt 1 threw for ${opts.sourceLanguage}→${opts.targetLanguage}:`,
      err
    );
  }

  if (attempt1Raw && isValidTranslation(attempt1Raw, opts.sourceText, opts.targetLanguage, opts.sourceLanguage)) {
    return stripWrapping(attempt1Raw);
  }

  console.warn(
    `[title-translation] ${opts.sourceLanguage}→${opts.targetLanguage} attempt 1 invalid. source="${opts.sourceText}" got="${attempt1Raw}"`
  );

  // Attempt 2 — stricter prompt quoting the bad output back at Gemini
  let attempt2Raw: string | null = null;
  try {
    const r = await model.generateContent(
      buildRetryPrompt({ ...opts, kind }, attempt1Raw || opts.sourceText)
    );
    attempt2Raw = (r.response.text() ?? "").trim();
  } catch (err) {
    console.warn(
      `[title-translation] attempt 2 threw for ${opts.sourceLanguage}→${opts.targetLanguage}:`,
      err
    );
  }

  if (attempt2Raw && isValidTranslation(attempt2Raw, opts.sourceText, opts.targetLanguage, opts.sourceLanguage)) {
    return stripWrapping(attempt2Raw);
  }

  console.warn(
    `[title-translation] ${opts.sourceLanguage}→${opts.targetLanguage} attempt 2 also invalid. got="${attempt2Raw}"`
  );
  return null;
}
