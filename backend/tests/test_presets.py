from pathlib import Path

import pytest

from app.models import Style
from app.presets import BUILTIN_PRESETS, DEFAULT_PRESET, PresetNotFound, PresetStore


@pytest.fixture
def presets(tmp_path: Path) -> PresetStore:
    return PresetStore(tmp_path / "presets.json")


def test_starts_with_the_builtin_default(presets: PresetStore):
    assert presets.listing()["default"] == DEFAULT_PRESET
    assert presets.default_style() == Style()


def test_presets_are_kept_on_disk(presets: PresetStore, tmp_path: Path):
    preset = presets.create("Mine", Style(text_color="#00ff00"))
    presets.set_default(preset.id)
    again = PresetStore(tmp_path / "presets.json")  # as after a restart
    assert again.listing()["custom"][0]["name"] == "Mine"
    assert again.default_style().text_color == "#00ff00"


def test_default_style_is_a_copy(presets: PresetStore):
    """Changing a project's style must never change a preset."""
    presets.set_default("builtin:classic")
    presets.default_style().text_color = "#000000"
    assert BUILTIN_PRESETS["classic"].text_color == "#ffffff"


def test_damaged_file_does_not_break_the_application(presets: PresetStore, tmp_path: Path):
    (tmp_path / "presets.json").write_text("{not json")
    assert presets.default_style() == Style()


@pytest.mark.parametrize("name", ["", "   ", "x" * 61])
def test_invalid_names(presets: PresetStore, name: str):
    with pytest.raises(ValueError):
        presets.create(name, Style())


def test_unknown_presets(presets: PresetStore):
    with pytest.raises(PresetNotFound):
        presets.delete("nope")
    with pytest.raises(PresetNotFound):
        presets.update("builtin:social", "x", None)  # ready-made presets cannot be changed
