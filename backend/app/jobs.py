"""Background jobs: transcription and video export.

These take from seconds to many minutes, so they run in a separate thread
and the API only reports their progress. A thread is enough here: the heavy
work happens in FFmpeg (a separate process) and in CTranslate2 (native code
that releases Python's GIL), so the web server stays responsive.

Only one job runs at a time: they all compete for the same CPU, so running
two in parallel would not finish any sooner.
"""

from __future__ import annotations

import logging
import shutil
import tempfile
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from app.audio import extract_audio
from app.i18n import TranslatableError
from app.render import Overlay, render_video
from app.segmentation import split_segments
from app.storage import ProjectStore
from app.transcribe import transcribe

logger = logging.getLogger(__name__)

TRANSCRIPTION = "transcription"
RENDER = "render"

# Statuses reported by the transcription; the interface translates them.
_STATUS_FROM_TRANSCRIBE = {
    "downloading": "downloading_model",
    "loading": "loading_model",
    "transcribing": "transcribing",
}


class JobAlreadyRunning(RuntimeError):
    pass


@dataclass
class Job:
    kind: str  # TRANSCRIPTION or RENDER
    project_id: str
    status: str
    progress: float = 0.0  # 0.0 to 1.0
    # Translation key and values of the error, when status == "error".
    error_key: str | None = None
    error_values: dict[str, str] = field(default_factory=dict)

    @property
    def running(self) -> bool:
        return self.status not in ("done", "error")


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[tuple[str, str], Job] = {}
        self._lock = threading.Lock()

    def get(self, kind: str, project_id: str) -> Job | None:
        return self._jobs.get((kind, project_id))

    def is_running(self, project_id: str) -> bool:
        return any(job.running for (_, pid), job in self._jobs.items() if pid == project_id)

    def start(self, kind: str, project_id: str, first_status: str, work: Callable[[Job], None]) -> Job:
        """Run `work(job)` in a thread. `work` updates the job's status and progress."""
        with self._lock:
            if any(job.running for job in self._jobs.values()):
                raise JobAlreadyRunning()
            job = Job(kind, project_id, first_status)
            self._jobs[(kind, project_id)] = job
        threading.Thread(target=self._run, args=(job, work), daemon=True).start()
        return job

    def _run(self, job: Job, work: Callable[[Job], None]) -> None:
        try:
            work(job)
            job.progress = 1.0
            job.status = "done"
        except TranslatableError as error:
            job.error_key, job.error_values = error.key, error.values
            job.status = "error"
        except Exception as error:  # report anything else instead of failing silently
            logger.exception("%s failed", job.kind)
            job.error_key, job.error_values = f"{job.kind}_failed", {"details": str(error)}
            job.status = "error"


def transcription_work(
    store: ProjectStore,
    model: str,
    language: str | None,
    max_chars: int | None,
    extract=extract_audio,
    transcribe_fn=transcribe,
) -> Callable[[Job], None]:
    """The work of a transcription. `extract` and `transcribe_fn` can be fakes in tests."""

    def work(job: Job) -> None:
        def on_status(status: str, _model: str) -> None:
            job.status = _STATUS_FROM_TRANSCRIBE[status]

        def on_progress(fraction: float) -> None:
            job.progress = fraction

        project = store.get(job.project_id)
        with tempfile.TemporaryDirectory(prefix="sous-titreur-") as tmp:
            audio = extract(store.video_path(project), Path(tmp) / "audio.wav")
            segments, detected, _ = transcribe_fn(
                audio, model, language, on_progress=on_progress, on_status=on_status
            )
        if max_chars:
            segments = split_segments(segments, max_chars)
        # Re-read the project in case it was changed meanwhile.
        project = store.get(job.project_id)
        project.segments = segments
        project.language = language or detected
        store.save(project)

    return work


def render_work(store: ProjectStore, overlays: list[Overlay], render_fn=render_video) -> Callable[[Job], None]:
    """The work of a video export, from overlay images already uploaded."""

    def work(job: Job) -> None:
        def on_progress(fraction: float) -> None:
            job.progress = fraction

        project = store.get(job.project_id)
        frames = store.frames_dir(project.id)
        render_fn(store.video_path(project), frames, overlays, store.export_path(project.id), on_progress)
        # The images are no longer needed once they are in the video.
        shutil.rmtree(frames, ignore_errors=True)

    return work
