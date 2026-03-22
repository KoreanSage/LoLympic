"""
CLI entry point for MemeTranslator.

Usage:
    # Run the FastAPI server
    python -m meme_translator server

    # Translate a single image
    python -m meme_translator translate input.jpg output.png --from ko --to en

    # Analyze an image (OCR only)
    python -m meme_translator analyze input.jpg
"""

import argparse
import json
import logging
import os
import sys


def main():
    parser = argparse.ArgumentParser(
        prog="meme_translator",
        description="LoLympic AI Meme Translation Pipeline",
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # --- server ---
    server_parser = subparsers.add_parser("server", help="Start the FastAPI server")
    server_parser.add_argument("--port", type=int, default=8100)

    # --- translate ---
    translate_parser = subparsers.add_parser("translate", help="Translate a meme image")
    translate_parser.add_argument("input", help="Input image path")
    translate_parser.add_argument("output", help="Output image path")
    translate_parser.add_argument("--from", dest="source_lang", default="ko")
    translate_parser.add_argument("--to", dest="target_lang", default="en")
    translate_parser.add_argument("--type", choices=["A", "B", "C"], help="Force meme type")
    translate_parser.add_argument("--mode", choices=["A", "B"], help="Force render mode")
    translate_parser.add_argument("--title", help="Title text for Mode B")
    translate_parser.add_argument("--vision", action="store_true", help="Use Google Vision OCR")
    translate_parser.add_argument("--inpaint", choices=["gemini", "lama", "opencv"], default="gemini")

    # --- analyze ---
    analyze_parser = subparsers.add_parser("analyze", help="Analyze image (OCR only)")
    analyze_parser.add_argument("input", help="Input image path")
    analyze_parser.add_argument("--vision", action="store_true", help="Use Google Vision OCR")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key and args.command != "server":
        print("Error: GEMINI_API_KEY environment variable is required")
        sys.exit(1)

    if args.command == "server":
        os.environ.setdefault("MEME_TRANSLATOR_PORT", str(args.port))
        from .server import main as server_main
        server_main()

    elif args.command == "translate":
        from .translator import MemeTranslator
        from .models import MemeType, RenderMode

        translator = MemeTranslator(
            gemini_api_key=api_key,
            use_vision_api=args.vision,
            inpaint_strategy=args.inpaint,
        )

        meme_type = MemeType(args.type) if args.type else None
        render_mode = RenderMode(args.mode) if args.mode else None

        result = translator.translate_file(
            input_path=args.input,
            output_path=args.output,
            source_lang=args.source_lang,
            target_lang=args.target_lang,
            meme_type=meme_type,
            render_mode=render_mode,
            title_text=args.title,
        )

        print(f"\n{'='*50}")
        print(f"Meme Type:   {result.meme_type.value}")
        print(f"Render Mode: {'Structured' if result.render_mode == RenderMode.STRUCTURED else 'Unstructured'}")
        print(f"Confidence:  {result.confidence:.0%}")
        print(f"Segments:    {len(result.segments)}")
        if result.culture_note:
            print(f"\nCulture Note:")
            print(f"  {result.culture_note.summary}")
        print(f"\nSaved to: {args.output}")

    elif args.command == "analyze":
        from .translator import MemeTranslator

        translator = MemeTranslator(
            gemini_api_key=api_key,
            use_vision_api=args.vision,
        )

        with open(args.input, "rb") as f:
            image_bytes = f.read()

        analysis = translator.analyze(image_bytes)

        print(f"\nMeme Type:   {analysis.meme_type.value}")
        print(f"Render Mode: {analysis.render_mode.value}")
        print(f"Image Size:  {analysis.image_width}x{analysis.image_height}")
        print(f"Regions:     {len(analysis.regions)}")
        print(f"\nDetected Text Regions:")
        print(f"{'─'*60}")
        for i, r in enumerate(analysis.regions):
            status = "✅" if r.is_translatable else "⏭️ "
            print(f"  {status} [{r.semantic_role.value:>8}] \"{r.source_text[:50]}\"")
            print(f"      box=({r.box.x:.2f}, {r.box.y:.2f}, {r.box.width:.2f}, {r.box.height:.2f})")


if __name__ == "__main__":
    main()
