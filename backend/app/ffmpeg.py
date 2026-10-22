"""Where to find FFmpeg.

FFmpeg comes with the imageio-ffmpeg package, installed with the other
dependencies: a self-contained build for each system (macOS, Windows, Linux)
that includes everything we need (H.264 encoder, overlay filter). So nobody
has to install FFmpeg separately, and the packaged application carries it.

If that package is missing, an FFmpeg installed on the computer is used.
"""

from __future__ import annotations

import shutil

from app.i18n import TranslatableError


def ffmpeg_path() -> str:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # not installed, or no build for this system
        pass
    path = shutil.which("ffmpeg")
    if path is None:
        raise TranslatableError("ffmpeg_not_found")
    return path
