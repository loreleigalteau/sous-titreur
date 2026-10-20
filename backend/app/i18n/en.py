MESSAGES = {
    # Errors
    "ffmpeg_not_found": (
        "FFmpeg was not found. Install it, then run the command again "
        "(macOS: `brew install ffmpeg`, Ubuntu/Debian: `sudo apt install ffmpeg`, "
        "Windows: https://ffmpeg.org/download.html)."
    ),
    "ffmpeg_failed": "FFmpeg could not extract the audio from the video:\n{details}",
    "video_not_found": "File not found: {path}",
    "unexpected_wav_format": "Unexpected audio format (expected: 16 kHz mono 16-bit WAV).",
    "transcription_failed": "The transcription failed: {details}",
    "render_failed": "The video export failed: {details}",

    # Transcription steps
    "extracting_audio": "Extracting audio…",
    "model_downloading": (
        "Downloading model '{model}' (first use only, this may take a few minutes)…"
    ),
    "model_loading": "Loading model '{model}'…",
    "transcribing": "Transcribing…",
    "language_detected": "Detected language: {language} (confidence {probability:.0%})",
    "progress": "Progress: {percent:3d}%",
    "done": "Subtitles saved to: {path} ({count} segments)",
    "interrupted": "Interrupted.",

    # Command-line help
    "cli_description": "Generate an SRT subtitle file from a video.",
    "cli_help_video": "path of the video (or audio file) to transcribe",
    "cli_help_model": "Whisper model size: bigger = more accurate but slower",
    "cli_help_lang": "language spoken in the video (e.g. fr, en). Default: auto-detect",
    "cli_help_ui_lang": "language of the application messages",
    "cli_help_max_chars": (
        "cut subtitles to at most this many characters (e.g. 20 for TikTok, 42 for YouTube)"
    ),
    "cli_help_output": "output SRT file. Default: same name as the video, with .srt",

    # Application server
    "server_description": "Start the subtitle editor and open it in the browser.",
    "server_help_port": "preferred port (the next free one is used if it is busy)",
    "server_help_no_browser": "do not open the browser automatically",
    "server_ready": "The subtitle editor is running at {url}",
    "server_stop_hint": "Keep this window open while you use it. Press Ctrl+C to stop.",
    "server_stopped": "Subtitle editor stopped.",
}
