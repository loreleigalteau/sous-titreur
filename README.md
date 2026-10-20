# Sous-titreur

A free (GPL v3), local-first tool that automatically generates subtitles for a
video and lets you edit them. Everything runs on your own computer: no cloud
service, no video ever leaves your machine.

> Status: **phase 2 bis**: a web editor that runs locally: import a video
> (vertical TikTok/Reels format included), transcribe it into short or long
> subtitles, correct and style them, and export a video with the subtitles
> burned in, or the subtitle file alone (SRT, VTT, ASS).

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
python3 bootstrap.py                 # add --model small to pre-download a model
```

It finds a compatible Python (even if your default one is too recent), checks
that FFmpeg and Node.js are installed, creates `backend/.venv`, installs the
dependencies and builds the web interface. Running it again is safe: steps
already done are skipped.

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
- undo / redo any change (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z);
- find and replace across all subtitles (match case, whole word);
- choose the font, size, colours, outline or background box, and drag the
  subtitle anywhere on the video;
- export a video with the subtitles burned in (MP4), or the subtitle file
  alone: SRT, VTT, or ASS (keeps the style, for other software).

Edits are saved automatically (Ctrl/⌘+S saves immediately). Space plays and
pauses the video when you are not typing.

The subtitles are drawn by the browser, with the same code for the preview
and for the export, and FFmpeg lays them over the video: the exported video
looks exactly like the preview, and any FFmpeg build works. Keep the page
open until a video export is finished. Projects are
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
1.5 GB for `medium`) and then cached on disk.

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
  src/
    components/      screens and building blocks
    i18n/            interface texts, one file per language (en.ts, fr.ts)
    subtitleRenderer.ts  draws a subtitle (preview and export)
    renderExport.ts  prepares a video export
    history.ts       undo / redo
    segmentOps.ts    split, merge, add subtitles
    findReplace.ts   find and replace logic
    time.ts          time display and parsing
```

## License

GNU General Public License v3.0 or later — see [LICENSE](LICENSE).

The bundled fonts (Montserrat, Poppins, Roboto, Bebas Neue, Anton, Pacifico)
are distributed under the SIL Open Font License 1.1; their licences are in
`backend/app/fonts/`.
