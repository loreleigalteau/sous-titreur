# PyInstaller recipe for the standalone application. Run through build.py,
# which prepares what this file expects in packaging/build/.
#
# The result is a folder ("onedir") rather than a single file: it starts much
# faster (nothing to unpack at each launch), and macOS needs a folder anyway
# for an .app.

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules, copy_metadata

PACKAGING = Path(SPECPATH)
ROOT = PACKAGING.parent
BACKEND = ROOT / "backend"
BUILD = PACKAGING / "build"
sys.path.insert(0, str(BACKEND))
from app import __version__  # noqa: E402

datas = [
    (str(BACKEND / "app" / "static"), "app/static"),  # the web interface
    (str(BACKEND / "app" / "fonts"), "app/fonts"),  # fonts and their licences
    (str(BUILD / "models"), "models"),  # the "small" Whisper model
    (str(BUILD / "licenses"), "licenses"),  # FFmpeg build information
    (str(ROOT / "LICENSE"), "."),
    (str(PACKAGING / "THIRD-PARTY-NOTICES.md"), "."),
]
# faster-whisper's voice detection model (silero_vad_*.onnx).
datas += collect_data_files("faster_whisper")
# Libraries that check their own version at run time.
for package in ("faster_whisper", "ctranslate2", "huggingface_hub", "tokenizers", "tqdm"):
    datas += copy_metadata(package)

# CTranslate2 (the speech-recognition engine) has native libraries that
# PyInstaller does not find on its own.
binaries = collect_dynamic_libs("ctranslate2")
hiddenimports = collect_submodules("ctranslate2") + ["app.desktop"]

a = Analysis(
    [str(PACKAGING / "launcher.py")],
    pathex=[str(BACKEND)],
    datas=datas,
    binaries=binaries,
    hiddenimports=hiddenimports,
    excludes=["pytest", "tkinter"],
)
pyz = PYZ(a.pure)

windows = sys.platform == "win32"
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Sous-titreur",
    console=False,  # a window application: no terminal
    icon=str(PACKAGING / "icons" / ("icon.ico" if windows else "icon.icns")),
)
coll = COLLECT(exe, a.binaries, a.datas, name="Sous-titreur")

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="Sous-titreur.app",
        icon=str(PACKAGING / "icons" / "icon.icns"),
        bundle_identifier="org.sous-titreur.app",
        version=__version__,
        info_plist={
            "CFBundleDisplayName": "Sous-titreur",
            "CFBundleShortVersionString": __version__,
            "NSHighResolutionCapable": True,
            "LSMinimumSystemVersion": "11.0",
        },
    )
