"""Cutting subtitles into shorter pieces.

Whisper produces whole sentences, often too long to read on a phone. Each
subtitle is cut into pieces of at most `max_chars` characters, preferably
after punctuation or at a pause, using the timing of each word.

When the text was edited by hand and no longer matches the words Whisper
heard, times are estimated in proportion to the number of characters.
"""

from __future__ import annotations

from collections.abc import Iterable

from app.models import Segment, Word

# A cut is preferred after these characters…
BREAK_AFTER = (".", ",", "!", "?", ";", ":", "…")
# …provided the piece already has this share of the maximum length (avoids
# pieces of a single short word).
MIN_FILL_FOR_PUNCTUATION_BREAK = 0.4
# A silence this long (seconds) between two words always starts a new piece.
PAUSE = 0.8
# Gaps shorter than this between two pieces are closed, so that the subtitles
# do not flicker off and on between them.
CLOSE_GAP = 0.5


def _tokens(segment: Segment) -> tuple[list[Word], str]:
    """The pieces of text to distribute, with their times, and the separator.

    Returns words with times taken from Whisper when they still match the
    text, otherwise estimated from the character positions.
    """
    text = segment.text.strip()
    parts = text.split()
    # Languages written without spaces (Chinese, Japanese): use Whisper's words.
    if len(parts) <= 1 and len(segment.words) > 1 and "".join(w.text for w in segment.words) == text:
        return [Word(w.text, w.start, w.end) for w in segment.words], ""
    if len(parts) == len(segment.words):
        return [Word(p, w.start, w.end) for p, w in zip(parts, segment.words)], " "

    # Estimated times: each word gets a share of the duration proportional to
    # its position in the text.
    duration = max(segment.end - segment.start, 0.0)
    total = max(len(text), 1)
    words, position = [], 0
    for part in parts:
        begin = text.index(part, position)
        position = begin + len(part)
        words.append(
            Word(
                part,
                segment.start + duration * begin / total,
                segment.start + duration * position / total,
            )
        )
    return words, " "


def _split_one(segment: Segment, max_chars: int) -> list[Segment]:
    words, separator = _tokens(segment)
    if len(segment.text) <= max_chars or len(words) <= 1:
        return [segment]

    def length(group: list[Word]) -> int:
        return len(separator.join(w.text for w in group))

    groups: list[list[Word]] = []
    current: list[Word] = []
    for word in words:
        if current and (
            length(current + [word]) > max_chars or word.start - current[-1].end >= PAUSE
        ):
            groups.append(current)
            current = []
        current.append(word)
        if word.text.endswith(BREAK_AFTER) and length(current) >= max_chars * MIN_FILL_FOR_PUNCTUATION_BREAK:
            groups.append(current)
            current = []
    if current:
        groups.append(current)

    # Avoid a tiny last piece ("ok") when it fits with the previous one
    # (possible when the previous piece ended early, after punctuation).
    if len(groups) > 1 and length(groups[-1]) < max_chars * 0.25:
        if length(groups[-2] + groups[-1]) <= max_chars:
            groups[-2:] = [groups[-2] + groups[-1]]

    keep_words = bool(segment.words)
    return [
        Segment(
            id=0,  # renumbered by the caller
            start=group[0].start,
            end=group[-1].end,
            text=separator.join(w.text for w in group),
            words=list(group) if keep_words else [],
        )
        for group in groups
    ]


def split_segments(segments: Iterable[Segment], max_chars: int) -> list[Segment]:
    """Cut every subtitle longer than `max_chars`; ids are renumbered from 1."""
    pieces = [piece for segment in segments for piece in _split_one(segment, max_chars)]
    for i, piece in enumerate(pieces):
        piece.id = i + 1
        following = pieces[i + 1] if i + 1 < len(pieces) else None
        if following and 0 < following.start - piece.end < CLOSE_GAP:
            piece.end = following.start
    return pieces
