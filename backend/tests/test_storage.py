from pathlib import Path

import pytest

from app.models import Segment, Word
from app.storage import ProjectNotFound, ProjectStore, safe_suffix


@pytest.fixture
def store(tmp_path: Path) -> ProjectStore:
    return ProjectStore(tmp_path / "projects")


def test_create_get_save_roundtrip(store: ProjectStore):
    project = store.create("Ma vidéo", ".mp4")
    assert project.video_filename == "video.mp4"

    project.language = "fr"
    project.segments = [Segment(1, 0.0, 1.0, "Salut", [Word("Salut", 0.0, 1.0)])]
    store.save(project)

    loaded = store.get(project.id)
    assert loaded == project
    assert isinstance(loaded.segments[0].words[0], Word)


def test_list_newest_first_and_ignores_junk(store: ProjectStore):
    first = store.create("a", ".mp4")
    second = store.create("b", ".mp4")
    second.created_at = "2999-01-01T00:00:00+00:00"
    store.save(second)
    (store.root / "not-a-project").mkdir()
    assert [p.id for p in store.list()] == [second.id, first.id]


def test_delete(store: ProjectStore):
    project = store.create("a", ".mp4")
    store.delete(project.id)
    with pytest.raises(ProjectNotFound):
        store.get(project.id)


@pytest.mark.parametrize("bad_id", ["../etc", "abc", "", "0" * 31 + "/"])
def test_invalid_ids_are_rejected(store: ProjectStore, bad_id: str):
    with pytest.raises(ProjectNotFound):
        store.get(bad_id)


@pytest.mark.parametrize(
    ("filename", "expected"),
    [("clip.MP4", ".mp4"), ("a.b.mov", ".mov"), ("noext", ""), ("x.<script>", ""), ("../../x.mkv", ".mkv")],
)
def test_safe_suffix(filename: str, expected: str):
    assert safe_suffix(filename) == expected
