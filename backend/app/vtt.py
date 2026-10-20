"""WebVTT export.

WebVTT is the subtitle format of the web (HTML <track>). It is very close to
SRT: a "WEBVTT" header, a dot instead of a comma before the milliseconds, and
cue numbers are optional (we omit them).
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from app.models import Segment
from app.srt import clean_text, format_timestamp as format_srt_timestamp


def format_timestamp(seconds: float) -> str:
    """Format seconds as a WebVTT timestamp: HH:MM:SS.mmm."""
    return format_srt_timestamp(seconds).replace(",", ".")


def segments_to_vtt(segments: Iterable[Segment]) -> str:
    blocks = ["WEBVTT\n"]
    for segment in segments:
        # "-->" is forbidden inside a cue's text; it would be read as a timing line.
        text = clean_text(segment.text).replace("-->", "->")
        if not text:
            continue
        end = max(segment.end, segment.start)
        blocks.append(f"{format_timestamp(segment.start)} --> {format_timestamp(end)}\n{text}\n")
    return "\n".join(blocks)


def write_vtt(segments: Iterable[Segment], path: Path) -> None:
    path.write_text(segments_to_vtt(segments), encoding="utf-8")
