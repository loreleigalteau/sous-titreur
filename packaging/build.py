"""Build the standalone application for the current system.

Usage, from the project root, with the backend's virtual environment:
    backend/.venv/bin/python packaging/build.py          (macOS)
    backend\\.venv\\Scripts\\python packaging\\build.py    (Windows)

The backend must be installed with the "build" extra:
    pip install -e "backend[build]"

Steps:
  1. build the web interface (npm);
  2. prepare the "small" Whisper model, shipped inside the application so it
     works right away and offline;
  3. record FFmpeg's build information (its licence requires it);
  4. run PyInstaller (see sous-titreur.spec);
  5. make the file to share: a .dmg on macOS, a .zip on Windows.

The result is in packaging/dist/. A macOS build must be made on a Mac and a
Windows build on Windows: GitHub Actions does both (.github/workflows/).

This is a developer tool, so its messages are in English.
"""

from __future__ import annotations

import platform
import shutil
import subprocess
import sys
from pathlib import Path

PACKAGING = Path(__file__).resolve().parent
ROOT = PACKAGING.parent
FRONTEND = ROOT / "frontend"
BUILD = PACKAGING / "build"
DIST = PACKAGING / "dist"
MODEL = "small"  # the application's default model

sys.path.insert(0, str(ROOT / "backend"))
from app import __version__  # noqa: E402


def step(text: str) -> None:
    print(f"→ {text}", flush=True)


def run(command: list[str], **kwargs) -> None:
    subprocess.run(command, check=True, **kwargs)


def build_interface() -> None:
    step("Building the web interface")
    npm = shutil.which("npm")
    if npm is None:
        sys.exit("npm was not found: install Node.js 20.19 or newer (https://nodejs.org).")
    # "ci" installs exactly the versions of package-lock.json.
    run([npm, "ci", "--no-fund", "--no-audit", "--silent"], cwd=FRONTEND)
    run([npm, "run", "--silent", "build"], cwd=FRONTEND)


def prepare_model() -> None:
    target = BUILD / "models" / MODEL
    if (target / "model.bin").is_file():
        step(f"Whisper model '{MODEL}': already prepared")
        return
    step(f"Preparing the Whisper model '{MODEL}' (about 485 MB)")
    from faster_whisper.utils import download_model

    source = Path(download_model(MODEL))
    shutil.rmtree(target, ignore_errors=True)
    # The download cache is made of links: copy the actual files.
    shutil.copytree(source, target, symlinks=False)


def record_ffmpeg_licence() -> None:
    step("Recording FFmpeg's build information")
    from app.ffmpeg import ffmpeg_path

    licenses = BUILD / "licenses"
    licenses.mkdir(parents=True, exist_ok=True)
    info = subprocess.run(
        [ffmpeg_path(), "-hide_banner", "-version"], capture_output=True, text=True, check=True
    ).stdout
    (licenses / "ffmpeg-build.txt").write_text(
        "The FFmpeg program shipped with this application was built with the\n"
        "configuration below (from the imageio-ffmpeg package). FFmpeg is free\n"
        "software under the GNU GPL; its source code is available at\n"
        "https://ffmpeg.org/download.html (see THIRD-PARTY-NOTICES.md).\n\n" + info,
        encoding="utf-8",
    )


def run_pyinstaller() -> None:
    step("Packaging with PyInstaller (a few minutes)")
    import PyInstaller.__main__

    PyInstaller.__main__.run([
        str(PACKAGING / "sous-titreur.spec"),
        "--noconfirm",
        "--distpath", str(DIST),
        "--workpath", str(BUILD / "pyinstaller"),
    ])


def make_archive() -> Path:
    machine = platform.machine().lower().replace("amd64", "x64").replace("x86_64", "x64")
    if sys.platform == "darwin":
        step("Making the disk image (.dmg)")
        image = DIST / f"Sous-titreur-{__version__}-macos-{machine}.dmg"
        staging = BUILD / "dmg"
        shutil.rmtree(staging, ignore_errors=True)
        staging.mkdir(parents=True)
        # The app and a link to Applications: users drag one onto the other.
        run(["ditto", str(DIST / "Sous-titreur.app"), str(staging / "Sous-titreur.app")])
        (staging / "Applications").symlink_to("/Applications")
        image.unlink(missing_ok=True)
        run(["hdiutil", "create", "-volname", "Sous-titreur", "-srcfolder", str(staging),
             "-ov", "-format", "UDZO", str(image)])
        return image
    step("Making the archive (.zip)")
    name = f"Sous-titreur-{__version__}-windows-{machine}" if sys.platform == "win32" else (
        f"Sous-titreur-{__version__}-{sys.platform}-{machine}"
    )
    archive = shutil.make_archive(str(DIST / name), "zip", root_dir=DIST, base_dir="Sous-titreur")
    return Path(archive)


def main() -> int:
    build_interface()
    prepare_model()
    record_ffmpeg_licence()
    run_pyinstaller()
    result = make_archive()
    size = result.stat().st_size / 1e6
    print(f"\nDone: {result} ({size:.0f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
