"""Export of the video with the subtitles burned in.

The subtitles are drawn by the web interface, with the same code as the
preview, as transparent PNG images the size of the video. FFmpeg then lays
them over the video at the right moments (the "overlay" filter). This works
with any FFmpeg build, and the result looks exactly like the preview.

The images are chained with FFmpeg's "concat" format: a text file listing
each image and how long it stays on screen, with a blank image in the gaps.
"""

from __future__ import annotations

import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import av

from app.ffmpeg import ffmpeg_path
from app.i18n import TranslatableError

BLANK = "blank.png"
# Picture quality of the export (x264 "constant rate factor": lower is better).
# 18 is generally considered visually lossless; each step down makes files
# about 10-15% bigger.
VIDEO_QUALITY = 18
# Sound formats that MP4 accepts as they are: they are copied without any
# loss. Others are converted to AAC.
COPYABLE_AUDIO = {"aac", "mp3"}
# Shortest duration given to an entry of the concat file.
MIN_DURATION = 0.001


class RenderError(TranslatableError):
    pass


@dataclass
class Overlay:
    image: str  # file name in the frames folder
    start: float
    end: float


@dataclass
class VideoInfo:
    width: int
    height: int
    duration: float
    audio_codec: str | None = None  # None: the video has no sound


def probe(video: Path) -> VideoInfo:
    """Displayed size, duration and sound format of a video.

    Read with PyAV (FFmpeg's libraries for Python, installed with
    faster-whisper), so the separate "ffprobe" program is not needed.
    """
    try:
        with av.open(str(video)) as container:
            stream = container.streams.video[0]
            # The rotation is only known from a decoded picture.
            frame = next(container.decode(stream))
            if container.duration:
                duration = container.duration / av.time_base
            else:
                duration = float(stream.duration * stream.time_base)
            audio = container.streams.audio[0].codec_context.name if container.streams.audio else None
    except (av.error.FFmpegError, IndexError, StopIteration, TypeError) as error:
        raise RenderError("render_failed", details=str(error)) from None
    width, height = frame.width, frame.height
    # Phones often store portrait videos as landscape plus a "rotate 90°"
    # flag; FFmpeg and browsers show them rotated, so we do the same.
    if abs(frame.rotation) % 180 == 90:
        width, height = height, width
    return VideoInfo(width, height, duration, audio)


def build_concat(overlays: list[Overlay], duration: float) -> str:
    """The concat file: each image with its duration, blanks in between."""
    lines = ["ffconcat version 1.0"]

    def add(image: str, seconds: float) -> None:
        lines.append(f"file '{image}'")
        lines.append(f"duration {max(seconds, MIN_DURATION):.3f}")

    position = 0.0
    for overlay in sorted(overlays, key=lambda o: o.start):
        start = max(overlay.start, position)  # overlapping subtitles: the later one waits
        if overlay.end <= start:
            continue
        if start > position:
            add(BLANK, start - position)
        add(overlay.image, overlay.end - start)
        position = overlay.end
    add(BLANK, duration - position)
    # The concat format ignores the duration of the last entry unless the
    # file is listed once more.
    lines.append(f"file '{BLANK}'")
    return "\n".join(lines) + "\n"


def audio_options(codec: str | None) -> list[str]:
    """Copy the sound when possible: the subtitles never change it."""
    if codec in COPYABLE_AUDIO:
        return ["-c:a", "copy"]
    return ["-c:a", "aac", "-b:a", "192k"]


def build_command(ffmpeg: str, video: Path, concat: Path, output: Path, info: VideoInfo) -> list[str]:
    filters = (
        # Scale the images to the decoded video size, in case the browser
        # reported a slightly different one.
        f"[1:v]format=rgba,scale={info.width}:{info.height}[subs];"
        "[0:v][subs]overlay=eof_action=pass:format=auto,format=yuv420p[v]"
    )
    return [
        ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(video),
        "-f", "concat", "-safe", "0", "-i", str(concat),
        "-filter_complex", filters,
        "-map", "[v]", "-map", "0:a:0?",  # the first sound track; "?": there may be none
        "-c:v", "libx264", "-preset", "medium", "-crf", str(VIDEO_QUALITY),
        *audio_options(info.audio_codec),
        "-movflags", "+faststart",  # lets players start before the whole file is read
        "-progress", "pipe:1", "-nostats",
        str(output),
    ]


def render_video(
    video: Path,
    frames_dir: Path,
    overlays: list[Overlay],
    output: Path,
    on_progress: Callable[[float], None] | None = None,
) -> None:
    """Write `output`, the video with the overlays burned in."""
    try:
        ffmpeg = ffmpeg_path()
    except TranslatableError as error:
        raise RenderError(error.key) from None
    info = probe(video)
    concat = frames_dir / "overlays.ffconcat"
    concat.write_text(build_concat(overlays, info.duration), encoding="utf-8")

    # Written under a temporary name: a failed export never leaves a broken
    # file where a good one is expected.
    partial = output.with_name(output.stem + ".partial.mp4")
    with tempfile.TemporaryFile(mode="w+") as errors:
        process = subprocess.Popen(
            build_command(ffmpeg, video, concat, partial, info),
            cwd=frames_dir, stdout=subprocess.PIPE, stderr=errors, text=True,
        )
        assert process.stdout is not None
        # FFmpeg reports its position as "out_time_us=<microseconds>" lines.
        for line in process.stdout:
            if line.startswith("out_time_us=") and on_progress and info.duration > 0:
                value = line.split("=", 1)[1].strip()
                if value.isdigit():
                    on_progress(min(int(value) / 1e6 / info.duration, 0.99))
        if process.wait() != 0:
            errors.seek(0)
            partial.unlink(missing_ok=True)
            raise RenderError("render_failed", details=errors.read().strip()[-2000:])
    partial.replace(output)
