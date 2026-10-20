import shutil
import subprocess
from pathlib import Path

import pytest

from app.waveform import PEAKS_PER_SECOND, compute_peaks, load_peaks

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="FFmpeg not installed")


def make_video(path: Path, with_sound: bool = True) -> Path:
    """2 s of video: silence for 1 s, then a tone for 1 s."""
    command = ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=32x32:r=10:d=2"]
    if with_sound:
        command += [
            "-f", "lavfi", "-i",
            "aevalsrc='if(gte(t,1),0.5*sin(2*PI*440*t),0)':s=44100:d=2",
            "-shortest",
        ]
    subprocess.run([*command, "-pix_fmt", "yuv420p", str(path)], check=True)
    return path


def test_peaks_follow_the_sound(tmp_path: Path):
    peaks = compute_peaks(make_video(tmp_path / "v.mp4"))
    assert abs(len(peaks) - 2 * PEAKS_PER_SECOND) <= 5
    assert max(peaks) == 1.0  # normalised
    silent, loud = peaks[10:90], peaks[110:190]
    assert max(silent) < 0.05
    assert min(loud) > 0.8


def test_video_without_sound(tmp_path: Path):
    assert compute_peaks(make_video(tmp_path / "v.mp4", with_sound=False)) == []


def test_peaks_are_cached(tmp_path: Path):
    video = make_video(tmp_path / "v.mp4")
    cache = tmp_path / "waveform.json"
    first = load_peaks(video, cache)
    assert cache.is_file()
    cache.write_text("[0.5]")  # proves the next call reads the cache
    assert load_peaks(video, cache) == [0.5]
    assert first
