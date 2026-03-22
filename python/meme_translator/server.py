"""
FastAPI server for MemeTranslator.

Provides HTTP endpoints that the Next.js app can call to translate memes.
Runs as a separate Python process alongside the Node.js app.

Usage:
    python -m meme_translator.server

Endpoints:
    POST /translate        — Full pipeline: image → translated image
    POST /analyze          — Stage 1 only: image → text regions + classification
    POST /inpaint          — Stage 2 only: image → clean image
    GET  /health           — Health check
"""

from __future__ import annotations

import base64
import io
import logging
import os
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from .translator import MemeTranslator
from .models import MemeType, RenderMode

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
USE_VISION_API = os.environ.get("USE_VISION_API", "false").lower() == "true"
INPAINT_STRATEGY = os.environ.get("INPAINT_STRATEGY", "gemini")
PORT = int(os.environ.get("MEME_TRANSLATOR_PORT", "8100"))

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="LoLympic MemeTranslator",
    description="AI-powered meme translation pipeline",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-init translator (so we don't fail on import if key is missing)
_translator: Optional[MemeTranslator] = None


def get_translator() -> MemeTranslator:
    global _translator
    if _translator is None:
        if not GEMINI_API_KEY:
            raise HTTPException(500, "GEMINI_API_KEY not configured")
        _translator = MemeTranslator(
            gemini_api_key=GEMINI_API_KEY,
            use_vision_api=USE_VISION_API,
            inpaint_strategy=INPAINT_STRATEGY,
        )
    return _translator


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class TranslateRequest(BaseModel):
    """JSON request body for /translate endpoint."""
    image_base64: str                         # Base64-encoded image
    mime_type: str = "image/jpeg"
    source_lang: str = "ko"
    target_lang: str = "en"
    meme_type: Optional[str] = None           # "A", "B", "C"
    render_mode: Optional[str] = None         # "A" (structured), "B" (unstructured)
    title_text: Optional[str] = None
    clean_image_base64: Optional[str] = None  # Pre-generated clean image


class TranslateResponse(BaseModel):
    """JSON response from /translate endpoint."""
    translated_image_base64: str
    clean_image_base64: Optional[str] = None
    meme_type: str
    render_mode: str
    source_lang: str
    target_lang: str
    confidence: float
    segments: list[dict]
    culture_note: Optional[dict] = None
    elapsed_ms: int


class AnalyzeResponse(BaseModel):
    """JSON response from /analyze endpoint."""
    meme_type: str
    render_mode: str
    region_count: int
    translatable_count: int
    regions: list[dict]
    elapsed_ms: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "meme-translator",
        "version": "1.0.0",
        "vision_api": USE_VISION_API,
        "inpaint_strategy": INPAINT_STRATEGY,
    }


@app.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """
    Full meme translation pipeline.

    Accepts a base64-encoded image and returns the translated version.
    """
    start = time.time()
    translator = get_translator()

    try:
        image_bytes = base64.b64decode(req.image_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")

    # Parse optional overrides
    meme_type = MemeType(req.meme_type) if req.meme_type else None
    render_mode_val = RenderMode(req.render_mode) if req.render_mode else None

    clean_bytes = None
    if req.clean_image_base64:
        try:
            clean_bytes = base64.b64decode(req.clean_image_base64)
        except Exception:
            pass

    try:
        result = translator.translate(
            image_bytes=image_bytes,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            meme_type=meme_type,
            render_mode=render_mode_val,
            title_text=req.title_text,
            clean_image_bytes=clean_bytes,
        )
    except Exception as e:
        logger.error(f"Translation pipeline failed: {e}", exc_info=True)
        raise HTTPException(500, f"Translation failed: {str(e)}")

    elapsed_ms = int((time.time() - start) * 1000)

    return TranslateResponse(
        translated_image_base64=base64.b64encode(
            result.translated_image_bytes or b""
        ).decode(),
        clean_image_base64=base64.b64encode(
            result.clean_image_bytes
        ).decode() if result.clean_image_bytes else None,
        meme_type=result.meme_type.value,
        render_mode=result.render_mode.value,
        source_lang=result.source_language,
        target_lang=result.target_language,
        confidence=result.confidence,
        segments=[
            {
                "source_text": s.source_text,
                "translated_text": s.translated_text,
                "semantic_role": s.semantic_role.value,
                "is_translatable": s.is_translatable,
                "box": s.box.model_dump(),
            }
            for s in result.segments
        ],
        culture_note=result.culture_note.model_dump() if result.culture_note else None,
        elapsed_ms=elapsed_ms,
    )


@app.post("/translate/upload")
async def translate_upload(
    file: UploadFile = File(...),
    source_lang: str = Form("ko"),
    target_lang: str = Form("en"),
    meme_type: Optional[str] = Form(None),
    render_mode: Optional[str] = Form(None),
):
    """
    Translate a meme via multipart file upload.
    Returns the translated image directly as PNG.
    """
    translator = get_translator()
    image_bytes = await file.read()

    mt = MemeType(meme_type) if meme_type else None
    rm = RenderMode(render_mode) if render_mode else None

    result = translator.translate(
        image_bytes=image_bytes,
        source_lang=source_lang,
        target_lang=target_lang,
        meme_type=mt,
        render_mode=rm,
    )

    return Response(
        content=result.translated_image_bytes or b"",
        media_type="image/png",
        headers={
            "X-Meme-Type": result.meme_type.value,
            "X-Render-Mode": result.render_mode.value,
            "X-Confidence": str(result.confidence),
        },
    )


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: TranslateRequest):
    """
    Run only OCR + analysis (Stage 1).
    Useful for previewing detected text before translation.
    """
    start = time.time()
    translator = get_translator()

    try:
        image_bytes = base64.b64decode(req.image_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")

    analysis = translator.analyze(image_bytes)
    elapsed_ms = int((time.time() - start) * 1000)

    return AnalyzeResponse(
        meme_type=analysis.meme_type.value,
        render_mode=analysis.render_mode.value,
        region_count=len(analysis.regions),
        translatable_count=sum(1 for r in analysis.regions if r.is_translatable),
        regions=[
            {
                "source_text": r.source_text,
                "semantic_role": r.semantic_role.value,
                "is_translatable": r.is_translatable,
                "box": r.box.model_dump(),
                "style": {
                    "font_size": r.style.font_size,
                    "font_weight": r.style.font_weight,
                    "color": r.style.color,
                    "text_align": r.style.text_align,
                },
                "confidence": r.confidence,
            }
            for r in analysis.regions
        ],
        elapsed_ms=elapsed_ms,
    )


@app.post("/inpaint")
async def inpaint_endpoint(
    file: UploadFile = File(...),
):
    """
    Run only inpainting (Stage 2).
    Returns the clean image (text removed) as PNG.
    """
    translator = get_translator()
    image_bytes = await file.read()

    # First analyze to get regions
    analysis = translator.analyze(image_bytes)

    # Then inpaint
    clean_bytes = translator.clean(image_bytes, analysis.regions)
    if not clean_bytes:
        raise HTTPException(500, "Inpainting failed")

    return Response(content=clean_bytes, media_type="image/png")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    """Run the server."""
    import uvicorn

    logger.info(f"Starting MemeTranslator server on port {PORT}")
    uvicorn.run(
        "meme_translator.server:app",
        host="0.0.0.0",
        port=PORT,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
