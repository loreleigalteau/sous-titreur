import wave
from pathlib import Path

import numpy as np
import pytest

from app.audio import (
    AudioExtractionError,
    build_extract_command,
    extract_audio,
    load_wav,
)


def write_wav(path: Path, samples: list[int], rate: int = 16000, channels: int = 1):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(np.array(samples, dtype=np.int16).tobytes())


def test_load_wav_returns_normalized_float32(tmp_path: Path):
    path = tmp_path / "a.wav"
    write_wav(path, [0, 16384, -32768])
    samples = load_wav(path)
    assert samples.dtype == np.float32
    assert samples.tolist() == [0.0, 0.5, -1.0]


def test_load_wav_rejects_wrong_sample_rate(tmp_path: Path):
    path = tmp_path / "a.wav"
    write_wav(path, [0, 0], rate=44100)
    with pytest.raises(AudioExtractionError):
        load_wav(path)


def test_build_extract_command_outputs_16k_mono_wav():
    command = build_extract_command("ffmpeg", Path("in.mp4"), Path("out.wav"))
    assert command[0] == "ffmpeg"
    assert command[command.index("-i") + 1] == "in.mp4"
    assert command[command.index("-ac") + 1] == "1"
    assert command[command.index("-ar") + 1] == "16000"
    assert command[-1] == "out.wav"


def test_extract_audio_missing_file(tmp_path: Path):
    with pytest.raises(AudioExtractionError):
        extract_audio(tmp_path / "missing.mp4", tmp_path / "out.wav")
