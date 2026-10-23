# Changelog

All notable changes to Sous-titreur are listed here, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and version numbers follow [Semantic Versioning](https://semver.org/).
When releasing, rename "Unreleased" to the new version and its date, and use
the same number in `backend/app/__init__.py` and in the Git tag (`v0.2.0`).

## [0.2.0] - 2026-10-23

### Added
- Style presets in the style panel:
  - ready-made: Classic, Social media, Big centred text, Black box;
  - your own: save the current settings (position included) under a name,
    then update, rename or delete them;
  - the preset marked ★ is the style every new project starts with.
- Presets are kept on your computer, in `presets.json` next to the projects.

## [0.1.0] - 2026-10-23

First version, as a desktop application for macOS (Apple silicon and Intel)
and Windows.

### Added
- Automatic transcription with Whisper ("small" model included), in French,
  English and many other languages, entirely on your computer and offline.
- Short subtitles for TikTok and Reels, or longer ones for YouTube, cut using
  the timing of each word.
- Editor: video preview in its own proportions (vertical included), editable
  text and times, split, merge, add and delete subtitles, undo and redo.
- Timeline with the sound wave: drag subtitles to move or resize them, shift
  all timings at once.
- Spell checking, and find and replace across all subtitles.
- Style: bundled free fonts, size, colours (with one-click text colours),
  outline or background box, position by dragging the subtitle on the video.
- Export as a video with the subtitles burned in (MP4, sound kept unchanged
  when possible), or as a subtitle file (SRT, VTT, ASS).
- Keyboard shortcuts (press `?` in the editor for the list).
- Interface in French and English.

[Unreleased]: https://github.com/loreleigalteau/sous-titreur/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/loreleigalteau/sous-titreur/releases/tag/v0.1.0
