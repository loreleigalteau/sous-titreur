"""Local web API, also serving the built web interface.

All routes live under /api; everything else is the interface built by Vite
(frontend/) into app/static/.
"""

from __future__ import annotations

import re
import shutil
from dataclasses import asdict
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import ClientDisconnect

from app.ass import segments_to_ass
from app.audio import extract_audio
from app.fonts import FONTS, font_path
from app.i18n import LANGUAGES, TranslatableError, translate
from app.jobs import RENDER, TRANSCRIPTION, JobAlreadyRunning, JobManager, render_work, transcription_work
from app.models import MODEL_SIZES, Project, Segment, Style
from app.presets import PresetNotFound, PresetStore
from app.render import BLANK, Overlay, probe, render_video
from app.segmentation import split_segments
from app.srt import segments_to_srt
from app.storage import ProjectNotFound, ProjectStore, safe_suffix
from app.transcribe import transcribe
from app.vtt import segments_to_vtt
from app.waveform import PEAKS_PER_SECOND, load_peaks

STATIC_DIR = Path(__file__).parent / "static"

# Requests that change data must carry this header. Browsers do not let a web
# page send a custom header to another site without that site's permission
# (CORS), and we never grant it: so another website open in the browser
# cannot drive this API, even though it runs on the user's machine.
APP_HEADER = "X-Sous-Titreur"

TEXT_EXPORTS = {
    "srt": (segments_to_srt, "application/x-subrip"),
    "vtt": (segments_to_vtt, "text/vtt"),
}
COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
FRAME_NAME_PATTERN = re.compile(rf"^(\d{{1,6}}\.png|{re.escape(BLANK)})$")
MAX_FRAME_BYTES = 50 * 1024 * 1024

FRONTEND_MISSING_PAGE = """<!doctype html>
<meta charset="utf-8"><title>Sous-titreur</title>
<p>The web interface has not been built yet. Run <code>python3 bootstrap.py</code>
from the project folder, then restart the application.</p>
"""


class TranscriptionRequest(BaseModel):
    model: str = "small"
    language: str | None = None  # None = auto-detect
    max_chars: int | None = None  # None = keep Whisper's sentences


class ContentUpdate(BaseModel):
    segments: list[Segment]
    style: Style


class SplitRequest(BaseModel):
    segments: list[Segment]
    max_chars: int


class RenderRequest(BaseModel):
    overlays: list[Overlay]


class PresetCreate(BaseModel):
    name: str
    style: Style


class PresetUpdate(BaseModel):
    name: str | None = None
    style: Style | None = None


class DefaultPreset(BaseModel):
    id: str


def project_summary(project: Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "created_at": project.created_at,
        "segment_count": len(project.segments),
    }


def check_style(style: Style) -> None:
    colors = (style.text_color, style.outline_color, style.background_color, style.highlight_color)
    if not all(COLOR_PATTERN.match(c) for c in colors):
        raise HTTPException(422, "Invalid colour")
    if style.font not in {family.name for family in FONTS}:
        raise HTTPException(422, "Unknown font")
    numbers = (style.size, style.outline_width, style.background_opacity, style.x, style.y, style.max_width)
    if not all(0 <= n <= 1 for n in numbers):
        raise HTTPException(422, "Value out of range")
    if not (1 <= style.highlight_scale <= 2 and 0 <= style.max_words <= 20):
        raise HTTPException(422, "Value out of range")


def download_headers(filename: str) -> dict[str, str]:
    # RFC 5987 encoding, so names with accents survive the download.
    return {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}


def create_app(
    store: ProjectStore,
    allowed_hosts: tuple[str, ...] = ("127.0.0.1", "localhost"),
    ui_language: str | None = None,
    extract=extract_audio,
    transcribe_fn=transcribe,
    render_fn=render_video,
    probe_fn=probe,
    presets: PresetStore | None = None,
) -> FastAPI:
    """`ui_language` is the interface language explicitly chosen at launch, if any.

    `extract`, `transcribe_fn`, `render_fn` and `probe_fn` can be replaced by
    fakes in the tests.
    """
    jobs = JobManager()
    # Kept next to the projects folder, in the application's data folder.
    presets = presets or PresetStore(store.root.parent / "presets.json")
    app = FastAPI(title="Sous-titreur", docs_url="/api/docs", openapi_url="/api/openapi.json")

    # Only answer requests addressed to this machine by name. This blocks
    # "DNS rebinding", where a malicious domain is made to point to 127.0.0.1.
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(allowed_hosts))

    @app.middleware("http")
    async def require_app_header(request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD"):
            if request.headers.get(APP_HEADER) != "1":
                return JSONResponse({"detail": "Missing application header"}, status_code=403)
        response = await call_next(request)
        path = request.url.path
        if path == "/" or path.endswith(".html"):
            # The page must always be checked for a newer version, otherwise
            # the browser keeps showing the old interface after an update.
            # The script and style files have a version in their name, so
            # they can stay in the cache.
            response.headers["Cache-Control"] = "no-cache"
        return response

    def load(project_id: str) -> Project:
        try:
            return store.get(project_id)
        except ProjectNotFound:
            raise HTTPException(404, "Project not found") from None

    def ensure_idle(project_id: str) -> None:
        if jobs.is_running(project_id):
            raise HTTPException(409, "A job is in progress for this project")

    def start_job(kind: str, project_id: str, first_status: str, work) -> dict:
        try:
            jobs.start(kind, project_id, first_status, work)
        except JobAlreadyRunning:
            raise HTTPException(409, "Another job is in progress") from None
        return {"status": "started"}

    def job_status(kind: str, project_id: str, lang: str) -> dict:
        load(project_id)
        job = jobs.get(kind, project_id)
        if job is None:
            return {"status": "idle", "progress": 0.0, "error": None}
        error = translate(lang, job.error_key, **job.error_values) if job.error_key else None
        return {"status": job.status, "progress": job.progress, "error": error}

    # --- Configuration and fonts

    @app.get("/api/config")
    def config() -> dict:
        return {
            # None lets the interface follow the browser's language.
            "ui_language": ui_language,
            "ui_languages": list(LANGUAGES),
            "model_sizes": list(MODEL_SIZES),
            "fonts": [
                {
                    "name": family.name,
                    "regular": f"/api/fonts/{family.regular}",
                    "bold": f"/api/fonts/{family.bold}" if family.bold else None,
                }
                for family in FONTS
            ],
            "default_style": asdict(Style()),
            # Shown to the user, who may want to back up or find their projects.
            "projects_dir": str(store.root),
        }

    @app.get("/api/fonts/{filename}")
    def get_font(filename: str) -> FileResponse:
        path = font_path(filename)
        if path is None:
            raise HTTPException(404, "Unknown font")
        return FileResponse(path, media_type="font/ttf")

    # --- Projects

    @app.get("/api/projects")
    def list_projects() -> list[dict]:
        return [project_summary(p) for p in store.list()]

    @app.post("/api/projects", status_code=201)
    async def create_project(request: Request, filename: str) -> Project:
        """Import a video. The request body is the raw file.

        The file is streamed to disk chunk by chunk, so even a very large video
        never sits in memory.
        """
        # New projects start with the preset chosen as default.
        project = store.create(
            Path(filename).stem or "video", safe_suffix(filename), presets.default_style()
        )
        path = store.video_path(project)
        try:
            with path.open("wb") as file:
                async for chunk in request.stream():
                    file.write(chunk)
        except ClientDisconnect:
            store.delete(project.id)  # upload cancelled: don't keep half a video
            raise
        if path.stat().st_size == 0:
            store.delete(project.id)
            raise HTTPException(400, "Empty file")
        return project

    @app.get("/api/projects/{project_id}")
    def get_project(project_id: str) -> Project:
        return load(project_id)

    @app.delete("/api/projects/{project_id}", status_code=204)
    def delete_project(project_id: str) -> None:
        load(project_id)
        ensure_idle(project_id)
        store.delete(project_id)

    @app.put("/api/projects/{project_id}/content")
    def save_content(project_id: str, body: ContentUpdate) -> dict:
        """Save the subtitles and their style."""
        project = load(project_id)
        transcription = jobs.get(TRANSCRIPTION, project_id)
        if transcription and transcription.running:
            # It would overwrite these edits when it finishes.
            raise HTTPException(409, "Transcription in progress")
        check_style(body.style)
        project.segments = body.segments
        project.style = body.style
        store.save(project)
        return {"segment_count": len(body.segments)}

    @app.get("/api/projects/{project_id}/video")
    def get_video(project_id: str) -> FileResponse:
        # FileResponse supports HTTP range requests, which the browser's video
        # player uses to seek without downloading the whole file.
        return FileResponse(store.video_path(load(project_id)))

    @app.get("/api/projects/{project_id}/waveform")
    def waveform(project_id: str) -> dict:
        """Sound wave for the timeline (computed on first request, then cached)."""
        project = load(project_id)
        try:
            peaks = load_peaks(store.video_path(project), store.waveform_path(project_id))
        except TranslatableError as error:
            raise HTTPException(500, str(error)) from None
        return {"peaks_per_second": PEAKS_PER_SECOND, "peaks": peaks}

    @app.post("/api/segments/split")
    def split(body: SplitRequest) -> list[Segment]:
        """Cut subtitles longer than `max_chars` (does not save anything)."""
        if body.max_chars < 1:
            raise HTTPException(422, "max_chars must be positive")
        return split_segments(body.segments, body.max_chars)

    # --- Style presets

    @app.get("/api/presets")
    def list_presets() -> dict:
        return presets.listing()

    @app.post("/api/presets", status_code=201)
    def create_preset(body: PresetCreate) -> dict:
        check_style(body.style)
        try:
            return asdict(presets.create(body.name, body.style))
        except ValueError:
            raise HTTPException(422, "Invalid preset name") from None

    @app.put("/api/presets/default", status_code=204)
    def set_default_preset(body: DefaultPreset) -> None:
        try:
            presets.set_default(body.id)
        except PresetNotFound:
            raise HTTPException(404, "Preset not found") from None

    @app.put("/api/presets/{preset_id}")
    def update_preset(preset_id: str, body: PresetUpdate) -> dict:
        if body.style is not None:
            check_style(body.style)
        try:
            return asdict(presets.update(preset_id, body.name, body.style))
        except PresetNotFound:
            raise HTTPException(404, "Preset not found") from None
        except ValueError:
            raise HTTPException(422, "Invalid preset name") from None

    @app.delete("/api/presets/{preset_id}", status_code=204)
    def delete_preset(preset_id: str) -> None:
        try:
            presets.delete(preset_id)
        except PresetNotFound:
            raise HTTPException(404, "Preset not found") from None

    # --- Transcription

    @app.post("/api/projects/{project_id}/transcription", status_code=202)
    def start_transcription(project_id: str, body: TranscriptionRequest) -> dict:
        load(project_id)
        if body.model not in MODEL_SIZES:
            raise HTTPException(422, "Unknown model")
        work = transcription_work(
            store, body.model, body.language or None, body.max_chars, extract, transcribe_fn
        )
        return start_job(TRANSCRIPTION, project_id, "extracting", work)

    @app.get("/api/projects/{project_id}/transcription")
    def transcription_status(project_id: str, lang: str = "en") -> dict:
        """Progress of the transcription. `lang` is the language of the error message."""
        return job_status(TRANSCRIPTION, project_id, lang)

    # --- Video export with burned-in subtitles
    #
    # 1. DELETE .../render/frames      start from an empty folder
    # 2. PUT .../render/frames/<name>  upload each subtitle image (and blank.png)
    # 3. POST .../render               start the export with the timings
    # 4. GET .../render                follow the progress
    # 5. GET .../render/file           download the video

    @app.delete("/api/projects/{project_id}/render/frames", status_code=204)
    def clear_frames(project_id: str) -> None:
        load(project_id)
        ensure_idle(project_id)
        shutil.rmtree(store.frames_dir(project_id), ignore_errors=True)
        store.frames_dir(project_id).mkdir()

    @app.put("/api/projects/{project_id}/render/frames/{name}", status_code=204)
    async def upload_frame(project_id: str, name: str, request: Request) -> None:
        load(project_id)
        if not FRAME_NAME_PATTERN.match(name):
            raise HTTPException(422, "Invalid frame name")
        data = await request.body()
        if not data or len(data) > MAX_FRAME_BYTES:
            raise HTTPException(422, "Invalid frame")
        frames = store.frames_dir(project_id)
        frames.mkdir(exist_ok=True)
        (frames / name).write_bytes(data)

    @app.post("/api/projects/{project_id}/render", status_code=202)
    def start_render(project_id: str, body: RenderRequest) -> dict:
        load(project_id)
        frames = store.frames_dir(project_id)
        needed = {o.image for o in body.overlays} | {BLANK}
        if not all(FRAME_NAME_PATTERN.match(n) and (frames / n).is_file() for n in needed):
            raise HTTPException(422, "Missing frames")
        return start_job(RENDER, project_id, "rendering", render_work(store, body.overlays, render_fn))

    @app.get("/api/projects/{project_id}/render")
    def render_status(project_id: str, lang: str = "en") -> dict:
        return job_status(RENDER, project_id, lang)

    @app.get("/api/projects/{project_id}/render/file")
    def render_file(project_id: str) -> FileResponse:
        project = load(project_id)
        path = store.export_path(project_id)
        if not path.is_file():
            raise HTTPException(404, "No exported video")
        return FileResponse(
            path, media_type="video/mp4", headers=download_headers(f"{project.name}-subtitled.mp4")
        )

    # --- Subtitle files

    @app.get("/api/projects/{project_id}/export/{fmt}")
    def export(project_id: str, fmt: str, lang: str = "en") -> Response:
        project = load(project_id)
        if fmt in TEXT_EXPORTS:
            build, media_type = TEXT_EXPORTS[fmt]
            content = build(project.segments)
        elif fmt == "ass":
            # ASS positions are in pixels: it needs the video size.
            try:
                info = probe_fn(store.video_path(project))
            except TranslatableError as error:
                raise HTTPException(500, translate(lang, error.key, **error.values)) from None
            content = segments_to_ass(project.segments, project.style, info.width, info.height)
            media_type = "text/x-ssa"
        else:
            raise HTTPException(404, "Unknown format")
        return Response(
            content,
            media_type=f"{media_type}; charset=utf-8",
            headers=download_headers(f"{project.name}.{fmt}"),
        )

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon() -> FileResponse:
        # Browsers ask for this address on their own, whatever the page says.
        icon = STATIC_DIR / "favicon-32.png"
        if not icon.is_file():
            raise HTTPException(404, "No icon")
        return FileResponse(icon, media_type="image/png")

    if (STATIC_DIR / "index.html").is_file():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    else:
        @app.get("/", include_in_schema=False)
        def frontend_missing() -> HTMLResponse:
            return HTMLResponse(FRONTEND_MISSING_PAGE)

    return app
