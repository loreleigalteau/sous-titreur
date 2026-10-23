"""Word by word: what is on screen at each moment of a subtitle.

A subtitle is cut into "frames": the words shown (all of them, or a few at a
time), and which one is being spoken. Used by the ASS export. The interface
has the same logic for the preview and the video export
(frontend/src/karaoke.ts): keep both in line.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models import Segment, Style


@dataclass
class TimedWord:
    text: str
    start: float
    end: float


@dataclass
class Frame:
    start: float
    end: float
    words: list[str]  # the words on screen
    highlight: int  # index of the spoken word in `words`, -1 for none


def word_times(segment: Segment) -> list[TimedWord]:
    """The words of a subtitle with their times.

    Whisper's timings are used while they still match the text; after an
    edit, times are estimated from the position of each word in the text.
    """
    text = segment.text.strip()
    parts = text.split()
    if len(parts) == len(segment.words):
        return [TimedWord(p, w.start, w.end) for p, w in zip(parts, segment.words)]
    duration = max(segment.end - segment.start, 0.0)
    total = max(len(text), 1)
    words, position = [], 0
    for part in parts:
        begin = text.index(part, position)
        position = begin + len(part)
        words.append(
            TimedWord(part, segment.start + duration * begin / total, segment.start + duration * position / total)
        )
    return words


def subtitle_frames(segment: Segment, style: Style) -> list[Frame]:
    """The frames of a subtitle, in time order, covering it from start to end."""
    words = word_times(segment)
    if not words:
        return []
    size = style.max_words if style.max_words > 0 else len(words)
    groups = [words[i:i + size] for i in range(0, len(words), size)]

    frames = []
    for g, group in enumerate(groups):
        # A group stays until the next one starts: no blank screen in a short pause.
        group_start = segment.start if g == 0 else group[0].start
        group_end = groups[g + 1][0].start if g + 1 < len(groups) else segment.end
        texts = [w.text for w in group]
        if not style.highlight:
            frames.append(Frame(group_start, group_end, texts, -1))
            continue
        for w, word in enumerate(group):
            start = group_start if w == 0 else word.start
            end = group[w + 1].start if w + 1 < len(group) else group_end
            frames.append(Frame(start, end, texts, w))
    return [f for f in frames if f.end > f.start]
