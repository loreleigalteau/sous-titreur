"""Audio extraction with FFmpeg.

FFmpeg is called as an external program (subprocess) rather than through Python
bindings: it is the most robust way to read any video format, and FFmpeg streams
the file, so even very large videos are never fully loaded into memory.
"""

from __future__ import annotations

import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np

from app.i18n import TranslatableError

# Whisper models expect 16 kHz mono audio.
SAMPLE_RATE = 16_000


class AudioExtractionError(TranslatableError):
    pass


def find_ffmpeg() -> str:
    """Return the path of the ffmpeg executable, or raise a friendly error."""
    path = shutil.which("ffmpeg")
    if path is None:
        raise AudioExtractionError("ffmpeg_not_found")
    return path


def build_extract_command(ffmpeg: str, video: Path, output: Path) -> list[str]:
    return [
        ffmpeg,
        "-nostdin",
        "-hide_banner",
        "-loglevel", "error",
        "-y",                      # overwrite output
        "-i", str(video),
        "-vn",                     # drop video
        "-ac", "1",                # mono
        "-ar", str(SAMPLE_RATE),   # 16 kHz
        "-c:a", "pcm_s16le",       # uncompressed WAV
        str(output),
    ]


def extract_audio(video: Path, output: Path) -> Path:
    """Extract the audio track of `video` into a 16 kHz mono WAV file."""
    if not video.is_file():
        raise AudioExtractionError("video_not_found", path=str(video))

    command = build_extract_command(find_ffmpeg(), video, output)
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise AudioExtractionError("ffmpeg_failed", details=result.stderr.strip())
    return output


def load_wav(path: Path) -> np.ndarray:
    """Read a WAV file produced by `extract_audio` as float32 samples in [-1, 1].

    We decode the WAV ourselves instead of letting faster-whisper do it: its
    decoder relies on PyAV, whose API changes between versions, while our file
    is already in the exact format Whisper expects. For scale, one hour of
    audio takes about 230 MB in memory, regardless of the video size.
    """
    with wave.open(str(path), "rb") as wav:
        if (wav.getnchannels(), wav.getframerate(), wav.getsampwidth()) != (1, SAMPLE_RATE, 2):
            raise AudioExtractionError("unexpected_wav_format")
        frames = wav.readframes(wav.getnframes())
    return np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
