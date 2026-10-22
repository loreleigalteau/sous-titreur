"""Speech-to-text with faster-whisper.

faster-whisper is a reimplementation of OpenAI Whisper on top of CTranslate2.
It is several times faster than the original on CPU and uses less memory, which
matters for a tool that must run on ordinary laptops.

The import of faster_whisper is done inside the functions so that the rest of
the application (and the tests) can be used without loading it.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Callable
from pathlib import Path

from app.audio import load_wav
from app.models import Segment, Word

# Called with a value between 0.0 and 1.0.
ProgressCallback = Callable[[float], None]
# Called with a short status key ("downloading", "loading", "transcribing")
# and the model name.
StatusCallback = Callable[[str, str], None]


def bundled_model_dir(model_size: str) -> Path | None:
    """Folder of a model shipped inside the application, if there is one.

    The packaged application (see packaging/) carries the "small" model in a
    "models" folder, so it works right away and offline. The
    SOUS_TITREUR_MODELS_DIR environment variable can point to another folder
    laid out the same way (models/<size>/model.bin…).
    """
    base = os.environ.get("SOUS_TITREUR_MODELS_DIR")
    if base is None and getattr(sys, "frozen", False):
        base = os.path.join(sys._MEIPASS, "models")  # set by PyInstaller
    if base is None:
        return None
    folder = Path(base) / model_size
    return folder if (folder / "model.bin").is_file() else None


def is_model_cached(model_size: str) -> bool:
    """Tell whether the model is on this computer (shipped or downloaded)."""
    if bundled_model_dir(model_size):
        return True
    from faster_whisper.utils import download_model

    try:
        download_model(model_size, local_files_only=True)
        return True
    except Exception:
        return False


def load_model(model_size: str, on_status: StatusCallback | None = None):
    """Load (and download on first use) a Whisper model.

    device="auto" uses an NVIDIA GPU when CUDA is available and falls back to
    the CPU otherwise. compute_type="auto" picks the fastest precision the
    device supports (typically int8 on CPU, float16 on GPU).

    A model already on the computer is loaded from the disk only
    (local_files_only): otherwise the library would ask Hugging Face for a
    newer version at every transcription, and a bad connection could make the
    transcription fail. The internet is only used to download a missing model.
    """
    from faster_whisper import WhisperModel

    cached = is_model_cached(model_size)
    if on_status is not None:
        on_status("loading" if cached else "downloading", model_size)
    bundled = bundled_model_dir(model_size)
    return WhisperModel(
        str(bundled) if bundled else model_size,
        device="auto",
        compute_type="auto",
        local_files_only=cached,
    )


def transcribe(
    audio: Path,
    model_size: str = "small",
    language: str | None = None,
    on_progress: ProgressCallback | None = None,
    on_status: StatusCallback | None = None,
) -> tuple[list[Segment], str, float]:
    """Transcribe a 16 kHz mono WAV file (see `app.audio.extract_audio`).

    Returns (segments, detected language, language probability).
    `language=None` lets Whisper detect the language.
    """
    samples = load_wav(audio)
    model = load_model(model_size, on_status)
    raw_segments, info = model.transcribe(
        samples,
        language=language,
        word_timestamps=True,
        vad_filter=True,  # skip long silences: faster and fewer hallucinations
    )
    if on_status is not None:
        on_status("transcribing", model_size)

    # `raw_segments` is a lazy generator: the actual work happens while we
    # iterate, which lets us report progress as each segment is produced.
    # Times are cast to plain floats (faster-whisper may return numpy floats,
    # which are not JSON-serializable).
    segments: list[Segment] = []
    for raw in raw_segments:
        words = [
            Word(text=w.word.strip(), start=float(w.start), end=float(w.end))
            for w in (raw.words or [])
        ]
        segments.append(
            Segment(
                id=len(segments) + 1,
                start=float(raw.start),
                end=float(raw.end),
                text=raw.text.strip(),
                words=words,
            )
        )
        if on_progress is not None and info.duration > 0:
            on_progress(min(raw.end / info.duration, 1.0))

    if on_progress is not None:
        on_progress(1.0)
    return segments, info.language, info.language_probability
