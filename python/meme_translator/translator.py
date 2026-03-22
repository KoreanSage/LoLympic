"""
MemeTranslator — Main orchestrator for the 4-stage meme translation pipeline.

Pipeline:
  ┌─────────────────────────────────────────────────────────────┐
  │  Stage 1: OCR & Analysis                                    │
  │    Image → Google Vision / Gemini → TextRegions             │
  ├─────────────────────────────────────────────────────────────┤
  │  Stage 2: Background Restoration (Inpainting)               │
  │    Image + TextRegions → Gemini / LaMa / OpenCV → CleanImg  │
  ├─────────────────────────────────────────────────────────────┤
  │  Stage 3: Transcendent Translation                          │
  │    TextRegions + Languages → Gemini LLM → TranslatedSegs    │
  ├─────────────────────────────────────────────────────────────┤
  │  Stage 4: Rendering & Synthesis                             │
  │    Mode A: CleanImg + TranslatedSegs → Structured overlay   │
  │    Mode B: OriginalImg + TranslatedSegs → Re-authored meme  │
  └─────────────────────────────────────────────────────────────┘

Usage:
    translator = MemeTranslator(gemini_api_key="...")
    result = translator.translate(
        image_bytes=open("meme.jpg", "rb").read(),
        source_lang="ko",
        target_lang="en",
    )
    with open("translated.png", "wb") as f:
        f.write(result.translated_image_bytes)
"""

from __future__ import annotations

import io
import logging
import time
from typing import Optional

from PIL import Image

from .models import (
    CultureNote,
    MemeAnalysis,
    MemeType,
    RenderMode,
    TranslatedMeme,
    TranslationSegment,
    TextRegion,
)
from .ocr import ocr_with_vision_api, ocr_with_gemini
from .inpainter import inpaint, generate_mask
from .text_translator import translate_regions
from .renderer import render

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Meme type → Render mode mapping
# ---------------------------------------------------------------------------

def _determine_render_mode(
    meme_type: MemeType,
    regions: list[TextRegion],
) -> RenderMode:
    """
    Determine the optimal rendering mode based on meme type and content.

    Mode A (Structured): When text positions matter and can be precisely replaced.
      → Forum posts, tweets, chat messages (Type B)
      → Multi-panel comics with speech bubbles (Type C)

    Mode B (Unstructured): When creative re-authoring produces better results.
      → Overlay memes where text style IS the meme (Impact font, Type A)
      → Complex layouts where precise replacement would look unnatural

    Heuristic: If most regions have clear bounding boxes and the meme
    is structured content, use Mode A. Otherwise, Mode B.
    """
    if meme_type == MemeType.SCREENSHOT:
        # Forum posts, tweets → always structured
        return RenderMode.STRUCTURED

    if meme_type == MemeType.COMIC:
        # Comics with speech bubbles → structured replacement
        return RenderMode.STRUCTURED

    if meme_type == MemeType.OVERLAY:
        # Impact font memes — check if we have good bounding boxes
        translatable = [r for r in regions if r.is_translatable]
        if len(translatable) <= 3 and all(r.box.width > 0.3 for r in translatable):
            # Simple overlay text with large boxes → structured works well
            return RenderMode.STRUCTURED
        # Complex overlay → re-author
        return RenderMode.UNSTRUCTURED

    return RenderMode.STRUCTURED


def _classify_meme_type(regions: list[TextRegion]) -> MemeType:
    """
    Classify meme type from detected text regions when not provided.

    Heuristics:
      - Many small text regions at various Y positions → Screenshot (B)
      - 1-3 large text regions at top/bottom → Overlay (A)
      - Text in speech-bubble-like boxes → Comic (C)
    """
    translatable = [r for r in regions if r.is_translatable]
    if not translatable:
        return MemeType.OVERLAY

    # Count regions by position
    overlay_count = sum(
        1 for r in translatable
        if (r.box.y < 0.15 or r.box.y + r.box.height > 0.85) and r.box.width > 0.4
    )

    # If most text is at top/bottom → overlay meme
    if overlay_count >= len(translatable) * 0.6:
        return MemeType.OVERLAY

    # Many text regions spread vertically → screenshot/forum
    if len(translatable) >= 4:
        y_positions = sorted(r.box.y for r in translatable)
        y_spread = y_positions[-1] - y_positions[0]
        if y_spread > 0.4:
            return MemeType.SCREENSHOT

    # Few regions with scattered positions → could be comic
    if len(translatable) >= 3:
        return MemeType.COMIC

    return MemeType.OVERLAY


# ---------------------------------------------------------------------------
# MemeTranslator
# ---------------------------------------------------------------------------

class MemeTranslator:
    """
    AI-powered meme translation pipeline.

    Orchestrates 4 stages: OCR → Inpainting → Translation → Rendering.

    Args:
        gemini_api_key: Google Gemini API key (required)
        use_vision_api: Use Google Cloud Vision for OCR (requires credentials)
        inpaint_strategy: 'gemini' (default), 'lama', or 'opencv'
        default_font: Default font family for rendering
    """

    def __init__(
        self,
        gemini_api_key: str,
        use_vision_api: bool = False,
        inpaint_strategy: str = "gemini",
        default_font: str = "Arial",
    ):
        self.gemini_api_key = gemini_api_key
        self.use_vision_api = use_vision_api
        self.inpaint_strategy = inpaint_strategy
        self.default_font = default_font

        logger.info(
            f"MemeTranslator initialized: "
            f"ocr={'vision' if use_vision_api else 'gemini'}, "
            f"inpaint={inpaint_strategy}"
        )

    # -----------------------------------------------------------------------
    # Main pipeline
    # -----------------------------------------------------------------------

    def translate(
        self,
        image_bytes: bytes,
        source_lang: str = "ko",
        target_lang: str = "en",
        meme_type: Optional[MemeType] = None,
        render_mode: Optional[RenderMode] = None,
        title_text: Optional[str] = None,
        skip_inpainting: bool = False,
        clean_image_bytes: Optional[bytes] = None,
    ) -> TranslatedMeme:
        """
        Execute the full meme translation pipeline.

        Args:
            image_bytes: Original meme image as bytes
            source_lang: Source language code (e.g., 'ko', 'ja', 'en')
            target_lang: Target language code
            meme_type: Override meme type classification
            render_mode: Override rendering mode (A=structured, B=unstructured)
            title_text: Optional title for Mode B re-authoring
            skip_inpainting: Skip inpainting stage (use original as background)
            clean_image_bytes: Pre-generated clean image (skip inpainting)

        Returns:
            TranslatedMeme with final image and metadata
        """
        total_start = time.time()
        img = Image.open(io.BytesIO(image_bytes))
        img_w, img_h = img.size
        logger.info(f"Pipeline start: {img_w}x{img_h} image, {source_lang} -> {target_lang}")

        # ==================================================================
        # Stage 1: OCR & Analysis
        # ==================================================================
        stage_start = time.time()
        logger.info("=== Stage 1: OCR & Style Extraction ===")

        if self.use_vision_api:
            regions = ocr_with_vision_api(image_bytes, img_w, img_h)
        else:
            regions = ocr_with_gemini(image_bytes, img_w, img_h, self.gemini_api_key)

        if not regions:
            logger.warning("No text regions detected — returning original image")
            return TranslatedMeme(
                translated_image_bytes=image_bytes,
                source_language=source_lang,
                target_language=target_lang,
                confidence=0.0,
            )

        # Classify meme type if not provided
        if meme_type is None:
            meme_type = _classify_meme_type(regions)

        # Determine render mode if not provided
        if render_mode is None:
            render_mode = _determine_render_mode(meme_type, regions)

        logger.info(
            f"Stage 1 complete ({time.time() - stage_start:.1f}s): "
            f"{len(regions)} regions, type={meme_type.value}, mode={render_mode.value}"
        )

        # ==================================================================
        # Stage 2: Inpainting (Background Restoration)
        # ==================================================================
        stage_start = time.time()
        logger.info("=== Stage 2: Inpainting ===")

        if clean_image_bytes:
            logger.info("Using pre-generated clean image")
        elif skip_inpainting:
            logger.info("Inpainting skipped by request")
            clean_image_bytes = None
        elif render_mode == RenderMode.STRUCTURED:
            clean_image_bytes = inpaint(
                image_bytes=image_bytes,
                regions=regions,
                image_width=img_w,
                image_height=img_h,
                api_key=self.gemini_api_key,
                strategy=self.inpaint_strategy,
                mime_type="image/png" if image_bytes[:4] == b"\x89PNG" else "image/jpeg",
            )
            if clean_image_bytes:
                logger.info(f"Stage 2 complete ({time.time() - stage_start:.1f}s): clean image generated")
            else:
                logger.warning("Inpainting failed — will fall back to Mode B")
                render_mode = RenderMode.UNSTRUCTURED
        else:
            logger.info("Mode B selected — inpainting not needed")
            clean_image_bytes = None

        # ==================================================================
        # Stage 3: Translation
        # ==================================================================
        stage_start = time.time()
        logger.info("=== Stage 3: Transcendent Translation ===")

        segments, culture_note, confidence = translate_regions(
            regions=regions,
            source_lang=source_lang,
            target_lang=target_lang,
            meme_type=meme_type,
            api_key=self.gemini_api_key,
        )

        logger.info(
            f"Stage 3 complete ({time.time() - stage_start:.1f}s): "
            f"{len(segments)} segments, confidence={confidence}"
        )

        # ==================================================================
        # Stage 4: Rendering & Synthesis
        # ==================================================================
        stage_start = time.time()
        logger.info(f"=== Stage 4: Rendering (Mode {'A' if render_mode == RenderMode.STRUCTURED else 'B'}) ===")

        final_image_bytes = render(
            clean_image_bytes=clean_image_bytes,
            original_image_bytes=image_bytes,
            segments=segments,
            mode=render_mode,
            meme_type=meme_type,
            title_text=title_text,
        )

        logger.info(f"Stage 4 complete ({time.time() - stage_start:.1f}s)")

        total_time = time.time() - total_start
        logger.info(
            f"Pipeline complete in {total_time:.1f}s: "
            f"{len(final_image_bytes)} bytes output"
        )

        return TranslatedMeme(
            translated_image_bytes=final_image_bytes,
            clean_image_bytes=clean_image_bytes,
            segments=segments,
            meme_type=meme_type,
            render_mode=render_mode,
            culture_note=culture_note,
            source_language=source_lang,
            target_language=target_lang,
            confidence=confidence,
        )

    # -----------------------------------------------------------------------
    # Convenience: translate from file path
    # -----------------------------------------------------------------------

    def translate_file(
        self,
        input_path: str,
        output_path: str,
        source_lang: str = "ko",
        target_lang: str = "en",
        **kwargs,
    ) -> TranslatedMeme:
        """
        Translate a meme image file and save the result.

        Args:
            input_path: Path to input image
            output_path: Path to save translated image
            source_lang: Source language
            target_lang: Target language
            **kwargs: Additional arguments passed to translate()

        Returns:
            TranslatedMeme result
        """
        with open(input_path, "rb") as f:
            image_bytes = f.read()

        result = self.translate(
            image_bytes=image_bytes,
            source_lang=source_lang,
            target_lang=target_lang,
            **kwargs,
        )

        if result.translated_image_bytes:
            with open(output_path, "wb") as f:
                f.write(result.translated_image_bytes)
            logger.info(f"Saved translated image to {output_path}")

        return result

    # -----------------------------------------------------------------------
    # Individual stage access (for testing / custom pipelines)
    # -----------------------------------------------------------------------

    def analyze(
        self,
        image_bytes: bytes,
    ) -> MemeAnalysis:
        """Run only Stage 1 (OCR + classification)."""
        img = Image.open(io.BytesIO(image_bytes))
        img_w, img_h = img.size

        if self.use_vision_api:
            regions = ocr_with_vision_api(image_bytes, img_w, img_h)
        else:
            regions = ocr_with_gemini(image_bytes, img_w, img_h, self.gemini_api_key)

        meme_type = _classify_meme_type(regions)
        render_mode = _determine_render_mode(meme_type, regions)

        return MemeAnalysis(
            meme_type=meme_type,
            render_mode=render_mode,
            regions=regions,
            image_width=img_w,
            image_height=img_h,
        )

    def clean(
        self,
        image_bytes: bytes,
        regions: list[TextRegion],
    ) -> Optional[bytes]:
        """Run only Stage 2 (Inpainting)."""
        img = Image.open(io.BytesIO(image_bytes))
        img_w, img_h = img.size
        mime = "image/png" if image_bytes[:4] == b"\x89PNG" else "image/jpeg"

        return inpaint(
            image_bytes=image_bytes,
            regions=regions,
            image_width=img_w,
            image_height=img_h,
            api_key=self.gemini_api_key,
            strategy=self.inpaint_strategy,
            mime_type=mime,
        )
