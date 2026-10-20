"""Core data model shared by the CLI, the API and the exporters.

Times are always expressed in seconds (float), relative to the start of the video.

This module only uses the standard library: bootstrap.py imports it before
the dependencies are installed.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Whisper model sizes offered to the user, from fastest to most accurate.
MODEL_SIZES = ("tiny", "base", "small", "medium")


@dataclass
class Word:
    text: str
    start: float
    end: float


@dataclass
class Segment:
    id: int
    start: float
    end: float
    text: str
    # Word timings from Whisper. They are kept as-is when the text is edited
    # by hand; re-aligning them is left to the word-by-word phase.
    words: list[Word] = field(default_factory=list)


@dataclass
class Style:
    """Look and position of the subtitles, shared by all of them.

    Sizes are fractions of the video height and positions fractions of the
    video frame, so a style looks the same at any resolution, in the small
    preview as in the exported video.
    """

    font: str = "Montserrat"  # one of the bundled fonts (app/fonts.py)
    bold: bool = True
    size: float = 0.05  # font size, fraction of the video height
    text_color: str = "#ffffff"
    outline_color: str = "#000000"
    outline_width: float = 0.004  # fraction of the video height, 0 = no outline
    background: bool = False  # draw a box behind the text
    background_color: str = "#000000"
    background_opacity: float = 0.6
    highlight_color: str = "#ffd700"  # used by the word-by-word phase
    # Center of the text block, as fractions of the video width and height.
    x: float = 0.5
    y: float = 0.75
    max_width: float = 0.9  # lines wrap beyond this fraction of the video width


@dataclass
class Project:
    id: str
    name: str
    video_filename: str
    created_at: str  # ISO 8601, UTC
    # Language of the subtitles (chosen or detected), None before transcription.
    language: str | None = None
    segments: list[Segment] = field(default_factory=list)
    style: Style = field(default_factory=Style)
