"""Command-line interface.

Usage:
    python -m app.cli video.mp4 --model small --lang fr [--ui-lang en]
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from app.audio import AudioExtractionError, extract_audio
from app.i18n import LANGUAGES, detect_language, set_language, t
from app.models import MODEL_SIZES
from app.segmentation import split_segments
from app.srt import write_srt
from app.transcribe import transcribe


def read_ui_language(argv: list[str] | None) -> str | None:
    """Read --ui-lang alone, before the full parser is built.

    The help texts of the full parser are translated, so the interface
    language must be known first.
    """
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--ui-lang", choices=LANGUAGES)
    known, _ = parser.parse_known_args(argv)
    return known.ui_lang


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=t("cli_description"))
    parser.add_argument("video", type=Path, help=t("cli_help_video"))
    parser.add_argument(
        "--model", choices=MODEL_SIZES, default="small", help=t("cli_help_model")
    )
    parser.add_argument("--lang", default=None, help=t("cli_help_lang"))
    parser.add_argument("--max-chars", type=int, default=None, help=t("cli_help_max_chars"))
    parser.add_argument("--ui-lang", choices=LANGUAGES, help=t("cli_help_ui_lang"))
    parser.add_argument(
        "-o", "--output", type=Path, default=None, help=t("cli_help_output")
    )
    return parser.parse_args(argv)


STATUS_MESSAGES = {
    "downloading": "model_downloading",
    "loading": "model_loading",
    "transcribing": "transcribing",
}


def print_status(status: str, model: str) -> None:
    print(t(STATUS_MESSAGES[status], model=model), file=sys.stderr)


class ProgressPrinter:
    """Print progress on a single line, only when the percentage changes."""

    def __init__(self) -> None:
        self.last = -1

    def __call__(self, fraction: float) -> None:
        percent = int(fraction * 100)
        if percent != self.last:
            self.last = percent
            print("\r" + t("progress", percent=percent), end="", file=sys.stderr)
            if percent >= 100:
                print(file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    set_language(read_ui_language(argv) or detect_language())
    args = parse_args(argv)
    output = args.output or args.video.with_suffix(".srt")

    try:
        # The temporary WAV file is deleted automatically at the end.
        with tempfile.TemporaryDirectory(prefix="sous-titreur-") as tmp:
            print(t("extracting_audio"), file=sys.stderr)
            audio = extract_audio(args.video, Path(tmp) / "audio.wav")

            segments, language, probability = transcribe(
                audio,
                model_size=args.model,
                language=args.lang,
                on_progress=ProgressPrinter(),
                on_status=print_status,
            )
    except AudioExtractionError as error:
        print(error, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\n" + t("interrupted"), file=sys.stderr)
        return 130

    if args.max_chars:
        segments = split_segments(segments, args.max_chars)
    if args.lang is None:
        print(t("language_detected", language=language, probability=probability), file=sys.stderr)
    write_srt(segments, output)
    print(t("done", path=output, count=len(segments)), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
