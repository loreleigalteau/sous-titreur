"""Set up the development environment in one command.

Usage:
    python3 bootstrap.py                    # install, and download the "small" model
    python3 bootstrap.py --model medium     # download another model instead
    python3 bootstrap.py --model tiny --model small   # several models
    python3 bootstrap.py --model all        # every model (about 2.2 GB)
    python3 bootstrap.py --no-model         # download no model

What it does, each step being skipped when already done:
  1. find a supported Python (3.10 to 3.13), even if the one running this
     script is not;
  2. create backend/.venv;
  3. install the backend and its dependencies in it (FFmpeg included, through
     the imageio-ffmpeg package: nothing to install separately);
  4. check Node.js, then install and build the web interface (frontend/);
  5. download the Whisper speech-recognition model(s), so that the first
     transcription does not have to wait for it (models already on the
     computer are detected without contacting the internet).

Node.js is only needed to build the interface; people installing a released
version will get it already built.

This is a developer tool, so its messages are in English and are not part of
the translatable interface texts (app/i18n/).

This script must only use the standard library: it runs before anything is
installed.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
VENV = BACKEND / ".venv"

# app.models only uses the standard library.
sys.path.insert(0, str(BACKEND))
from app.models import MODEL_SIZES  # noqa: E402

# faster-whisper's dependencies are not always available for the newest Python.
SUPPORTED = [(3, 10), (3, 11), (3, 12), (3, 13)]
IS_WINDOWS = os.name == "nt"

# Required by Vite, the tool that builds the web interface.
MIN_NODE = (20, 19)
FRONTEND = ROOT / "frontend"

NODE_INSTALL_HINT = (
    "Node.js 20.19 or newer was not found. It is needed to build the web "
    "interface: install the LTS version from https://nodejs.org "
    "(macOS: `brew install node`), then run this script again."
)

class BootstrapError(Exception):
    pass


# flush=True keeps our messages in order with the output of the commands we run.
def step(text: str) -> None:
    print(f"→ {text}", flush=True)


def ok(text: str) -> None:
    print(f"  ✓ {text}", flush=True)


def warn(text: str) -> None:
    print(f"  ! {text}", flush=True)


def run(command: list[str], **kwargs) -> None:
    if subprocess.run(command, **kwargs).returncode != 0:
        raise BootstrapError(f"Command failed: {' '.join(command)}")


def python_version(command: list[str]) -> tuple[int, int] | None:
    """Return (major, minor) of a Python interpreter, or None if it cannot run."""
    try:
        result = subprocess.run(
            [*command, "-c", "import sys; print(*sys.version_info[:2])"],
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    major, minor = result.stdout.split()
    return int(major), int(minor)


def candidate_pythons() -> list[list[str]]:
    """Interpreters to try, most preferred first."""
    candidates = [[sys.executable]]
    for major, minor in reversed(SUPPORTED):
        if IS_WINDOWS:
            # The Windows "py" launcher can select any installed version.
            candidates.append(["py", f"-{major}.{minor}"])
        executable = shutil.which(f"python{major}.{minor}")
        if executable:
            candidates.append([executable])
    return candidates


def format_version(version: tuple[int, int]) -> str:
    return f"{version[0]}.{version[1]}"


def find_python() -> tuple[list[str], tuple[int, int]]:
    for command in candidate_pythons():
        version = python_version(command)
        if version in SUPPORTED:
            return command, version
    supported = ", ".join(format_version(version) for version in SUPPORTED)
    raise BootstrapError(
        f"No compatible Python found (supported versions: {supported}). "
        "Install for example Python 3.12 from https://www.python.org/downloads/ "
        "(macOS: `brew install python@3.12`), then run this script again."
    )


def venv_python() -> Path:
    if IS_WINDOWS:
        return VENV / "Scripts" / "python.exe"
    return VENV / "bin" / "python"


def ensure_venv(python: list[str], version: tuple[int, int]) -> None:
    step("Virtual environment (backend/.venv)")
    if venv_python().exists():
        existing = python_version([str(venv_python())])
        if existing not in SUPPORTED:
            found = format_version(existing) if existing else "?"
            raise BootstrapError(
                f"backend/.venv uses Python {found}, which is not supported. "
                "Delete this folder, then run this script again."
            )
        ok(f"already exists, Python {format_version(existing)}")
        return
    run([*python, "-m", "venv", str(VENV)])
    ok(f"created with Python {format_version(version)}")


def install_dependencies() -> None:
    step("Installing Python dependencies (this may take a few minutes)")
    # pip skips packages that are already installed, so re-running is quick.
    run(
        [str(venv_python()), "-m", "pip", "install",
         "--quiet", "--disable-pip-version-check", "-e", ".[dev]"],
        cwd=BACKEND,
    )
    ok("dependencies installed")


def find_npm() -> str | None:
    """Return the npm executable if a recent enough Node.js is installed."""
    node, npm = shutil.which("node"), shutil.which("npm")
    if not node or not npm:
        return None
    result = subprocess.run([node, "--version"], capture_output=True, text=True)
    # The output looks like "v22.15.0".
    major, minor, *_ = (int(part) for part in result.stdout.strip().lstrip("v").split("."))
    return npm if (major, minor) >= MIN_NODE else None


def build_frontend(npm: str) -> None:
    step("Installing the web interface dependencies (npm)")
    run([npm, "install", "--no-fund", "--no-audit", "--silent"], cwd=FRONTEND)
    ok("dependencies installed")
    step("Building the web interface")
    run([npm, "run", "--silent", "build"], cwd=FRONTEND, stdout=subprocess.DEVNULL)
    ok("built into backend/app/static")


# The model the application picks by default (TranscriptionPanel.tsx).
DEFAULT_MODEL = "small"
# Approximate download sizes, to warn before long downloads.
MODEL_SIZES_MB = {"tiny": 75, "base": 145, "small": 485, "medium": 1530}

# Runs inside the venv, where faster-whisper is installed. It first looks for
# the model on the computer only (no network access), and downloads it only
# if it is missing. The models are stored in the Hugging Face cache, where the
# application looks for them too. Prints "cached" or "downloaded".
DOWNLOAD_CODE = """
import sys
from faster_whisper.utils import download_model
try:
    download_model(sys.argv[1], local_files_only=True)
    print("cached")
except Exception:
    download_model(sys.argv[1])
    print("downloaded")
"""


def download_model(model: str) -> None:
    step(f"Whisper model '{model}' (about {MODEL_SIZES_MB[model]} MB)")
    result = subprocess.run(
        [str(venv_python()), "-c", DOWNLOAD_CODE, model],
        cwd=BACKEND, stdout=subprocess.PIPE, text=True,
    )
    if result.returncode != 0:
        raise BootstrapError(f"Could not download the model '{model}'. Check the internet connection.")
    ok("already on this computer" if result.stdout.strip() == "cached" else "downloaded")


def models_to_download(args: argparse.Namespace) -> list[str]:
    if args.no_model:
        return []
    chosen = args.model or [DEFAULT_MODEL]
    if "all" in chosen:
        return list(MODEL_SIZES)
    return list(dict.fromkeys(chosen))  # without duplicates, in the given order


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Set up the sous-titreur development environment.")
    parser.add_argument(
        "--model",
        action="append",
        choices=[*MODEL_SIZES, "all"],
        help=f"Whisper model to download (default: {DEFAULT_MODEL}); can be repeated, or 'all'",
    )
    parser.add_argument("--no-model", action="store_true", help="do not download any model")
    args = parser.parse_args(argv)

    try:
        step("Checking Python")
        python, version = find_python()
        ok(f"Python {format_version(version)} ({python[0]})")

        # A missing Node.js does not stop the setup: everything else can
        # still be prepared, and we remind the user at the end.
        step("Checking Node.js")
        npm = find_npm()
        if npm:
            ok(f"npm found ({npm})")
        else:
            warn(NODE_INSTALL_HINT)

        ensure_venv(python, version)
        install_dependencies()
        if npm:
            build_frontend(npm)
        for model in models_to_download(args):
            download_model(model)
    except BootstrapError as error:
        print(f"\n{error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130

    if not npm:
        print("\nAlmost ready: you still need to install Node.js (see above).")
        return 1
    activate = r".venv\Scripts\activate" if IS_WINDOWS else "source .venv/bin/activate"
    print(
        "\nAll set. To start the subtitle editor:\n"
        "  cd backend\n"
        f"  {activate}\n"
        "  python -m app            (or: python -m app --browser)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
