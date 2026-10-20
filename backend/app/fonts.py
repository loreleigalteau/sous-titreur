"""Fonts bundled with the application.

They are free fonts (SIL Open Font License, see the OFL-*.txt files next to
them). Bundling them guarantees that the preview and the exported video use
exactly the same font on every computer.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

FONTS_DIR = Path(__file__).parent / "fonts"


@dataclass(frozen=True)
class FontFamily:
    name: str
    regular: str
    bold: str | None = None  # None: the font has a single weight


FONTS = (
    FontFamily("Montserrat", "Montserrat-Regular.ttf", "Montserrat-Bold.ttf"),
    FontFamily("Poppins", "Poppins-Regular.ttf", "Poppins-Bold.ttf"),
    FontFamily("Roboto", "Roboto-Regular.ttf", "Roboto-Bold.ttf"),
    FontFamily("Bebas Neue", "BebasNeue-Regular.ttf"),
    FontFamily("Anton", "Anton-Regular.ttf"),
    FontFamily("Pacifico", "Pacifico-Regular.ttf"),
)

_FILES = {f for family in FONTS for f in (family.regular, family.bold) if f}


def font_path(filename: str) -> Path | None:
    """Path of a bundled font file, or None if it is not one of ours."""
    return FONTS_DIR / filename if filename in _FILES else None
