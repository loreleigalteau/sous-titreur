"""SRT export.

An SRT file is a list of blocks separated by a blank line:

    1
    00:00:01,000 --> 00:00:03,500
    Text of the first subtitle

    2
    ...
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from app.models import Segment


def format_timestamp(seconds: float) -> str:
    """Format seconds as an SRT timestamp: HH:MM:SS,mmm."""
    # Work in integer milliseconds to avoid rounding issues such as 59.9996 s
    # being displayed as "00:00:59,1000".
    total_ms = max(0, round(seconds * 1000))
    hours, rest = divmod(total_ms, 3_600_000)
    minutes, rest = divmod(rest, 60_000)
    secs, ms = divmod(rest, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def clean_text(text: str) -> str:
    """Normalize subtitle text.

    A blank line marks the end of a block in SRT, so empty lines inside the text
    would break the file. They are removed, as are surrounding spaces.
    """
    lines = (line.strip() for line in text.replace("\r\n", "\n").split("\n"))
    return "\n".join(line for line in lines if line)


def segments_to_srt(segments: Iterable[Segment]) -> str:
    """Build the SRT content. Empty segments are skipped and blocks renumbered."""
    blocks: list[str] = []
    for segment in segments:
        text = clean_text(segment.text)
        if not text:
            continue
        end = max(segment.end, segment.start)
        blocks.append(
            f"{len(blocks) + 1}\n"
            f"{format_timestamp(segment.start)} --> {format_timestamp(end)}\n"
            f"{text}\n"
        )
    return "\n".join(blocks)


def write_srt(segments: Iterable[Segment], path: Path) -> None:
    # UTF-8 is what modern players expect; accents are preserved.
    path.write_text(segments_to_srt(segments), encoding="utf-8")
