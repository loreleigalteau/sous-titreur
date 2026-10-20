from app.models import Segment
from app.vtt import format_timestamp, segments_to_vtt


def test_format_timestamp_uses_a_dot():
    assert format_timestamp(3723.456) == "01:02:03.456"


def test_segments_to_vtt():
    segments = [
        Segment(id=1, start=0, end=1.5, text="Bonjour"),
        Segment(id=2, start=1.5, end=2, text="  "),
        Segment(id=3, start=2, end=3, text="A --> B"),
    ]
    assert segments_to_vtt(segments) == (
        "WEBVTT\n"
        "\n"
        "00:00:00.000 --> 00:00:01.500\n"
        "Bonjour\n"
        "\n"
        "00:00:02.000 --> 00:00:03.000\n"
        "A -> B\n"
    )


def test_segments_to_vtt_empty():
    assert segments_to_vtt([]) == "WEBVTT\n"
