from app.ass import ass_color, escape_text, format_timestamp, segments_to_ass
from app.models import Segment, Style, Word


def test_format_timestamp():
    assert format_timestamp(3723.456) == "1:02:03.46"
    assert format_timestamp(0) == "0:00:00.00"


def test_ass_color_is_blue_green_red_with_alpha():
    assert ass_color("#ff8000") == "&H000080FF"
    assert ass_color("#000000", opacity=0.5) == "&H80000000"


def test_escape_text():
    assert escape_text("a {b} c\\N\nd") == "a (b) c⧵N\\Nd"


def test_segments_to_ass():
    style = Style(font="Poppins", size=0.05, x=0.5, y=0.8)
    ass = segments_to_ass(
        [Segment(1, 1.0, 2.5, "Bonjour"), Segment(2, 3, 4, " ")], style, width=1080, height=1920
    )
    assert "PlayResX: 1080\nPlayResY: 1920" in ass
    assert "Style: Default,Poppins,96," in ass
    assert ass.count("Dialogue:") == 1
    assert "Dialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,{\\an5\\pos(540,1536)}Bonjour" in ass


def test_background_uses_box_border_style():
    style = Style(background=True, background_color="#112233", background_opacity=1.0)
    style_line = next(
        line for line in segments_to_ass([], style, 100, 100).splitlines() if line.startswith("Style:")
    )
    fields = style_line.split(",")
    assert fields[5] == "&H00332211"  # outline colour = box colour
    assert fields[15] == "3"  # border style 3 = box


def test_word_by_word_export():
    segment = Segment(
        1, 0.0, 2.0, "Bonjour tous",
        [Word("Bonjour", 0.0, 0.8), Word("tous", 1.0, 1.8)],
    )
    style = Style(highlight=True, highlight_color="#ffff00", highlight_scale=1.2)
    dialogues = [l for l in segments_to_ass([segment], style, 100, 100).splitlines() if l.startswith("Dialogue")]
    assert len(dialogues) == 2
    # Yellow is &H00FFFF in ASS (blue, green, red); 120 % size; back to normal after.
    assert dialogues[0].endswith("{\\1c&H00FFFF&\\fscx120\\fscy120}Bonjour{\\r} tous")
    assert dialogues[0].startswith("Dialogue: 0,0:00:00.00,0:00:01.00,")
    assert dialogues[1].endswith("Bonjour {\\1c&H00FFFF&\\fscx120\\fscy120}tous{\\r}")


def test_a_few_words_at_a_time_without_highlight():
    segment = Segment(1, 0.0, 3.0, "un deux trois", [Word("un", 0, 1), Word("deux", 1, 2), Word("trois", 2, 3)])
    ass = segments_to_ass([segment], Style(max_words=2), 100, 100)
    texts = [l.rsplit("}", 1)[-1] for l in ass.splitlines() if l.startswith("Dialogue")]
    assert texts == ["un deux", "trois"]
