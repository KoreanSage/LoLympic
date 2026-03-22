"""
Stage 4: Text Rendering & Synthesis

Two rendering modes:

  Mode A (Structured Re-rendering):
    Clean image + translated segments → precise text placement with dynamic font scaling.
    Perfect for forum posts, tweets, chat screenshots.

  Mode B (Unstructured Re-authoring):
    Original image → creative re-composition with new layout.
    For memes that need editorial redesign (Graduate School meme, etc.)

Pipeline:
  Clean image + list[TranslationSegment] -> Render mode selection -> Final composite
"""

from __future__ import annotations

import io
import logging
import os
import textwrap
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

from .models import (
    BoundingBox,
    MemeType,
    RenderMode,
    SemanticRole,
    StyleInfo,
    TranslationSegment,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Font management
# ---------------------------------------------------------------------------

# Default font paths by platform (expandable)
_FONT_SEARCH_PATHS = [
    # Project fonts
    Path(__file__).parent.parent / "fonts",
    # macOS
    Path("/System/Library/Fonts"),
    Path("/Library/Fonts"),
    Path.home() / "Library/Fonts",
    # Linux
    Path("/usr/share/fonts"),
    Path("/usr/local/share/fonts"),
    # Windows
    Path("C:/Windows/Fonts"),
]

# Font family → filename mappings
_FONT_MAP: dict[str, str] = {
    "arial": "Arial.ttf",
    "impact": "Impact.ttf",
    "helvetica": "Helvetica.ttf",
    "noto sans": "NotoSans-Regular.ttf",
    "noto sans kr": "NotoSansKR-Regular.ttf",
    "noto sans jp": "NotoSansJP-Regular.ttf",
    "noto sans cjk": "NotoSansCJK-Regular.ttc",
    "malgun gothic": "malgun.ttf",
    "apple sd gothic neo": "AppleSDGothicNeo.ttc",
}

_BOLD_SUFFIX_MAP: dict[str, str] = {
    "Arial.ttf": "Arial Bold.ttf",
    "NotoSans-Regular.ttf": "NotoSans-Bold.ttf",
    "NotoSansKR-Regular.ttf": "NotoSansKR-Bold.ttf",
}

_font_cache: dict[str, ImageFont.FreeTypeFont] = {}


def _find_font_file(family: str, bold: bool = False) -> Optional[str]:
    """Search for a font file matching the requested family."""
    key = family.lower().strip()
    filename = _FONT_MAP.get(key)

    if filename and bold:
        filename = _BOLD_SUFFIX_MAP.get(filename, filename)

    if not filename:
        # Try direct filename match
        filename = family if "." in family else f"{family}.ttf"

    for search_dir in _FONT_SEARCH_PATHS:
        if not search_dir.exists():
            continue
        # Direct path
        candidate = search_dir / filename
        if candidate.exists():
            return str(candidate)
        # Recursive search (limited depth)
        for path in search_dir.rglob(filename):
            return str(path)

    return None


def get_font(
    family: str = "Arial",
    size: int = 24,
    bold: bool = False,
) -> ImageFont.FreeTypeFont:
    """
    Load a TrueType font, with caching.
    Falls back to default font if requested font is not found.
    """
    cache_key = f"{family}:{size}:{bold}"
    if cache_key in _font_cache:
        return _font_cache[cache_key]

    font_path = _find_font_file(family, bold)

    if font_path:
        try:
            font = ImageFont.truetype(font_path, size)
            _font_cache[cache_key] = font
            return font
        except Exception as e:
            logger.warning(f"Failed to load font {font_path}: {e}")

    # Fallback: try common system fonts
    for fallback in ["Arial", "Helvetica", "DejaVuSans", "NotoSans-Regular"]:
        fb_path = _find_font_file(fallback, bold)
        if fb_path:
            try:
                font = ImageFont.truetype(fb_path, size)
                _font_cache[cache_key] = font
                return font
            except Exception:
                continue

    # Last resort: PIL default font (bitmap, no scaling)
    logger.warning(f"No TrueType font found for '{family}', using default bitmap font")
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Dynamic font scaling
# ---------------------------------------------------------------------------

def calculate_fitted_font_size(
    text: str,
    box_width_px: int,
    box_height_px: int,
    font_family: str,
    initial_size: int,
    bold: bool = False,
    min_size: int = 8,
    line_height: float = 1.3,
) -> tuple[int, list[str]]:
    """
    Dynamically calculate the largest font size that fits the text
    within the given bounding box.

    Uses binary search for efficiency.

    Args:
        text: The text to render
        box_width_px: Available width in pixels
        box_height_px: Available height in pixels
        font_family: Font family name
        initial_size: Starting font size (from original text)
        bold: Whether to use bold variant
        min_size: Minimum acceptable font size
        line_height: Line height multiplier

    Returns:
        (optimal_font_size, wrapped_lines)
    """
    # Binary search for optimal size
    lo, hi = min_size, initial_size
    best_size = min_size
    best_lines: list[str] = [text]

    while lo <= hi:
        mid = (lo + hi) // 2
        font = get_font(font_family, mid, bold)

        # Calculate wrap width
        lines = _wrap_text(text, font, box_width_px)
        total_height = len(lines) * mid * line_height

        if total_height <= box_height_px:
            # Check that all lines fit width-wise
            all_fit = all(
                _text_width(font, line) <= box_width_px
                for line in lines
            )
            if all_fit:
                best_size = mid
                best_lines = lines
                lo = mid + 1
            else:
                hi = mid - 1
        else:
            hi = mid - 1

    return best_size, best_lines


def _text_width(font: ImageFont.FreeTypeFont, text: str) -> int:
    """Get text width using the font's getbbox."""
    try:
        bbox = font.getbbox(text)
        return bbox[2] - bbox[0]
    except Exception:
        return len(text) * font.size


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """
    Word-wrap text to fit within max_width pixels.
    Handles CJK characters (no spaces between words).
    """
    # For CJK text, wrap character by character
    has_cjk = any("\u4e00" <= c <= "\u9fff" or "\uac00" <= c <= "\ud7af" or
                  "\u3040" <= c <= "\u309f" or "\u30a0" <= c <= "\u30ff"
                  for c in text)

    if has_cjk:
        return _wrap_cjk(text, font, max_width)

    # For Latin text, use word-based wrapping
    words = text.split()
    lines: list[str] = []
    current_line = ""

    for word in words:
        test = f"{current_line} {word}".strip()
        if _text_width(font, test) <= max_width:
            current_line = test
        else:
            if current_line:
                lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines or [text]


def _wrap_cjk(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Character-by-character wrapping for CJK text."""
    lines: list[str] = []
    current = ""

    for char in text:
        test = current + char
        if _text_width(font, test) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = char

    if current:
        lines.append(current)

    return lines or [text]


# ---------------------------------------------------------------------------
# Color parsing
# ---------------------------------------------------------------------------

def _parse_color(color_str: str) -> tuple[int, ...]:
    """Parse hex color or rgba() to tuple."""
    if color_str.startswith("#"):
        h = color_str.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) == 6:
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
        if len(h) == 8:
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4, 6))
    if color_str.startswith("rgba"):
        nums = [float(x) for x in color_str.strip("rgba()").split(",")]
        return (int(nums[0]), int(nums[1]), int(nums[2]), int(nums[3] * 255))
    if color_str.startswith("rgb"):
        nums = [int(x) for x in color_str.strip("rgb()").split(",")]
        return tuple(nums)
    return (0, 0, 0)


# ---------------------------------------------------------------------------
# Mode A: Structured Re-rendering
# ---------------------------------------------------------------------------

def render_structured(
    clean_image: Image.Image,
    segments: list[TranslationSegment],
) -> Image.Image:
    """
    Mode A: Precise text replacement on clean (inpainted) background.

    For each translatable segment:
      1. Calculate optimal font size to fit the bounding box
      2. Render translated text at the exact original position
      3. Apply original styling (color, weight, alignment, stroke)

    Non-translatable segments (UI labels, timestamps) are left as-is
    since they were preserved during inpainting.

    Args:
        clean_image: Background image with text removed
        segments: Translated text segments with positioning info

    Returns:
        Composite image with translated text rendered
    """
    img = clean_image.copy().convert("RGBA")
    img_w, img_h = img.size

    # Create transparent overlay for text
    text_layer = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(text_layer)

    for seg in segments:
        if not seg.is_translatable:
            continue

        text = seg.translated_text
        if not text.strip():
            continue

        # Convert box to pixels
        x1, y1, x2, y2 = seg.box.to_pixels(img_w, img_h)
        box_w = x2 - x1
        box_h = y2 - y1

        if box_w <= 0 or box_h <= 0:
            continue

        # Dynamic font scaling
        is_bold = seg.style.font_weight >= 600
        is_uppercase = seg.style.is_uppercase
        display_text = text.upper() if is_uppercase else text

        optimal_size, wrapped_lines = calculate_fitted_font_size(
            text=display_text,
            box_width_px=box_w,
            box_height_px=box_h,
            font_family=seg.style.font_family,
            initial_size=seg.style.font_size,
            bold=is_bold,
            line_height=seg.style.line_height,
        )

        font = get_font(seg.style.font_family, optimal_size, is_bold)
        color = _parse_color(seg.style.color)

        # Render each line with alignment
        line_spacing = int(optimal_size * seg.style.line_height)
        total_text_height = len(wrapped_lines) * line_spacing
        y_offset = y1 + (box_h - total_text_height) // 2  # vertical center

        for line in wrapped_lines:
            line_w = _text_width(font, line)

            # Horizontal alignment
            if seg.style.text_align == "CENTER":
                x_offset = x1 + (box_w - line_w) // 2
            elif seg.style.text_align == "RIGHT":
                x_offset = x2 - line_w
            else:
                x_offset = x1

            # Stroke (outline) — for Impact-style memes
            if seg.style.stroke_color and seg.style.stroke_width > 0:
                stroke_color = _parse_color(seg.style.stroke_color)
                sw = seg.style.stroke_width
                for dx in range(-sw, sw + 1):
                    for dy in range(-sw, sw + 1):
                        if dx == 0 and dy == 0:
                            continue
                        draw.text(
                            (x_offset + dx, y_offset + dy),
                            line,
                            font=font,
                            fill=stroke_color,
                        )

            # Shadow
            if seg.style.shadow_color:
                shadow_color = _parse_color(seg.style.shadow_color)
                draw.text(
                    (
                        x_offset + seg.style.shadow_offset_x,
                        y_offset + seg.style.shadow_offset_y,
                    ),
                    line,
                    font=font,
                    fill=shadow_color,
                )

            # Main text
            draw.text((x_offset, y_offset), line, font=font, fill=color)
            y_offset += line_spacing

    # Composite text layer onto clean image
    result = Image.alpha_composite(img, text_layer)
    return result.convert("RGB")


# ---------------------------------------------------------------------------
# Mode B: Unstructured Re-authoring
# ---------------------------------------------------------------------------

def render_unstructured(
    original_image: Image.Image,
    segments: list[TranslationSegment],
    meme_type: MemeType = MemeType.OVERLAY,
    title_text: Optional[str] = None,
) -> Image.Image:
    """
    Mode B: Creative re-authoring with layout redesign.

    Instead of precise text replacement, this mode creates a new composite:
      - Original screenshot placed in context (e.g., smaller, as a quote)
      - New title/header added
      - Translated text rendered in a clean, modern layout
      - Cultural adaptation reflected in the design

    Example: "Graduate School" meme style
      ┌──────────────────────────┐
      │  "An Unforgivable Spell" │  ← New title
      │  ┌────────────────────┐  │
      │  │  [original image]  │  │  ← Scaled-down original
      │  └────────────────────┘  │
      │                          │
      │  Translation text here   │  ← Translated content
      │  with cultural context   │
      └──────────────────────────┘

    Args:
        original_image: The original meme image
        segments: Translated segments
        meme_type: Type of meme for layout decisions
        title_text: Optional title to display

    Returns:
        Re-authored composite image
    """
    orig_w, orig_h = original_image.size

    # --- Layout parameters ---
    PADDING = 40
    BG_COLOR = (255, 255, 255)
    TITLE_COLOR = (30, 30, 30)
    TEXT_COLOR = (50, 50, 50)
    ACCENT_COLOR = (201, 168, 76)  # Gold accent (#c9a84c)
    BORDER_COLOR = (230, 230, 230)

    # Calculate canvas size
    canvas_w = max(600, orig_w + PADDING * 2)
    # Scale original image to fit within canvas
    scale = min(1.0, (canvas_w - PADDING * 2) / orig_w)
    scaled_w = int(orig_w * scale * 0.85)  # slightly smaller
    scaled_h = int(orig_h * scale * 0.85)

    # Collect translatable text
    content_lines = [
        seg.translated_text for seg in segments
        if seg.is_translatable and seg.translated_text.strip()
    ]
    combined_text = "\n".join(content_lines)

    # Estimate text area height
    text_font = get_font("Arial", 18)
    wrapped = _wrap_text(combined_text, text_font, canvas_w - PADDING * 2)
    text_area_height = len(wrapped) * 28 + PADDING

    # Title area
    title_height = 80 if title_text else 0

    canvas_h = PADDING + title_height + scaled_h + PADDING + text_area_height + PADDING
    canvas = Image.new("RGB", (canvas_w, int(canvas_h)), BG_COLOR)
    draw = ImageDraw.Draw(canvas)

    y_cursor = PADDING

    # --- Title ---
    if title_text:
        title_font = get_font("Arial", 28, bold=True)
        title_wrapped = _wrap_text(title_text, title_font, canvas_w - PADDING * 2)
        for line in title_wrapped:
            lw = _text_width(title_font, line)
            draw.text(
                ((canvas_w - lw) // 2, y_cursor),
                line,
                font=title_font,
                fill=TITLE_COLOR,
            )
            y_cursor += 36
        y_cursor += 16

        # Accent line under title
        draw.line(
            [(PADDING, y_cursor), (canvas_w - PADDING, y_cursor)],
            fill=ACCENT_COLOR,
            width=2,
        )
        y_cursor += 16

    # --- Original image (scaled, centered, with border) ---
    scaled_img = original_image.resize((scaled_w, scaled_h), Image.LANCZOS)
    img_x = (canvas_w - scaled_w) // 2
    img_y = y_cursor

    # Draw subtle border/shadow
    shadow_offset = 4
    draw.rectangle(
        [img_x + shadow_offset, img_y + shadow_offset,
         img_x + scaled_w + shadow_offset, img_y + scaled_h + shadow_offset],
        fill=(220, 220, 220),
    )
    draw.rectangle(
        [img_x - 1, img_y - 1, img_x + scaled_w + 1, img_y + scaled_h + 1],
        outline=BORDER_COLOR,
        width=1,
    )
    canvas.paste(scaled_img, (img_x, img_y))
    y_cursor = img_y + scaled_h + PADDING

    # --- Translated text content ---
    text_font = get_font("Arial", 18)
    for line in wrapped:
        draw.text((PADDING, y_cursor), line, font=text_font, fill=TEXT_COLOR)
        y_cursor += 28

    # --- Footer accent line ---
    y_cursor += 8
    draw.line(
        [(PADDING, y_cursor), (canvas_w - PADDING, y_cursor)],
        fill=BORDER_COLOR,
        width=1,
    )

    return canvas


# ---------------------------------------------------------------------------
# Unified render interface
# ---------------------------------------------------------------------------

def render(
    clean_image_bytes: Optional[bytes],
    original_image_bytes: bytes,
    segments: list[TranslationSegment],
    mode: RenderMode,
    meme_type: MemeType = MemeType.SCREENSHOT,
    title_text: Optional[str] = None,
) -> bytes:
    """
    Unified rendering interface.

    Args:
        clean_image_bytes: Inpainted (text-removed) image bytes (required for Mode A)
        original_image_bytes: Original image bytes (used for Mode B)
        segments: Translated segments with positioning
        mode: Rendering mode (STRUCTURED or UNSTRUCTURED)
        meme_type: Meme type classification
        title_text: Optional title for Mode B re-authoring

    Returns:
        Final composite image as PNG bytes
    """
    if mode == RenderMode.STRUCTURED and clean_image_bytes:
        clean_img = Image.open(io.BytesIO(clean_image_bytes)).convert("RGBA")
        result = render_structured(clean_img, segments)
    else:
        original_img = Image.open(io.BytesIO(original_image_bytes)).convert("RGB")
        result = render_unstructured(
            original_img, segments,
            meme_type=meme_type,
            title_text=title_text,
        )

    buf = io.BytesIO()
    result.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
