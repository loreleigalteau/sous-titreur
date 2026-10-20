"""Sound wave of a video, for the timeline.

The browser could compute it, but it would have to decode the whole audio
track in memory, which is heavy for long videos. Here FFmpeg streams the audio
at a low sample rate and we only keep the loudest value of each small slice
of time (a "peak"): one hour of video gives about 1.4 MB of data.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np

from app.render import find_tool

PEAKS_PER_SECOND = 100
SAMPLE_RATE = 8000  # plenty to see where speech starts and stops
SAMPLES_PER_PEAK = SAMPLE_RATE // PEAKS_PER_SECOND
CHUNK_PEAKS = 10_000  # peaks computed per read, to bound memory use


def compute_peaks(video: Path) -> list[float]:
    """Loudest value of each 1/PEAKS_PER_SECOND of a second, between 0 and 1."""
    process = subprocess.Popen(
        [
            find_tool("ffmpeg"), "-nostdin", "-hide_banner", "-loglevel", "error",
            "-i", str(video), "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),
            "-f", "s16le", "-",  # raw 16-bit samples on the standard output
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    assert process.stdout is not None
    chunks = []
    chunk_bytes = SAMPLES_PER_PEAK * CHUNK_PEAKS * 2
    while data := process.stdout.read(chunk_bytes):
        samples = np.abs(np.frombuffer(data[: len(data) // 2 * 2], dtype=np.int16).astype(np.int32))
        # Pad the last slice to a whole peak, then take the maximum of each slice.
        padding = -len(samples) % SAMPLES_PER_PEAK
        samples = np.pad(samples, (0, padding))
        chunks.append(samples.reshape(-1, SAMPLES_PER_PEAK).max(axis=1))
    process.wait()  # a video without sound simply gives no peaks

    if not chunks:
        return []
    peaks = np.concatenate(chunks).astype(np.float64)
    loudest = peaks.max()
    if loudest > 0:
        peaks /= loudest  # quiet videos still fill the timeline's height
    return [round(float(p), 3) for p in peaks]


def load_peaks(video: Path, cache: Path) -> list[float]:
    """Peaks of the video, computed once then read from `cache`."""
    if cache.is_file() and cache.stat().st_mtime >= video.stat().st_mtime:
        return json.loads(cache.read_text())
    peaks = compute_peaks(video)
    cache.write_text(json.dumps(peaks))
    return peaks
