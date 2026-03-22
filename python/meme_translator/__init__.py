"""
LoLympic MemeTranslator - AI-Powered Meme Translation Pipeline

Two rendering modes:
  Mode A (Structured Re-rendering): Forum posts, tweets, chat screenshots
  Mode B (Unstructured Re-authoring): Creative memes, Graduate School memes
"""

from .translator import MemeTranslator
from .models import (
    TextRegion,
    StyleInfo,
    TranslationSegment,
    MemeAnalysis,
    TranslatedMeme,
    RenderMode,
)

__all__ = [
    "MemeTranslator",
    "TextRegion",
    "StyleInfo",
    "TranslationSegment",
    "MemeAnalysis",
    "TranslatedMeme",
    "RenderMode",
]
__version__ = "1.0.0"
