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

/** Unicode ranges that MUST appear at least once in a valid translation for
 * this target language. Languages that share the Latin alphabet (en/es/hi)
 * all require Latin letters.
 *
 * Japanese accepts BOTH kana and CJK ideographs because real Japanese titles
 * can be kanji-only (e.g. "友達", "試験", "家族"). We can't distinguish
 * kanji-only Japanese from Chinese by script alone — the FORBIDDEN_SCRIPTS
 * hangul check below is what actually catches the Korean-echo bug. */
const REQUIRED_SCRIPT: Record<string, RegExp> = {
  ko: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/, // Hangul
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/, // kana OR kanji
  zh: /[\u4E00-\u9FFF\u3400-\u4DBF]/, // CJK unified ideographs
  ar: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/,
  hi: /[A-Za-z]/,
  en: /[A-Za-z]/,
  es: /[A-Za-z]/,
};

/** Scripts that are INVALID in the target language — if any of these appear,
 * the "translation" is almost certainly the source text bleeding through. */
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

// Whitespace + common punctuation (ASCII + CJK + quotes). Used to strip
// "noise" characters before comparing a translation to its source.
// Avoids the `u`-flag Unicode property classes which require es2018+.
// eslint-disable-next-line no-useless-escape
const PUNCT_AND_WS = /[\s!-/:-@\[-`{-~\u00A0-\u00BF\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\uFF00-\uFFEF]/g;

// Languages that share a script family. Within a family, an "echo" (the
// translated text being identical to the source) can be legitimate — proper
// nouns, brand names, numbers, and short internet slang like "LOL" or
// "Google" or "64" are often genuinely the same across en/es/hi. For these
// pairs we skip the echo-similarity check and rely on script validation
// alone. The ACTUAL bug we're fixing (ko→ja returning hangul) always
// crosses a script boundary, so it's still caught.
const SCRIPT_FAMILIES: Record<string, string> = {
  en: "latin",
  es: "latin",
  hi: "latin", // Hinglish (Roman)
  ko: "hangul",
  ja: "japanese",
  zh: "han",
  ar: "arabic",
};
function sameScriptFamily(a: string, b: string): boolean {
  return !!SCRIPT_FAMILIES[a] && SCRIPT_FAMILIES[a] === SCRIPT_FAMILIES[b];
}

/** Normalise a string for echo comparison: lowercase, strip whitespace and
 * punctuation so minor reformatting doesn't fool the echo check. */
function normaliseForCompare(s: string): string {
  return s.toLowerCase().replace(PUNCT_AND_WS, "");
}

/** Returns a similarity ratio in [0, 1]. 1 = identical after normalisation. */
function similarity(a: string, b: string): number {
  const aN = normaliseForCompare(a);
  const bN = normaliseForCompare(b);
  if (!aN || !bN) return 0;
  if (aN === bN) return 1;
  // Cheap containment: if the shorter normalised form is a substring of the
  // longer, we treat the ratio as len(short)/len(long). Catches "source with
  // a prefix like 'Title:'" cases.
  const shorter = aN.length < bN.length ? aN : bN;
  const longer = aN.length < bN.length ? bN : aN;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  return 0;
}

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
  source: string,
  targetLang: string,
  sourceLang?: string
): boolean {
  const cleaned = stripWrapping(translated);
  if (!cleaned) return false;

  // Echo detection — only applies when source and target are in DIFFERENT
  // script families. Within the same family (en↔es, en↔hi, es↔hi) a legit
  // translation can genuinely be identical (proper nouns, brand names,
  // numbers, internet slang). Skipping the echo check there removes a whole
  // class of false positives while still catching the cross-script bug
  // (ko→ja returning hangul, en→ar returning latin, etc.).
  if (!sourceLang || !sameScriptFamily(sourceLang, targetLang)) {
    const sim = similarity(cleaned, source);
    if (sim >= 0.9) return false;
  }

  // Must contain at least one character from the target script
  const required = REQUIRED_SCRIPT[targetLang];
  if (required && !required.test(cleaned)) return false;

  // Must NOT contain any forbidden-script characters
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
  sourceLanguage: string;
  targetLanguage: string;
  kind: "title" | "description";
  englishReference?: string | null;
}): string {
  const targetName = LANGUAGE_NAMES[opts.targetLanguage] || opts.targetLanguage;
  const sourceName = LANGUAGE_NAMES[opts.sourceLanguage] || opts.sourceLanguage;
  const pivot = opts.englishReference
    ? `\n\nEnglish reference (for accuracy): "${opts.englishReference}"`
    : "";
  return `Translate the following meme ${opts.kind} from ${sourceName} into ${targetName}. Output ONLY the translated text, nothing else. Keep the humor and tone.${scriptHint(opts.targetLanguage)}

${opts.sourceText}${pivot}`;
}

function buildRetryPrompt(
  opts: {
    sourceText: string;
    sourceLanguage: string;
    targetLanguage: string;
    kind: "title" | "description";
  },
  previousAttempt: string
): string {
  const targetName = LANGUAGE_NAMES[opts.targetLanguage] || opts.targetLanguage;
  const sourceName = LANGUAGE_NAMES[opts.sourceLanguage] || opts.sourceLanguage;
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
  sourceLanguage: string;
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
