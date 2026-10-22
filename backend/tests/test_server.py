import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.audio import AudioExtractionError
from app.models import Segment, Word
from app.render import VideoInfo
from app.server import APP_HEADER, create_app
from app.storage import ProjectStore

HEADERS = {APP_HEADER: "1"}


def fake_extract(video: Path, output: Path) -> Path:
    return output


def fake_transcribe(audio, model, language, on_progress, on_status):
    on_status("loading", model)
    on_status("transcribing", model)
    on_progress(0.5)
    return [Segment(1, 0.0, 1.5, "Bonjour", [Word("Bonjour", 0.0, 1.5)])], "fr", 0.99


@pytest.fixture
def store(tmp_path: Path) -> ProjectStore:
    return ProjectStore(tmp_path)


def fake_render(video, frames_dir, overlays, output, on_progress):
    on_progress(0.5)
    output.write_bytes(b"rendered:" + ",".join(o.image for o in overlays).encode())


def fake_probe(video):
    return VideoInfo(1080, 1920, 10.0)


def make_client(store, extract=fake_extract, transcribe_fn=fake_transcribe, render_fn=fake_render):
    app = create_app(
        store, extract=extract, transcribe_fn=transcribe_fn, render_fn=render_fn, probe_fn=fake_probe
    )
    return TestClient(app, base_url="http://localhost")


@pytest.fixture
def client(store) -> TestClient:
    return make_client(store)


def upload(client: TestClient, content: bytes = b"fake video", filename: str = "Clip été.mp4"):
    return client.post("/api/projects", params={"filename": filename}, content=content, headers=HEADERS)


def wait_for_job(client: TestClient, project_id: str, lang: str = "en", kind: str = "transcription") -> dict:
    for _ in range(100):
        status = client.get(f"/api/projects/{project_id}/{kind}", params={"lang": lang}).json()
        if status["status"] in ("done", "error"):
            return status
        time.sleep(0.01)
    raise AssertionError("transcription did not finish")


def test_config(client, store):
    config = client.get("/api/config").json()
    assert config["model_sizes"] == ["tiny", "base", "small", "medium"]
    assert set(config["ui_languages"]) == {"en", "fr"}
    assert config["ui_language"] is None  # not chosen at launch: follow the browser
    assert config["projects_dir"] == str(store.root)


def test_config_with_chosen_language(store):
    client = TestClient(create_app(store, ui_language="fr"), base_url="http://localhost")
    assert client.get("/api/config").json()["ui_language"] == "fr"


def test_upload_and_get_video(client, store):
    response = upload(client)
    assert response.status_code == 201
    project = response.json()
    assert project["name"] == "Clip été"
    assert project["segments"] == []

    video = client.get(f"/api/projects/{project['id']}/video")
    assert video.content == b"fake video"
    # Range requests are needed by the video player to seek.
    partial = client.get(f"/api/projects/{project['id']}/video", headers={"Range": "bytes=0-3"})
    assert partial.status_code == 206
    assert partial.content == b"fake"


def test_empty_upload_is_rejected(client, store):
    assert upload(client, content=b"").status_code == 400
    assert store.list() == []


def test_changes_require_app_header(client):
    response = client.post("/api/projects", params={"filename": "a.mp4"}, content=b"x")
    assert response.status_code == 403


def test_unknown_host_is_rejected(store):
    evil = TestClient(create_app(store), base_url="http://evil.example")
    assert evil.get("/api/projects").status_code == 400


def test_transcription_then_edit_then_export(client):
    project_id = upload(client).json()["id"]
    assert client.get(f"/api/projects/{project_id}/transcription").json()["status"] == "idle"

    response = client.post(
        f"/api/projects/{project_id}/transcription", json={"model": "tiny"}, headers=HEADERS
    )
    assert response.status_code == 202
    assert wait_for_job(client, project_id)["status"] == "done"

    project = client.get(f"/api/projects/{project_id}").json()
    assert project["language"] == "fr"
    assert project["segments"][0]["text"] == "Bonjour"

    segments = project["segments"]
    segments[0]["text"] = "Bonjour à tous"
    style = project["style"]
    style["font"] = "Poppins"
    response = client.put(
        f"/api/projects/{project_id}/content", json={"segments": segments, "style": style}, headers=HEADERS
    )
    assert response.status_code == 200
    assert client.get(f"/api/projects/{project_id}").json()["style"]["font"] == "Poppins"

    srt = client.get(f"/api/projects/{project_id}/export/srt")
    assert srt.text == "1\n00:00:00,000 --> 00:00:01,500\nBonjour à tous\n"
    assert "filename*=UTF-8''Clip%20%C3%A9t%C3%A9.srt" in srt.headers["content-disposition"]

    vtt = client.get(f"/api/projects/{project_id}/export/vtt")
    assert vtt.text.startswith("WEBVTT\n")
    assert client.get(f"/api/projects/{project_id}/export/doc").status_code == 404


def test_transcription_error_is_translated(store):
    def failing_extract(video, output):
        raise AudioExtractionError("ffmpeg_not_found")

    client = make_client(store, extract=failing_extract)
    project_id = upload(client).json()["id"]
    client.post(f"/api/projects/{project_id}/transcription", json={}, headers=HEADERS)
    status = wait_for_job(client, project_id, lang="fr")
    assert status["status"] == "error"
    assert status["error"].startswith("FFmpeg est introuvable")


def test_unexpected_transcription_error(store):
    def broken(*args, **kwargs):
        raise RuntimeError("boom")

    client = make_client(store, transcribe_fn=broken)
    project_id = upload(client).json()["id"]
    client.post(f"/api/projects/{project_id}/transcription", json={}, headers=HEADERS)
    status = wait_for_job(client, project_id)
    assert status["error"] == "The transcription failed: boom"


def test_unknown_model_is_rejected(client):
    project_id = upload(client).json()["id"]
    response = client.post(
        f"/api/projects/{project_id}/transcription", json={"model": "huge"}, headers=HEADERS
    )
    assert response.status_code == 422


def test_list_and_delete(client):
    project_id = upload(client).json()["id"]
    projects = client.get("/api/projects").json()
    assert projects[0]["id"] == project_id
    assert projects[0]["segment_count"] == 0

    assert client.delete(f"/api/projects/{project_id}", headers=HEADERS).status_code == 204
    assert client.get(f"/api/projects/{project_id}").status_code == 404


def test_unknown_project(client):
    assert client.get("/api/projects/" + "0" * 32).status_code == 404
    assert client.get("/api/projects/not-an-id").status_code == 404


def test_transcription_can_cut_long_sentences(store):
    def long_sentence(audio, model, language, on_progress, on_status):
        words = [Word(w, i * 0.5, i * 0.5 + 0.5) for i, w in enumerate("un deux trois quatre cinq six".split())]
        return [Segment(1, 0.0, 3.0, "un deux trois quatre cinq six", words)], "fr", 0.9

    client = make_client(store, transcribe_fn=long_sentence)
    project_id = upload(client).json()["id"]
    client.post(f"/api/projects/{project_id}/transcription", json={"max_chars": 13}, headers=HEADERS)
    assert wait_for_job(client, project_id)["status"] == "done"
    texts = [s["text"] for s in client.get(f"/api/projects/{project_id}").json()["segments"]]
    assert texts == ["un deux trois", "quatre cinq", "six"]


@pytest.mark.parametrize(
    "change",
    [{"text_color": "red"}, {"font": "Comic Sans"}, {"size": 3}],
)
def test_invalid_style_is_rejected(client, change):
    project = upload(client).json()
    style = {**project["style"], **change}
    response = client.put(
        f"/api/projects/{project['id']}/content", json={"segments": [], "style": style}, headers=HEADERS
    )
    assert response.status_code == 422


def test_split_endpoint(client):
    words = [{"text": w, "start": i, "end": i + 1} for i, w in enumerate("aaaa bbbb cccc".split())]
    segments = [{"id": 1, "start": 0, "end": 3, "text": "aaaa bbbb cccc", "words": words}]
    response = client.post("/api/segments/split", json={"segments": segments, "max_chars": 9}, headers=HEADERS)
    assert [s["text"] for s in response.json()] == ["aaaa bbbb", "cccc"]


def test_config_lists_fonts_and_serves_them(client):
    config = client.get("/api/config").json()
    montserrat = next(f for f in config["fonts"] if f["name"] == "Montserrat")
    assert config["default_style"]["font"] == "Montserrat"
    font = client.get(montserrat["bold"])
    assert font.status_code == 200
    assert font.content[:4] in (b"\x00\x01\x00\x00", b"true", b"OTTO")
    assert client.get("/api/fonts/..%2Fserver.py").status_code == 404


def test_render_flow(client):
    project_id = upload(client).json()["id"]
    base = f"/api/projects/{project_id}/render"
    assert client.delete(f"{base}/frames", headers=HEADERS).status_code == 204
    for name in ("blank.png", "1.png"):
        assert client.put(f"{base}/frames/{name}", content=b"png", headers=HEADERS).status_code == 204
    assert client.put(f"{base}/frames/x.txt", content=b"png", headers=HEADERS).status_code == 422
    # A path trying to leave the frames folder never matches a route.
    assert client.put(f"{base}/frames/..%2Fx.png", content=b"png", headers=HEADERS).status_code >= 400

    missing = {"overlays": [{"image": "2.png", "start": 0, "end": 1}]}
    assert client.post(base, json=missing, headers=HEADERS).status_code == 422

    overlays = {"overlays": [{"image": "1.png", "start": 0, "end": 1}]}
    assert client.post(base, json=overlays, headers=HEADERS).status_code == 202
    assert wait_for_job(client, project_id, kind="render")["status"] == "done"

    video = client.get(f"{base}/file")
    assert video.content == b"rendered:1.png"
    assert "Clip%20%C3%A9t%C3%A9-subtitled.mp4" in video.headers["content-disposition"]


def test_render_error_is_reported(store):
    def failing_render(*args):
        raise RuntimeError("encoder exploded")

    client = make_client(store, render_fn=failing_render)
    project_id = upload(client).json()["id"]
    base = f"/api/projects/{project_id}/render"
    client.delete(f"{base}/frames", headers=HEADERS)
    client.put(f"{base}/frames/blank.png", content=b"png", headers=HEADERS)
    client.post(base, json={"overlays": []}, headers=HEADERS)
    status = wait_for_job(client, project_id, lang="fr", kind="render")
    assert status["error"] == "L'export de la vidéo a échoué : encoder exploded"


def test_ass_export(client):
    project_id = upload(client).json()["id"]
    ass = client.get(f"/api/projects/{project_id}/export/ass")
    assert ass.status_code == 200
    assert "PlayResX: 1080" in ass.text


def test_page_is_never_served_stale(client):
    assert client.get("/").headers.get("cache-control") == "no-cache"


def test_favicon(client):
    response = client.get("/favicon.ico")
    # Served once the interface is built (it is part of the build).
    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert response.headers["content-type"] == "image/png"
