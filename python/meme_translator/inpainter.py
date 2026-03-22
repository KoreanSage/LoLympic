"""
Stage 2: Background Restoration (Inpainting)

Removes detected text from the image, restoring the background behind it.

Two strategies:
  1. Gemini-based (default) — uses the existing generateCleanImage approach
  2. LaMa-based (optional) — deep learning inpainting for GPU environments

Pipeline:
  Original image + list[TextRegion] -> Mask generation -> Inpainting -> Clean image
"""

from __future__ import annotations

import io
import logging
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .models import BoundingBox, TextRegion

logger = logging.getLogger(__name__)

# Padding around text regions for mask generation (fraction of image)
MASK_PADDING = 0.015


# ---------------------------------------------------------------------------
# Mask generation
# ---------------------------------------------------------------------------

def generate_mask(
    image_width: int,
    image_height: int,
    regions: list[TextRegion],
    padding: float = MASK_PADDING,
    only_translatable: bool = True,
) -> Image.Image:
    """
    Generate a binary mask image where text regions are white (255)
    and everything else is black (0).

    Only translatable regions are masked by default — UI elements
    (timestamps, reaction counts, etc.) are preserved.

    Args:
        image_width: Width of the original image in pixels
        image_height: Height of the original image in pixels
        regions: Detected text regions from OCR
        padding: Extra padding around each box (fraction of image)
        only_translatable: If True, only mask translatable regions

    Returns:
        PIL Image in mode 'L' (grayscale), same dimensions as original
    """
    mask = Image.new("L", (image_width, image_height), 0)
    draw = ImageDraw.Draw(mask)

    for region in regions:
        if only_translatable and not region.is_translatable:
            continue

        # Add padding to the bounding box
        padded = region.box.pad(padding)
        x1, y1, x2, y2 = padded.to_pixels(image_width, image_height)

        # Clamp to image bounds
        x1 = max(0, x1)
        y1 = max(0, y1)
        x2 = min(image_width, x2)
        y2 = min(image_height, y2)

        draw.rectangle([x1, y1, x2, y2], fill=255)

    # Slight blur on mask edges for smoother inpainting
    mask = mask.filter(ImageFilter.GaussianBlur(radius=2))

    # Re-threshold to binary after blur
    mask = mask.point(lambda p: 255 if p > 128 else 0)

    logger.info(
        f"Generated mask: {image_width}x{image_height}, "
        f"{sum(1 for r in regions if only_translatable and r.is_translatable or not only_translatable)} regions masked"
    )
    return mask


# ---------------------------------------------------------------------------
# Strategy 1: Gemini-based inpainting (default)
# ---------------------------------------------------------------------------

def inpaint_with_gemini(
    image_bytes: bytes,
    mime_type: str,
    api_key: str,
    mask: Optional[Image.Image] = None,
) -> Optional[bytes]:
    """
    Remove text from image using Gemini image editing.
    This mirrors the existing generateCleanImage() in the Next.js codebase.

    Args:
        image_bytes: Original image as bytes
        mime_type: MIME type (image/jpeg, image/png)
        api_key: Google Gemini API key
        mask: Optional mask image (currently unused by Gemini, but reserved)

    Returns:
        Clean image bytes with text removed, or None on failure
    """
    try:
        from google.genai import GoogleGenAI
    except ImportError:
        from google import genai as genai_module
        GoogleGenAI = genai_module.Client

    import base64

    client = GoogleGenAI(api_key=api_key)
    img_b64 = base64.b64encode(image_bytes).decode()

    prompt = """Remove ALL readable text content from this image using context-aware inpainting.

What to remove:
- All text that conveys meaning (captions, post content, comments, dialogue, labels)
- Both overlay text (bold meme captions) AND embedded text (forum posts, chat messages, tweets)
- Any watermark text

What to KEEP (do NOT remove):
- Profile pictures, avatars, icons
- UI chrome (buttons, borders, layout frames)
- Timestamps, numerical stats (likes, shares counts)
- Usernames and handles
- Background images and photos
- Logos (team logos, brand logos on clothing)

Replace each removed text area with the background that would naturally be behind it.
Keep the overall layout structure intact.
Output only the modified image."""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[{
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": img_b64}},
                ],
            }],
            config={"response_modalities": ["TEXT", "IMAGE"]},
        )

        parts = response.candidates[0].content.parts
        for part in parts:
            if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
                return base64.b64decode(part.inline_data.data)

        logger.warning("Gemini inpainting returned no image")
        return None

    except Exception as e:
        logger.error(f"Gemini inpainting failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Strategy 2: OpenCV basic inpainting (lightweight fallback)
# ---------------------------------------------------------------------------

def inpaint_with_opencv(
    image_bytes: bytes,
    mask: Image.Image,
    method: str = "telea",
) -> bytes:
    """
    Basic inpainting using OpenCV's built-in algorithms.
    Not as good as deep learning, but works offline with no GPU.

    Args:
        image_bytes: Original image as bytes
        mask: Binary mask (white = areas to inpaint)
        method: 'telea' (default) or 'ns' (Navier-Stokes)

    Returns:
        Inpainted image bytes
    """
    import cv2

    # Decode image
    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    # Convert mask to numpy
    mask_array = np.array(mask)
    if mask_array.ndim == 3:
        mask_array = mask_array[:, :, 0]

    # Ensure mask is uint8
    mask_array = mask_array.astype(np.uint8)

    # Inpaint
    flags = cv2.INPAINT_TELEA if method == "telea" else cv2.INPAINT_NS
    result = cv2.inpaint(img, mask_array, inpaintRadius=7, flags=flags)

    # Encode back to bytes
    _, buffer = cv2.imencode(".png", result)
    return buffer.tobytes()


# ---------------------------------------------------------------------------
# Strategy 3: LaMa deep learning inpainting (GPU, highest quality)
# ---------------------------------------------------------------------------

def inpaint_with_lama(
    image_bytes: bytes,
    mask: Image.Image,
) -> Optional[bytes]:
    """
    High-quality inpainting using LaMa (Large Mask Inpainting).
    Requires GPU and torch installation.

    Args:
        image_bytes: Original image as bytes
        mask: Binary mask (white = areas to inpaint)

    Returns:
        Inpainted image bytes, or None if LaMa is not available
    """
    try:
        from simple_lama_inpainting import SimpleLama
    except ImportError:
        logger.warning(
            "simple-lama-inpainting not installed. "
            "Run: pip install simple-lama-inpainting torch torchvision"
        )
        return None

    try:
        lama = SimpleLama()

        # Convert to PIL
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Ensure mask matches image size
        if mask.size != img.size:
            mask = mask.resize(img.size, Image.NEAREST)

        # Run inpainting
        result = lama(img, mask)

        # Convert back to bytes
        buf = io.BytesIO()
        result.save(buf, format="PNG")
        return buf.getvalue()

    except Exception as e:
        logger.error(f"LaMa inpainting failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Unified inpainting interface
# ---------------------------------------------------------------------------

def inpaint(
    image_bytes: bytes,
    regions: list[TextRegion],
    image_width: int,
    image_height: int,
    api_key: Optional[str] = None,
    strategy: str = "gemini",
    mime_type: str = "image/jpeg",
) -> Optional[bytes]:
    """
    Unified inpainting interface. Tries the requested strategy,
    falls back gracefully.

    Args:
        image_bytes: Original image bytes
        regions: Text regions to remove
        image_width: Image width in pixels
        image_height: Image height in pixels
        api_key: Gemini API key (required for 'gemini' strategy)
        strategy: 'gemini' (default), 'lama', or 'opencv'
        mime_type: Image MIME type

    Returns:
        Clean image bytes with text removed
    """
    # Generate mask from translatable regions only
    mask = generate_mask(image_width, image_height, regions, only_translatable=True)

    if strategy == "gemini" and api_key:
        result = inpaint_with_gemini(image_bytes, mime_type, api_key, mask)
        if result:
            return result
        logger.warning("Gemini inpainting failed, falling back to OpenCV")
        return inpaint_with_opencv(image_bytes, mask)

    elif strategy == "lama":
        result = inpaint_with_lama(image_bytes, mask)
        if result:
            return result
        logger.warning("LaMa inpainting failed, falling back to OpenCV")
        return inpaint_with_opencv(image_bytes, mask)

    else:
        return inpaint_with_opencv(image_bytes, mask)
