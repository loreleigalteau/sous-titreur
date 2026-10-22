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
