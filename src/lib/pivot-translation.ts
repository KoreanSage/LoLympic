/**
 * Pivot Translation — improves translation quality for "distant" language pairs
 * by using English as an intermediate reference language.
 *
 * Instead of translating ar→ko directly (poor quality), we:
 * 1. Translate ar→en first
 * 2. Then translate ar→ko with the English translation as reference context
 *
 * The AI sees both the original text AND a high-quality English version,
 * producing significantly better results for distant language pairs.
 */

// Language pairs that benefit from English pivot translation.
// Key = source language, Value = set of target languages that need pivot.
// If a pair is NOT listed, direct translation is used (already high quality).
const PIVOT_MAP: Record<string, Set<string>> = {
  ar: new Set(["ko", "ja", "zh", "hi"]),
  hi: new Set(["ko", "ja", "zh", "ar"]),
  es: new Set(["ko", "ja", "zh"]),
  ko: new Set(["ar", "hi", "es"]),
  ja: new Set(["ar", "hi", "es"]),
  zh: new Set(["ar", "hi", "es"]),
};

/**
 * Check if a language pair needs English pivot translation.
 * Returns false if either language is English (no pivot needed).
 */
export function needsPivot(source: string, target: string): boolean {
  if (source === "en" || target === "en") return false;
  return PIVOT_MAP[source]?.has(target) ?? false;
}

/**
 * Build an English reference context string for pivot translation prompts.
 * Used for text (title/body) translation.
 */
export function buildEnglishReferenceForText(
  englishTitle: string,
  englishBody: string | null
): string {
  return `
## English Reference Translation (for improved accuracy)
The following is a high-quality English translation of the source text.
Use BOTH the original source text AND this English reference to produce the best translation.
The English is for reference only — always capture the original nuance, don't just re-translate from English.

English title: "${englishTitle}"${englishBody ? `\nEnglish body: "${englishBody}"` : ""}`;
}

/**
 * Build an English reference context string for pivot translation prompts.
 * Used for image meme translation (includes segment texts).
 */
export function buildEnglishReferenceForImage(
  englishSegments: Array<{ sourceText: string; translatedText: string }>
): string {
  if (englishSegments.length === 0) return "";

  const segmentList = englishSegments
    .map((s) => `  - "${s.sourceText}" → "${s.translatedText}"`)
    .join("\n");

  return `
## English Reference Translation (for improved accuracy)
The following are high-quality English translations of the meme text segments.
Use BOTH the original image text AND these English references to produce the best translation.
The English is for reference only — always capture the original nuance and cultural context.

English segment translations:
${segmentList}`;
}
