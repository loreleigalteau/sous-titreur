from app.models import Segment, Word
from app.segmentation import split_segments


def make_segment(text: str, start: float = 0.0, step: float = 0.5, gap: float = 0.0) -> Segment:
    """A segment whose words are evenly timed."""
    words, t = [], start
    for part in text.split():
        words.append(Word(part, t, t + step))
        t += step + gap
    return Segment(1, start, words[-1].end, text, words)


def texts(segments):
    return [s.text for s in segments]


def test_short_segment_is_untouched():
    segment = make_segment("Bonjour à tous")
    assert split_segments([segment], 20) == [segment]


def test_max_length_is_never_exceeded():
    segment = make_segment("un deux trois quatre cinq six")
    assert texts(split_segments([segment], 13)) == ["un deux trois", "quatre cinq", "six"]


def test_cuts_to_max_length_with_word_times():
    segment = make_segment("un deux trois quatre cinq six sept huit")
    result = split_segments([segment], 15)
    assert texts(result) == ["un deux trois", "quatre cinq six", "sept huit"]
    assert result[0].start == 0.0
    # Each piece starts with the time of its first word.
    first_word_of_second = result[1].words[0]
    assert result[1].start == first_word_of_second.start
    assert [s.id for s in result] == list(range(1, len(result) + 1))


def test_prefers_cutting_after_punctuation():
    segment = make_segment("Bonjour à tous, bienvenue dans le sous-titreur")
    assert texts(split_segments([segment], 30)) == ["Bonjour à tous,", "bienvenue dans le sous-titreur"]


def test_cuts_at_long_pauses():
    words = [Word("avant", 0, 0.5), Word("la", 0.5, 0.7), Word("pause", 2.0, 2.5), Word("après", 2.5, 3)]
    segment = Segment(1, 0, 3, "avant la pause après", words)
    # Short enough already: left whole even with a pause inside.
    assert texts(split_segments([segment], 100)) == ["avant la pause après"]
    assert texts(split_segments([segment], 19)) == ["avant la", "pause après"]


def test_tiny_last_piece_is_merged():
    segment = make_segment("aaaa bbbb cccc dddd eeeeeeee, ff")
    # The cut after the comma would leave "ff" alone: it joins the previous piece.
    assert texts(split_segments([segment], 20)) == ["aaaa bbbb cccc dddd", "eeeeeeee, ff"]


def test_small_gaps_are_closed():
    segment = make_segment("un deux trois quatre", gap=0.2)
    result = split_segments([segment], 8)
    for current, following in zip(result, result[1:]):
        assert current.end == following.start


def test_edited_text_uses_estimated_times():
    segment = make_segment("un deux trois quatre")
    segment.text = "un deux trois quatre cinq six"  # edited: words no longer match
    result = split_segments([segment], 14)
    assert " ".join(texts(result)) == segment.text
    assert result[0].start == segment.start
    assert result[-1].end == segment.end
    assert all(a.end <= b.start + 1e-9 for a, b in zip(result, result[1:]))


def test_text_without_spaces_uses_whisper_words():
    words = [Word(c, i * 0.3, i * 0.3 + 0.3) for i, c in enumerate("你好世界今天天气很好")]
    segment = Segment(1, 0, 3, "你好世界今天天气很好", words)
    result = split_segments([segment], 4)
    assert "".join(texts(result)) == segment.text
    assert all(len(s.text) <= 4 for s in result)
