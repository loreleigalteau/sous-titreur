import faster_whisper
import pytest

from app import transcribe


class FakeModel:
    def __init__(self, *args, **kwargs):
        self.kwargs = kwargs


@pytest.mark.parametrize(("cached", "status"), [(True, "loading"), (False, "downloading")])
def test_load_model_stays_offline_when_the_model_is_on_disk(monkeypatch, cached, status):
    monkeypatch.setattr(faster_whisper, "WhisperModel", FakeModel)
    monkeypatch.setattr(transcribe, "is_model_cached", lambda size: cached)
    statuses = []

    model = transcribe.load_model("small", on_status=lambda s, m: statuses.append(s))

    # On disk: never contact the internet. Missing: allowed to download it.
    assert model.kwargs["local_files_only"] is cached
    assert statuses == [status]


def test_a_bundled_model_is_used_first(monkeypatch, tmp_path):
    (tmp_path / "small").mkdir()
    (tmp_path / "small" / "model.bin").write_bytes(b"")
    monkeypatch.setenv("SOUS_TITREUR_MODELS_DIR", str(tmp_path))
    created = []
    monkeypatch.setattr(faster_whisper, "WhisperModel", lambda path, **kw: created.append((path, kw)))

    assert transcribe.bundled_model_dir("small") == tmp_path / "small"
    assert transcribe.bundled_model_dir("medium") is None
    assert transcribe.is_model_cached("small")
    transcribe.load_model("small")
    assert created == [(str(tmp_path / "small"), {"device": "auto", "compute_type": "auto", "local_files_only": True})]
