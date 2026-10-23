"""Style presets: ready-made ones, and the user's own.

The user's presets and the choice of the default one (the style new projects
start with) are kept in presets.json, in the application's data folder, next
to the projects. Ready-made presets are defined here; their names are
translated by the interface (keys "preset_<name>").
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path

from pydantic import TypeAdapter

from app.models import Style
from app.storage import replace_file

BUILTIN_PREFIX = "builtin:"

# The application's own defaults (models.Style) are the "social media" preset.
BUILTIN_PRESETS: dict[str, Style] = {
    "classic": Style(
        font="Roboto", text_color="#ffffff", size=0.045, outline_width=0.003, y=0.88,
    ),
    "social": Style(),
    "big_centered": Style(
        font="Anton", bold=False, text_color="#ffffff", size=0.08, outline_width=0.005,
        y=0.5, max_width=0.85,
    ),
    "karaoke": Style(
        text_color="#ffffff", size=0.05, outline_width=0.003, highlight=True,
        highlight_color="#ffff00", highlight_scale=1.2, max_words=3, y=0.75,
    ),
    "black_box": Style(
        font="Poppins", text_color="#ffffff", size=0.04, outline_width=0.0,
        background=True, background_opacity=0.7, y=0.85,
    ),
}
DEFAULT_PRESET = BUILTIN_PREFIX + "social"
MAX_NAME_LENGTH = 60

class PresetNotFound(LookupError):
    pass


@dataclass
class Preset:
    id: str
    name: str
    style: Style


@dataclass
class _Saved:
    """Content of presets.json."""

    default: str = DEFAULT_PRESET
    presets: list[Preset] = field(default_factory=list)


_saved_json = TypeAdapter(_Saved)


def clean_name(name: str) -> str:
    name = " ".join(name.split())  # no line breaks or repeated spaces
    if not 1 <= len(name) <= MAX_NAME_LENGTH:
        raise ValueError("Invalid preset name")
    return name


class PresetStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def _load(self) -> _Saved:
        if not self.path.is_file():
            return _Saved()
        try:
            return _saved_json.validate_json(self.path.read_bytes())
        except ValueError:
            return _Saved()  # damaged file: start again rather than fail

    def _write(self, saved: _Saved) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_bytes(_saved_json.dump_json(saved, indent=2))
        replace_file(tmp, self.path)

    def listing(self) -> dict:
        with self._lock:
            saved = self._load()
        return {
            "default": saved.default,
            "builtin": [
                {"id": BUILTIN_PREFIX + name, "name": name, "style": asdict(style)}
                for name, style in BUILTIN_PRESETS.items()
            ],
            "custom": [asdict(p) for p in saved.presets],
        }

    def default_style(self) -> Style:
        """The style new projects start with."""
        with self._lock:
            saved = self._load()
        return self._style_of(saved, saved.default) or Style()

    @staticmethod
    def _style_of(saved: _Saved, preset_id: str) -> Style | None:
        if preset_id.startswith(BUILTIN_PREFIX):
            style = BUILTIN_PRESETS.get(preset_id.removeprefix(BUILTIN_PREFIX))
        else:
            style = next((p.style for p in saved.presets if p.id == preset_id), None)
        return replace(style) if style else None  # a copy: never shared

    def create(self, name: str, style: Style) -> Preset:
        preset = Preset(id=uuid.uuid4().hex, name=clean_name(name), style=style)
        with self._lock:
            saved = self._load()
            saved.presets.append(preset)
            self._write(saved)
        return preset

    def update(self, preset_id: str, name: str | None, style: Style | None) -> Preset:
        with self._lock:
            saved = self._load()
            preset = next((p for p in saved.presets if p.id == preset_id), None)
            if preset is None:
                raise PresetNotFound(preset_id)
            if name is not None:
                preset.name = clean_name(name)
            if style is not None:
                preset.style = style
            self._write(saved)
        return preset

    def delete(self, preset_id: str) -> None:
        with self._lock:
            saved = self._load()
            remaining = [p for p in saved.presets if p.id != preset_id]
            if len(remaining) == len(saved.presets):
                raise PresetNotFound(preset_id)
            saved.presets = remaining
            if saved.default == preset_id:
                saved.default = DEFAULT_PRESET  # the default preset is gone
            self._write(saved)

    def set_default(self, preset_id: str) -> None:
        with self._lock:
            saved = self._load()
            if self._style_of(saved, preset_id) is None:
                raise PresetNotFound(preset_id)
            saved.default = preset_id
            self._write(saved)

