from app.ass import ass_color, escape_text, format_timestamp, segments_to_ass
from app.models import Segment, Style


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
