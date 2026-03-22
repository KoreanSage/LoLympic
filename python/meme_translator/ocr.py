"""
Stage 1: OCR & Style Extraction

Uses Google Cloud Vision API for precise text detection + bounding boxes,
then uses Gemini to classify semantic roles and extract style information.

Pipeline:
  Raw image bytes -> Vision API OCR -> Gemini style analysis -> list[TextRegion]
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

import numpy as np
from PIL import Image
import io

from .models import (
    BoundingBox,
    MemeType,
    SemanticRole,
    StyleInfo,
    TextRegion,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Color extraction helpers
# ---------------------------------------------------------------------------

def _dominant_color_in_region(
    img_array: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
) -> str:
    """
    Extract the dominant TEXT color in a bounding box region.
    Assumes text is the minority color against background.
    Uses a simple heuristic: the color that is NOT the most common is likely text.
    """
    region = img_array[y1:y2, x1:x2]
    if region.size == 0:
        return "#000000"

    # Flatten to list of RGB tuples
    pixels = region.reshape(-1, 3)
    if len(pixels) == 0:
        return "#000000"

    # Find the most common color (likely background)
    # Use k-means with k=2 to separate text vs background
    try:
        from collections import Counter
        # Quantize to reduce noise (round to nearest 16)
        quantized = (pixels // 32) * 32
        tuples = [tuple(p) for p in quantized]
        counter = Counter(tuples)

        if len(counter) < 2:
            # Monochrome region — return the color
            c = counter.most_common(1)[0][0]
            return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"

        # Background = most common, text = second most common
        bg_color = counter.most_common(1)[0][0]
        text_color = counter.most_common(2)[1][0]
        return f"#{text_color[0]:02x}{text_color[1]:02x}{text_color[2]:02x}"
    except Exception:
        return "#000000"


def _estimate_font_size(box_height_px: int, text: str) -> int:
    """Estimate font size from bounding box height and line count."""
    lines = max(1, text.count("\n") + 1)
    return max(8, int(box_height_px / lines * 0.85))


def _detect_font_weight(img_array: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> int:
    """
    Heuristic: bold text has thicker strokes = higher ratio of dark pixels.
    Returns 700 (bold) or 400 (normal).
    """
    region = img_array[y1:y2, x1:x2]
    if region.size == 0:
        return 400
    gray = np.mean(region, axis=2) if region.ndim == 3 else region
    dark_ratio = np.mean(gray < 128)
    return 700 if dark_ratio > 0.35 else 400


# ---------------------------------------------------------------------------
# Semantic role classification
# ---------------------------------------------------------------------------

# Patterns for detecting non-translatable UI elements
_USERNAME_PATTERN = re.compile(
    r"^(Anonymous|Anon|익명|匿名|गुमनाम|مجهول|Anónim)\s*\d*$", re.IGNORECASE
)
_TIMESTAMP_PATTERN = re.compile(
    r"^\d{1,2}[/:]\d{1,2}(\s+\d{1,2}:\d{2})?$|^\d{4}[-/]\d{1,2}[-/]\d{1,2}"
)
_NUMERIC_PATTERN = re.compile(r"^\d+$")
_UI_LABEL_PATTERN = re.compile(
    r"^(공감|스크랩|좋아요|댓글|Like|Save|Share|Retweet|Reply|Report|"
    r"좋아요|RT|답글|신고|リプライ|いいね|リツイート|点赞|转发|评论)\s*\d*$",
    re.IGNORECASE,
)


def classify_semantic_role(text: str, box: BoundingBox) -> tuple[SemanticRole, bool]:
    """
    Classify a text region's semantic role and translatability.

    Returns:
        (SemanticRole, is_translatable)
    """
    stripped = text.strip()

    # --- Non-translatable UI elements ---
    if _USERNAME_PATTERN.match(stripped):
        return SemanticRole.LABEL, False

    if _TIMESTAMP_PATTERN.match(stripped):
        return SemanticRole.LABEL, False

    if _NUMERIC_PATTERN.match(stripped):
        return SemanticRole.LABEL, False

    if _UI_LABEL_PATTERN.match(stripped):
        return SemanticRole.LABEL, False

    # --- Position-based heuristics ---
    # Top or bottom overlay text (Impact font style)
    if box.y < 0.15 or box.y + box.height > 0.85:
        if box.width > 0.5:  # Wide text spanning most of image
            return SemanticRole.OVERLAY, True

    # Small text at edges — likely watermark
    if box.height < 0.03 and (box.y > 0.9 or box.x > 0.8):
        return SemanticRole.WATERMARK, False

    # Default: translatable content
    return SemanticRole.OTHER, True


# ---------------------------------------------------------------------------
# Google Cloud Vision OCR
# ---------------------------------------------------------------------------

def ocr_with_vision_api(
    image_bytes: bytes,
    image_width: int,
    image_height: int,
) -> list[TextRegion]:
    """
    Run Google Cloud Vision API text detection on an image.

    Extracts:
      - Text content
      - Bounding boxes (converted to fractional coordinates)
      - Estimated style info (color, size, weight)

    Requires GOOGLE_APPLICATION_CREDENTIALS environment variable.
    """
    try:
        from google.cloud import vision
    except ImportError:
        logger.error(
            "google-cloud-vision not installed. "
            "Run: pip install google-cloud-vision"
        )
        return []

    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)

    # Use document_text_detection for better accuracy on dense text
    response = client.document_text_detection(image=image)

    if response.error.message:
        raise RuntimeError(f"Vision API error: {response.error.message}")

    img_array = np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    regions: list[TextRegion] = []

    # Process word-level annotations for precise boxes
    if not response.full_text_annotation:
        logger.warning("No text detected in image")
        return []

    for page in response.full_text_annotation.pages:
        for block in page.blocks:
            for paragraph in block.paragraphs:
                # Collect all words in this paragraph
                words = []
                para_text_parts = []
                for word in paragraph.words:
                    word_text = "".join(s.text for s in word.symbols)
                    para_text_parts.append(word_text)
                    words.append(word)

                para_text = " ".join(para_text_parts)
                if not para_text.strip():
                    continue

                # Get paragraph bounding box
                vertices = paragraph.bounding_box.vertices
                xs = [v.x for v in vertices]
                ys = [v.y for v in vertices]
                x1, x2 = min(xs), max(xs)
                y1, y2 = min(ys), max(ys)

                # Convert to fractional coordinates
                box = BoundingBox(
                    x=max(0.0, x1 / image_width),
                    y=max(0.0, y1 / image_height),
                    width=min(1.0, (x2 - x1) / image_width),
                    height=min(1.0, (y2 - y1) / image_height),
                )

                # Extract style from the image region
                text_color = _dominant_color_in_region(img_array, x1, y1, x2, y2)
                font_size = _estimate_font_size(y2 - y1, para_text)
                font_weight = _detect_font_weight(img_array, x1, y1, x2, y2)

                # Classify semantic role
                role, is_translatable = classify_semantic_role(para_text, box)

                style = StyleInfo(
                    font_size=font_size,
                    font_weight=font_weight,
                    color=text_color,
                    text_align="CENTER" if box.x > 0.2 and box.x + box.width < 0.8 else "LEFT",
                    is_uppercase=para_text == para_text.upper() and para_text != para_text.lower(),
                )

                # Confidence from Vision API
                confidence = paragraph.confidence if hasattr(paragraph, "confidence") else 0.9

                regions.append(TextRegion(
                    source_text=para_text,
                    box=box,
                    style=style,
                    semantic_role=role,
                    confidence=confidence,
                    is_translatable=is_translatable,
                ))

    logger.info(f"OCR detected {len(regions)} text regions ({sum(1 for r in regions if r.is_translatable)} translatable)")
    return regions


# ---------------------------------------------------------------------------
# Gemini-based OCR (fallback when Vision API is not available)
# ---------------------------------------------------------------------------

def ocr_with_gemini(
    image_bytes: bytes,
    image_width: int,
    image_height: int,
    api_key: str,
) -> list[TextRegion]:
    """
    Fallback OCR using Gemini vision capabilities.
    Less precise bounding boxes, but no Cloud Vision setup needed.

    Uses the same Gemini API already configured in the project.
    """
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    img_b64 = __import__("base64").b64encode(image_bytes).decode()
    mime = "image/jpeg"  # default
    # Detect PNG
    if image_bytes[:4] == b"\x89PNG":
        mime = "image/png"

    prompt = """Analyze this image and detect ALL text regions with precise bounding boxes.

For each text region, return:
1. The exact text content
2. Bounding box as fractions (0.0-1.0) relative to image dimensions
3. Style: font size estimate, weight (400/700), color (hex), alignment
4. Role: HEADLINE, CAPTION, DIALOGUE, LABEL, WATERMARK, SUBTITLE, OVERLAY, OTHER
5. Whether it should be translated (false for timestamps, numbers, UI buttons)

IMPORTANT: Distinguish between:
- Content text (post body, comments, captions) → translatable
- UI elements (like counts, share buttons, timestamps) → NOT translatable

Return JSON array only, no markdown:
[
  {
    "text": "detected text",
    "box": {"x": 0.05, "y": 0.1, "width": 0.9, "height": 0.08},
    "style": {"fontSize": 16, "fontWeight": 400, "color": "#000000", "textAlign": "LEFT"},
    "role": "OTHER",
    "translatable": true
  }
]"""

    result = model.generate_content([
        prompt,
        {"inline_data": {"mime_type": mime, "data": img_b64}},
    ])

    text = result.text.strip()
    # Strip markdown fences if present
    if text.startswith("```"):
        text = re.sub(r"^```\w*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)

    parsed = json.loads(text)
    regions: list[TextRegion] = []

    for item in parsed:
        b = item.get("box", {})
        s = item.get("style", {})
        role_str = item.get("role", "OTHER").upper()

        try:
            role = SemanticRole(role_str)
        except ValueError:
            role = SemanticRole.OTHER

        regions.append(TextRegion(
            source_text=item.get("text", ""),
            box=BoundingBox(
                x=b.get("x", 0),
                y=b.get("y", 0),
                width=b.get("width", 0.1),
                height=b.get("height", 0.05),
            ),
            style=StyleInfo(
                font_size=s.get("fontSize", 16),
                font_weight=s.get("fontWeight", 400),
                color=s.get("color", "#000000"),
                text_align=s.get("textAlign", "LEFT"),
            ),
            semantic_role=role,
            is_translatable=item.get("translatable", True),
        ))

    logger.info(f"Gemini OCR detected {len(regions)} text regions")
    return regions
