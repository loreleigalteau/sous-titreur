import shutil
import struct
import subprocess
import zlib
from pathlib import Path

import pytest

from app.render import BLANK, Overlay, audio_options, build_concat, probe, render_video

needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="FFmpeg not installed")


def write_png(path: Path, width: int, height: int, rgba: tuple[int, int, int, int]) -> None:
    """A minimal single-colour PNG, without any image library."""

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    row = b"\x00" + bytes(rgba) * width
    return path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(row * height))
        + chunk(b"IEND", b"")
    )


def test_build_concat_fills_gaps_with_blank():
    concat = build_concat(
        [Overlay("2.png", 3.0, 4.0), Overlay("1.png", 1.0, 2.5)], duration=5.0
    )
    assert concat.splitlines() == [
        "ffconcat version 1.0",
        f"file '{BLANK}'", "duration 1.000",
        "file '1.png'", "duration 1.500",
        f"file '{BLANK}'", "duration 0.500",
        "file '2.png'", "duration 1.000",
        f"file '{BLANK}'", "duration 1.000",
        f"file '{BLANK}'",
    ]


def test_build_concat_overlapping_subtitles_wait_their_turn():
    concat = build_concat([Overlay("1.png", 0.0, 2.0), Overlay("2.png", 1.0, 3.0)], duration=3.0)
    assert "file '2.png'\nduration 1.000" in concat


@needs_ffmpeg
def test_render_burns_overlay_at_the_right_time(tmp_path: Path):
    video = tmp_path / "in.mp4"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=64x48:r=25:d=2",
         "-pix_fmt", "yuv420p", str(video)],
        check=True,
    )
    frames = tmp_path / "frames"
    frames.mkdir()
    write_png(frames / BLANK, 64, 48, (0, 0, 0, 0))
    write_png(frames / "1.png", 64, 48, (255, 0, 0, 255))
    output = tmp_path / "out.mp4"
    progress = []

    render_video(video, frames, [Overlay("1.png", 0.5, 1.0)], output, progress.append)

    assert probe(output).width == 64
    assert progress and max(progress) <= 1

    def color_at(seconds: float) -> tuple[int, int, int]:
        raw = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-ss", str(seconds), "-i", str(output),
             "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            check=True, capture_output=True,
        ).stdout
        center = (24 * 64 + 32) * 3
        return tuple(raw[center:center + 3])

    def is_red(rgb):
        return rgb[0] > 200 and rgb[2] < 60

    assert not is_red(color_at(0.2))
    assert is_red(color_at(0.75))
    assert not is_red(color_at(1.5))


def test_audio_options():
    assert audio_options("aac") == ["-c:a", "copy"]
    assert audio_options("mp3") == ["-c:a", "copy"]
    assert audio_options("opus") == ["-c:a", "aac", "-b:a", "192k"]
    assert audio_options(None) == ["-c:a", "aac", "-b:a", "192k"]  # harmless without sound


def make_video_with_sound(path: Path, audio_codec: str) -> Path:
    subprocess.run(
        ["ffmpeg", "-loglevel", "error",
         "-f", "lavfi", "-i", "color=c=blue:s=64x48:r=25:d=1",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
         "-pix_fmt", "yuv420p", "-c:a", audio_codec, "-shortest", str(path)],
        check=True,
    )
    return path


def audio_fingerprint(video: Path) -> str:
    """MD5 of the compressed sound data, unchanged only if the sound was copied."""
    return subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(video), "-map", "0:a", "-c", "copy", "-f", "md5", "-"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()


def render_with_blank(video: Path, tmp_path: Path) -> Path:
    frames = tmp_path / "frames"
    frames.mkdir()
    write_png(frames / BLANK, 64, 48, (0, 0, 0, 0))
    output = tmp_path / "out.mp4"
    render_video(video, frames, [], output)
    return output


@needs_ffmpeg
def test_aac_sound_is_copied_without_any_change(tmp_path: Path):
    video = make_video_with_sound(tmp_path / "in.mp4", "aac")
    assert probe(video).audio_codec == "aac"
    output = render_with_blank(video, tmp_path)
    assert audio_fingerprint(output) == audio_fingerprint(video)


@needs_ffmpeg
def test_other_sound_formats_are_converted_to_aac(tmp_path: Path):
    video = make_video_with_sound(tmp_path / "in.mkv", "pcm_s16le")
    assert probe(video).audio_codec == "pcm_s16le"
    assert probe(render_with_blank(video, tmp_path)).audio_codec == "aac"
