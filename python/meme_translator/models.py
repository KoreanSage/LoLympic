"""
Data models for the MemeTranslator pipeline.

Each pipeline stage has clearly defined input/output structures using Pydantic.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RenderMode(str, Enum):
    """Rendering strategy for translated memes."""
    STRUCTURED = "A"        # Forum posts, tweets, chat - precise text replacement
    UNSTRUCTURED = "B"      # Creative memes - re-authoring with layout changes


class SemanticRole(str, Enum):
    """What role a text region plays in the meme."""
    HEADLINE = "HEADLINE"
    CAPTION = "CAPTION"
    DIALOGUE = "DIALOGUE"
    LABEL = "LABEL"           # UI labels, buttons, reaction counts
    WATERMARK = "WATERMARK"
    SUBTITLE = "SUBTITLE"
    OVERLAY = "OVERLAY"       # Bold meme captions (Impact font etc.)
    OTHER = "OTHER"


class MemeType(str, Enum):
    """Classification of meme format."""
    OVERLAY = "A"             # Impact font on photo
    SCREENSHOT = "B"          # Forum/chat/tweet screenshot
    COMIC = "C"               # Multi-panel comic


# ---------------------------------------------------------------------------
# Bounding Box
# ---------------------------------------------------------------------------

class BoundingBox(BaseModel):
    """
    Bounding box in FRACTIONAL coordinates (0.0 - 1.0).
    Relative to image width/height, not pixels.
    """
    x: float = Field(ge=0.0, le=1.0, description="Left edge fraction")
    y: float = Field(ge=0.0, le=1.0, description="Top edge fraction")
    width: float = Field(gt=0.0, le=1.0, description="Width fraction")
    height: float = Field(gt=0.0, le=1.0, description="Height fraction")

    def to_pixels(self, img_width: int, img_height: int) -> tuple[int, int, int, int]:
        """Convert to pixel coordinates: (x1, y1, x2, y2)."""
        x1 = int(self.x * img_width)
        y1 = int(self.y * img_height)
        x2 = int((self.x + self.width) * img_width)
        y2 = int((self.y + self.height) * img_height)
        return (x1, y1, x2, y2)

    def pad(self, padding_frac: float = 0.02) -> BoundingBox:
        """Return a padded version of this box (clamped to 0-1)."""
        return BoundingBox(
            x=max(0.0, self.x - padding_frac),
            y=max(0.0, self.y - padding_frac),
            width=min(1.0 - max(0.0, self.x - padding_frac), self.width + 2 * padding_frac),
            height=min(1.0 - max(0.0, self.y - padding_frac), self.height + 2 * padding_frac),
        )


# ---------------------------------------------------------------------------
# Style Information
# ---------------------------------------------------------------------------

class StyleInfo(BaseModel):
    """Visual style of a text region, extracted from OCR + AI analysis."""
    font_family: str = "Arial"
    font_size: int = 24                        # in pixels (estimated from bbox)
    font_weight: int = 400                     # 400=normal, 700=bold
    is_italic: bool = False
    color: str = "#000000"                     # hex color
    text_align: str = "LEFT"                   # LEFT, CENTER, RIGHT
    line_height: float = 1.3                   # multiplier
    stroke_color: Optional[str] = None         # outline (Impact memes)
    stroke_width: int = 0
    shadow_color: Optional[str] = None
    shadow_offset_x: int = 0
    shadow_offset_y: int = 0
    shadow_blur: int = 0
    is_uppercase: bool = False
    background_color: Optional[str] = None     # text highlight background


# ---------------------------------------------------------------------------
# OCR Output: TextRegion
# ---------------------------------------------------------------------------

class TextRegion(BaseModel):
    """
    A single text region detected by OCR.
    This is the OUTPUT of Stage 1 (Analysis).
    """
    source_text: str
    box: BoundingBox
    style: StyleInfo
    semantic_role: SemanticRole = SemanticRole.OTHER
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    is_translatable: bool = True               # False for UI elements, timestamps
    image_index: int = 0                       # for multi-image posts


# ---------------------------------------------------------------------------
# Translation Output: TranslationSegment
# ---------------------------------------------------------------------------

class TranslationSegment(BaseModel):
    """
    A translated text segment.
    This is the OUTPUT of Stage 3 (Translation).
    """
    source_text: str
    translated_text: str
    box: BoundingBox
    style: StyleInfo
    semantic_role: SemanticRole
    is_translatable: bool = True
    image_index: int = 0


# ---------------------------------------------------------------------------
# Culture Note
# ---------------------------------------------------------------------------

class CultureNote(BaseModel):
    """Cultural context explanation for global audiences."""
    summary: str = ""
    explanation: str = ""
    translation_note: Optional[str] = None


# ---------------------------------------------------------------------------
# Full Analysis Output
# ---------------------------------------------------------------------------

class MemeAnalysis(BaseModel):
    """
    Complete analysis of a meme image.
    OUTPUT of Stage 1 (Analysis) + Stage 3 (Translation).
    """
    meme_type: MemeType = MemeType.SCREENSHOT
    render_mode: RenderMode = RenderMode.STRUCTURED
    regions: list[TextRegion] = []
    source_language: str = "ko"
    target_language: str = "en"
    confidence: float = 0.85
    culture_note: Optional[CultureNote] = None
    image_width: int = 0
    image_height: int = 0


# ---------------------------------------------------------------------------
# Pipeline Final Output
# ---------------------------------------------------------------------------

class TranslatedMeme(BaseModel):
    """
    Final output of the entire pipeline.
    Contains the translated image bytes + metadata.
    """
    translated_image_bytes: Optional[bytes] = None
    translated_image_url: Optional[str] = None
    clean_image_bytes: Optional[bytes] = None
    clean_image_url: Optional[str] = None
    segments: list[TranslationSegment] = []
    meme_type: MemeType = MemeType.SCREENSHOT
    render_mode: RenderMode = RenderMode.STRUCTURED
    culture_note: Optional[CultureNote] = None
    source_language: str = "ko"
    target_language: str = "en"
    confidence: float = 0.85

    class Config:
        # bytes fields are not JSON-serializable by default
        json_encoders = {bytes: lambda v: f"<{len(v)} bytes>" if v else None}
