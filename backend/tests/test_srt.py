from pathlib import Path

import pytest

from app.models import Segment
from app.srt import clean_text, format_timestamp, segments_to_srt, write_srt


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [
        (0, "00:00:00,000"),
        (1.5, "00:00:01,500"),
        (61.25, "00:01:01,250"),
        (3600, "01:00:00,000"),
        (3723.456, "01:02:03,456"),
        (59.9996, "00:01:00,000"),  # rounding carries over to the next unit
        (0.0004, "00:00:00,000"),
        (-1.0, "00:00:00,000"),     # negative times are clamped
        (100 * 3600, "100:00:00,000"),
    ],
)
def test_format_timestamp(seconds, expected):
    assert format_timestamp(seconds) == expected


def test_clean_text_removes_blank_lines_and_spaces():
    assert clean_text("  Bonjour  \r\n\n  à tous ") == "Bonjour\nà tous"


def test_segments_to_srt_basic():
    segments = [
        Segment(id=1, start=0.0, end=2.5, text="Bonjour à tous."),
        Segment(id=2, start=2.5, end=5.0, text="Bienvenue !"),
    ]
    assert segments_to_srt(segments) == (
        "1\n"
        "00:00:00,000 --> 00:00:02,500\n"
        "Bonjour à tous.\n"
        "\n"
        "2\n"
        "00:00:02,500 --> 00:00:05,000\n"
        "Bienvenue !\n"
    )


def test_segments_to_srt_skips_empty_and_renumbers():
    segments = [
        Segment(id=1, start=0, end=1, text="Un"),
        Segment(id=2, start=1, end=2, text="   "),
        Segment(id=3, start=2, end=3, text="Trois"),
    ]
    srt = segments_to_srt(segments)
    assert srt.count("-->") == 2
    assert srt.endswith("\n2\n00:00:02,000 --> 00:00:03,000\nTrois\n")


def test_segments_to_srt_multiline_text():
    srt = segments_to_srt([Segment(id=1, start=0, end=1, text="Ligne 1\n\nLigne 2")])
    assert srt == "1\n00:00:00,000 --> 00:00:01,000\nLigne 1\nLigne 2\n"


def test_segments_to_srt_end_never_before_start():
    srt = segments_to_srt([Segment(id=1, start=3, end=2, text="x")])
    assert "00:00:03,000 --> 00:00:03,000" in srt


def test_segments_to_srt_empty_list():
    assert segments_to_srt([]) == ""


def test_write_srt_utf8(tmp_path: Path):
    path = tmp_path / "out.srt"
    write_srt([Segment(id=1, start=0, end=1, text="Ça marche, où ?")], path)
    assert "Ça marche, où ?" in path.read_text(encoding="utf-8")
