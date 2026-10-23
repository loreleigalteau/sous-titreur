"""Same cases as frontend/src/karaoke.test.ts: both implementations must agree."""
import pytest

from app.karaoke import subtitle_frames, word_times
from app.models import Segment, Style, Word

SEGMENT = Segment(
    1, 0.0, 4.0, "un deux trois quatre",
    [Word("un", 0.2, 0.6), Word("deux", 1, 1.5), Word("trois", 2, 2.6), Word("quatre", 3, 3.8)],
)


def frames(**style):
    return [(f.start, f.end, " ".join(f.words), f.highlight) for f in subtitle_frames(SEGMENT, Style(**style))]


def test_word_times_use_whisper_while_they_match():
    assert [w.start for w in word_times(SEGMENT)] == [0.2, 1, 2, 3]


def test_word_times_are_estimated_after_an_edit():
    edited = Segment(1, 0.0, 4.0, "aa bb", SEGMENT.words)
    words = word_times(edited)
    assert [w.text for w in words] == ["aa", "bb"]
    assert words[1].start == pytest.approx(4 * 3 / 5)
    assert words[1].end == 4


def test_whole_subtitle_by_default():
    assert frames() == [(0, 4, "un deux trois quatre", -1)]


def test_each_word_highlighted_until_the_next_one():
    assert [(s, e, h) for s, e, _, h in frames(highlight=True)] == [(0, 1, 0), (1, 2, 1), (2, 3, 2), (3, 4, 3)]


def test_a_few_words_at_a_time():
    assert frames(max_words=3) == [(0, 3, "un deux trois", -1), (3, 4, "quatre", -1)]


def test_both():
    assert [f"{t}#{h}@{s:g}" for s, _, t, h in frames(highlight=True, max_words=2)] == [
        "un deux#0@0", "un deux#1@1", "trois quatre#0@2", "trois quatre#1@3",
    ]


def test_empty_subtitle():
    assert subtitle_frames(Segment(1, 0, 1, "  "), Style(highlight=True)) == []
