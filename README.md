# Sous-titreur

A free (GPL v3), local-first tool that automatically generates subtitles for a
video and lets you edit them. Everything runs on your own computer: no cloud
service, no video ever leaves your machine.

> Status: **phase 3**: a web editor that runs locally: import a video
> (vertical TikTok/Reels format included), transcribe it into short or long
> subtitles, correct them, adjust their timing on a timeline with the sound
> wave, style them, and export a video with the subtitles burned in, or the
> subtitle file alone (SRT, VTT, ASS).

## Requirements

- **Python 3.10 to 3.13** (faster-whisper does not always have packages for the
  latest Python release yet).
- **FFmpeg**, installed and available on the command line:
  - macOS: `brew install ffmpeg`
  - Ubuntu / Debian: `sudo apt install ffmpeg`
  - Windows: download it from https://ffmpeg.org/download.html and add it to the `PATH`.
- **Node.js 20.19 or newer**, only to build the web interface
  (https://nodejs.org, or `brew install node` on macOS).

An NVIDIA GPU is used automatically if available; otherwise everything runs on the CPU.

## Installation

The quickest way is the bootstrap script, from the project root:

```bash
python3 bootstrap.py
```

It finds a compatible Python (even if your default one is too recent), checks
that FFmpeg and Node.js are installed, creates `backend/.venv`, installs the
dependencies, builds the web interface and downloads the speech-recognition
model, so that the first transcription does not have to wait for it. Running
it again is safe: steps already done are skipped.

By default it downloads the `small` model (about 485 MB), the one the
application picks by default. To choose:

```bash
python3 bootstrap.py --model medium                # another model
python3 bootstrap.py --model tiny --model small    # several models
python3 bootstrap.py --model all                   # all of them (about 2.2 GB)
python3 bootstrap.py --no-model                    # none
```

Manual installation, if you prefer:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cd ../frontend
npm install
npm run build                    # builds into backend/app/static
```

## Usage

### Subtitle editor

From the `backend/` folder, with the virtual environment activated:

```bash
python -m app                    # or: sous-titreur
```

This starts a local server and opens the editor in your browser
(http://localhost:8000, or the next free port). Keep the terminal open while
you use it; press Ctrl+C to stop.

| Option         | Description                                              |
|----------------|----------------------------------------------------------|
| `--port`       | Preferred port (default 8000).                           |
| `--no-browser` | Do not open the browser automatically.                   |
| `--ui-lang`    | Interface language: `en` or `fr`.                        |

In the editor you can:

- import a video (drag and drop, or choose a file);
- transcribe it, choosing the accuracy, the spoken language and the subtitle
  length (short for TikTok/Reels, standard for YouTube…). Long sentences are
  cut using the timing of each word, preferably after punctuation;
- watch the video in its own proportions with the subtitles drawn on it;
- correct the text and the start/end times; clicking a subtitle moves the
  video to it. The browser's spell checker underlines mistakes;
- split a subtitle at the cursor (Ctrl/⌘+Enter), add, merge or delete
  subtitles, or re-cut them all to another length;
- adjust the timing on the timeline under the video, which shows the sound
  wave: drag a subtitle to move it, drag its edges to change its start or
  end. Subtitles snap to their neighbours and never overlap them;
- shift all timings at once (or from the current subtitle onward);
- undo / redo any change (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z);
- find and replace across all subtitles (match case, whole word);
- choose the font, size, colours (with one-click preset text colours),
  outline or background box, and drag the subtitle anywhere on the video;
- export a video with the subtitles burned in (MP4), or the subtitle file
  alone: SRT, VTT, or ASS (keeps the style, for other software).

Edits are saved automatically (Ctrl/⌘+S saves immediately).

Keyboard shortcuts (outside the text fields; press `?` in the editor for the list):

| Key | Action |
|---|---|
| Space | Play / pause |
| ← / → | Back / forward 1 second (with Shift: 5 seconds) |
| ↑ / ↓ | Previous / next subtitle |
| Enter | Edit the current subtitle's text (Esc to leave it) |
| Ctrl/⌘ + Enter | Split the subtitle at the cursor |
| `[` / `]` | Set the current subtitle's start / end to the playhead |
| Ctrl/⌘ + Z, Ctrl/⌘ + Shift + Z | Undo / redo |
| Ctrl/⌘ + S | Save now |

The subtitles are drawn by the browser, with the same code for the preview
and for the export, and FFmpeg lays them over the video: the exported video
looks exactly like the preview, and any FFmpeg build works. Keep the page
open until a video export is finished.

The exported video keeps the resolution and frame rate of the original. Burning
subtitles in changes the picture, so it is re-encoded (H.264, CRF 18, visually
lossless); the sound is copied unchanged when it is AAC or MP3 (the case for
phone and TikTok videos), otherwise converted to AAC. HDR colours (recent
iPhones) are not preserved yet. Projects are
stored in your user data folder (`~/Library/Application Support/sous-titreur`
on macOS, `%APPDATA%\sous-titreur` on Windows, `~/.local/share/sous-titreur` on
Linux), or in the folder set by the `SOUS_TITREUR_DATA_DIR` environment variable.

Spell checking uses the dictionaries of your browser: Firefox follows the
language of the subtitles if the dictionary is installed; Chrome and Safari
use the languages enabled in their settings or in the system.

### Command line

```bash
python -m app.cli /path/to/video.mp4 --model small --lang fr
```

This creates `/path/to/video.srt` next to the video.

| Option         | Description                                                         |
|----------------|---------------------------------------------------------------------|
| `--model`      | `tiny`, `base`, `small` (default) or `medium`. Bigger = more accurate but slower. |
| `--lang`       | Language spoken in the video (`fr`, `en`, …). Omit it to let Whisper detect it. |
| `--max-chars`  | Cut subtitles to at most this many characters (e.g. 20 for TikTok, 42 for YouTube). |
| `-o, --output` | Output SRT path. Default: same name as the video, with `.srt`.      |
| `--ui-lang`    | Language of the application messages: `en` or `fr`.                |

The Whisper model is downloaded on first use (from about 75 MB for `tiny` to
1.5 GB for `medium`), unless the bootstrap already did it, and then kept on
disk. From then on, transcription works entirely offline: the application
never contacts the internet, and your videos never leave your computer.

### Interface language

The application is available in English and French. The language is chosen
in this order: the `--ui-lang` option, then the `SOUS_TITREUR_LANG`
environment variable (e.g. `export SOUS_TITREUR_LANG=fr` to make it
permanent), then your system language (the browser's language for the web
editor), and English otherwise. The web editor also has a language menu; its
choice is remembered by the browser.

## Development

```bash
cd backend && pytest             # backend tests
cd frontend && npm test          # interface tests
```

To work on the interface with instant reload, run the server
(`python -m app --no-browser`) and, in another terminal, `npm run dev` in
`frontend/`, then open the address Vite prints. API calls are forwarded to the
Python server.

The API is documented at http://localhost:8000/api/docs while the server runs.

## Project layout

```
bootstrap.py         one-command development setup
backend/
  app/
    __main__.py      starts the server and opens the browser
    server.py        web API (FastAPI) and serving of the interface
    jobs.py          background jobs (transcription, video export)
    render.py        video export: overlays the subtitle images with FFmpeg
    segmentation.py  cutting subtitles to a maximum length
    waveform.py      sound wave for the timeline (computed with FFmpeg)
    storage.py       projects saved as JSON on disk
    cli.py           command-line entry point
    audio.py         audio extraction with FFmpeg
    transcribe.py    speech-to-text with faster-whisper
    srt.py, vtt.py, ass.py  subtitle files
    models.py        data model (Project, Style, Segment, Word)
    fonts/           bundled free fonts (SIL Open Font License, see OFL-*.txt)
    i18n/            user-facing texts, one file per language (en.py, fr.py)
    static/          built web interface (generated, not versioned)
  tests/
frontend/            web interface (React + TypeScript + Vite)
  public/logo.svg    the application's logo (also the browser tab icon)
  src/
    components/      screens and building blocks
    i18n/            interface texts, one file per language (en.ts, fr.ts)
    subtitleRenderer.ts  draws a subtitle (preview and export)
    renderExport.ts  prepares a video export
    history.ts       undo / redo
    timing.ts        timeline snapping, shifting, navigation between subtitles
    segmentOps.ts    split, merge, add subtitles
    findReplace.ts   find and replace logic
    time.ts          time display and parsing
```

## License

GNU General Public License v3.0 or later — see [LICENSE](LICENSE).

The bundled fonts (Montserrat, Poppins, Roboto, Bebas Neue, Anton, Pacifico)
are distributed under the SIL Open Font License 1.1; their licences are in
`backend/app/fonts/`.
