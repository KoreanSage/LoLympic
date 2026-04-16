"""
Stage 3: Transcendent Translation + Cultural Context

Uses Gemini to translate meme text with cultural adaptation,
preserving humor, slang, and emotional impact.

Pipeline:
  list[TextRegion] + source_lang + target_lang -> Gemini -> list[TranslationSegment] + CultureNote
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from .models import (
    CultureNote,
    MemeType,
    SemanticRole,
    StyleInfo,
    TextRegion,
    TranslationSegment,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language-specific translation instructions (mirrors Next.js codebase)
# ---------------------------------------------------------------------------
LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "ko": "Korean (한국어): Preserve original meaning first. Do NOT replace with unrelated idioms. Natural everyday Korean. Keep compact.",
    "ja": "Japanese (日本語): CRITICAL — Natural internet Japanese (ネット用語), NOT textbook. Casual register (タメ口) by default. ツッコミ/ボケ, deadpan delivery. Internet expressions: 草/w, ワロタ, それな, マジで, やばい. English loanwords in katakana naturally. WORD PRECISION: 適当 = 'appropriate' OR 'sloppy' — pick from context. Concise.",
    "zh": "Chinese (中文): CRITICAL — Simplified Chinese (简体中文). Natural internet style (网络用语), NOT formal. Bilibili/Weibo tone. Slang: 绝绝子, 6/666, 笑死, 蚌埠住了, yyds. Character count LOW — shorter than English. Casual spoken Chinese (口语), not written (书面语).",
    "en": "English: CRITICAL — American internet English default. Irony, self-deprecation, absurdist escalation. Internet-native (all caps, misspellings: 'smol', 'boi'). Adapt cultural references to Western/American equivalents. Punchy — shorter hits harder.",
    "es": "Spanish (Español): CRITICAL — Latin American Spanish (LATAM) default. Mexican/general LATAM register. Internet Spanish: wey, neta, no mames, pana. Dramatic, exaggerated. Diminutives for comedy. WORD PRECISION: coger = 'take' in Spain but vulgar in LATAM. Iberian-origin memes keep Iberian register.",
    "hi": "Hinglish (Roman script): CRITICAL — Write ALL Hindi in Roman/Latin script ONLY (e.g. 'Bhai ye kya hai' NOT Devanagari). Bollywood-influenced, filmi dialogues. Always Roman script.",
    "ar": "Arabic (العربية): CRITICAL — Egyptian colloquial Arabic (عامية مصرية) as default. WORD PRECISION: pick the contextually correct word, not just a close synonym (e.g. 'sexually active' = 'نشط جنسياً' NOT 'نشيط جنسياً'). Use STANDARD Arabic equivalents for medical/technical/idiomatic English — do NOT translate word-by-word. Short, punchy, internet-native (يعني، والله، يلا). Street humor = street Arabic, not MSA.",
}

# ---------------------------------------------------------------------------
# Language-specific quality checklists
# ---------------------------------------------------------------------------
_QUALITY_CHECKLISTS: dict[str, str] = {
    "ja": """
## JAPANESE QUALITY CHECKLIST
- Use casual internet Japanese (タメ口), NOT polite textbook form (です/ます), unless the meme's tone is deliberately formal.
- WORD PRECISION: 適当 = 'appropriate' or 'sloppy' depending on context. やばい = positive or negative depending on context.
- For English internet slang: use established Japanese equivalents. Do NOT invent katakana words JP internet doesn't use.
- Keep it SHORT. Japanese memes are punchy. Preserve punchline timing.
""",
    "zh": """
## CHINESE QUALITY CHECKLIST
- Use Simplified Chinese (简体中文) ONLY.
- Write in casual internet Chinese (口语), NOT literary/formal Chinese (书面语).
- WORD PRECISION: 可以 vs 行 (formal vs casual OK), 不要 vs 别 (formal vs casual don't).
- Keep translations SHORTER than English. Use internet expressions naturally: 笑死, 绝了, 6/666, 蚌埠住了.
""",
    "es": """
## SPANISH QUALITY CHECKLIST
- Default to Latin American Spanish (LATAM). Mexican/general LATAM register.
- WORD PRECISION: coger = 'to take' in Spain but VULGAR in LATAM — use agarrar/tomar.
- Natural internet tone. Dramatic, exaggerated. Diminutives for comedy.
""",
    "en": """
## ENGLISH QUALITY CHECKLIST
- American internet English as default register.
- Adapt culture-specific references to Western/American equivalents — don't leave untranslated.
- Keep translations SHORT and punchy. Preserve meme format conventions.
""",
    "ar": """
## ARABIC QUALITY CHECKLIST
- Use the EXACT correct Arabic word — near-synonyms are NOT interchangeable.
  Common pitfalls: نشط vs نشيط (active vs diligent), حامل vs شايلة, بخيل vs اقتصادي
- Translate IDIOMS as whole units (e.g. 'sexually active' = 'نشط جنسياً' as fixed phrase).
- Prefer Egyptian colloquial: إيه، ده، كده، عشان، دلوقتي
- Avoid over-formal MSA. Real memes sound like someone talking, not a textbook.
""",
}


def _build_quality_checklist(target_lang: str) -> str:
    """Return language-specific quality checklist, or empty string."""
    return _QUALITY_CHECKLISTS.get(target_lang, "")


def _build_prompt(
    regions: list[TextRegion],
    source_lang: str,
    target_lang: str,
    meme_type: MemeType,
) -> str:
    """Build the translation prompt for Gemini."""
    source_inst = LANGUAGE_INSTRUCTIONS.get(source_lang, f"Source: {source_lang}")
    target_inst = LANGUAGE_INSTRUCTIONS.get(target_lang, f"Target: {target_lang}")

    # Only include translatable regions
    translatable = [r for r in regions if r.is_translatable]
    text_list = "\n".join(
        f'{i+1}. [{r.semantic_role.value}] "{r.source_text}"'
        for i, r in enumerate(translatable)
    )

    return f"""You are a world-class meme translator for LoLympic.
Create TRANSCENDENT translations — culturally adapted versions that hit just as hard in the target language.

## Source Language
{source_inst}

## Target Language
{target_inst}
{_build_quality_checklist(target_lang)}
## Meme Type: {meme_type.value}

## Text Regions to Translate
{text_list}

## Rules
1. Preserve FEELING: humor, rhythm, tone, punchline timing
2. Cultural adaptation > literal accuracy
3. Register matching: vulgar → vulgar, deadpan → deadpan
4. Keep translations roughly similar length to originals (for visual fit)
5. If a joke references a local concept, adapt to target culture equivalent

## Response (JSON only, no markdown fences)
{{
  "translations": [
    {{
      "index": 1,
      "source_text": "original",
      "translated_text": "transcendent translation"
    }}
  ],
  "culture_note": {{
    "summary": "One-line context (in {target_lang})",
    "explanation": "Detailed cultural explanation (in {target_lang})",
    "translation_note": "Why certain choices were made (in {target_lang})"
  }},
  "confidence": 0.85
}}"""


def _strip_fences(text: str) -> str:
    """Remove markdown code fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```\w*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Main translation function
# ---------------------------------------------------------------------------

def translate_regions(
    regions: list[TextRegion],
    source_lang: str,
    target_lang: str,
    meme_type: MemeType,
    api_key: str,
    max_retries: int = 3,
) -> tuple[list[TranslationSegment], Optional[CultureNote], float]:
    """
    Translate all translatable text regions using Gemini.

    Args:
        regions: Text regions from OCR (with is_translatable flags)
        source_lang: Source language code (e.g., 'ko')
        target_lang: Target language code (e.g., 'en')
        meme_type: Detected meme type
        api_key: Gemini API key
        max_retries: Number of retry attempts on failure

    Returns:
        (translated_segments, culture_note, confidence)
    """
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.7,
            "max_output_tokens": 8192,
        },
    )

    translatable = [r for r in regions if r.is_translatable]
    if not translatable:
        logger.warning("No translatable regions found")
        return [], None, 0.0

    prompt = _build_prompt(regions, source_lang, target_lang, meme_type)

    # Retry loop
    parsed = None
    for attempt in range(max_retries):
        try:
            result = model.generate_content(prompt)
            raw_text = result.text
            cleaned = _strip_fences(raw_text)
            parsed = json.loads(cleaned)
            break
        except Exception as e:
            logger.warning(f"Translation attempt {attempt + 1} failed: {e}")
            if attempt < max_retries - 1:
                import time
                time.sleep(2 * (attempt + 1))

    if not parsed:
        logger.error("All translation attempts failed")
        return [], None, 0.0

    # Map translations back to segments
    translations_map: dict[int, str] = {}
    for t in parsed.get("translations", []):
        idx = t.get("index", 0)
        translations_map[idx] = t.get("translated_text", "")

    segments: list[TranslationSegment] = []
    translatable_idx = 0

    for region in regions:
        if region.is_translatable:
            translatable_idx += 1
            translated_text = translations_map.get(translatable_idx, region.source_text)
        else:
            # Non-translatable: keep original text
            translated_text = region.source_text

        segments.append(TranslationSegment(
            source_text=region.source_text,
            translated_text=translated_text,
            box=region.box,
            style=region.style,
            semantic_role=region.semantic_role,
            is_translatable=region.is_translatable,
            image_index=region.image_index,
        ))

    # Culture note
    cn_data = parsed.get("culture_note", {})
    culture_note = CultureNote(
        summary=cn_data.get("summary", ""),
        explanation=cn_data.get("explanation", ""),
        translation_note=cn_data.get("translation_note"),
    ) if cn_data else None

    confidence = parsed.get("confidence", 0.85)
    logger.info(
        f"Translated {len(translatable)} regions "
        f"({source_lang} -> {target_lang}), confidence={confidence}"
    )

    return segments, culture_note, confidence
