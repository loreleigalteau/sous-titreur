/** Data exchanged with the backend (mirrors backend/app/models.py). */

export interface Word {
  text: string;
  start: number;
  end: number;
}

export interface Segment {
  id: number;
  start: number; // seconds
  end: number;
  text: string;
  words: Word[];
}

/** Look and position of the subtitles (mirrors Style in backend/app/models.py). */
export interface Style {
  font: string;
  bold: boolean;
  size: number; // font size, fraction of the video height
  text_color: string; // "#rrggbb"
  outline_color: string;
  outline_width: number; // fraction of the video height, 0 = none
  background: boolean;
  background_color: string;
  background_opacity: number; // 0 to 1
  highlight_color: string; // colour of the spoken word
  highlight: boolean; // highlight the word being spoken
  highlight_scale: number; // size of the spoken word (1 = same size)
  max_words: number; // words on screen at a time, 0 = the whole subtitle
  x: number; // center of the text, fraction of the video width
  y: number; // fraction of the video height
  max_width: number; // fraction of the video width
}

export interface Project {
  id: string;
  name: string;
  video_filename: string;
  created_at: string;
  language: string | null;
  segments: Segment[];
  style: Style;
}

/** A subtitle image placed on the video during an export. */
export interface Overlay {
  image: string;
  start: number;
  end: number;
}

/** A saved style: ready-made ("builtin:…") or created by the user. */
export interface Preset {
  id: string;
  name: string; // for ready-made presets, a key translated by the interface
  style: Style;
}

export interface PresetListing {
  default: string; // id of the preset new projects start with
  builtin: Preset[];
  custom: Preset[];
}

export interface FontInfo {
  name: string;
  regular: string; // URL of the font file
  bold: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
  segment_count: number;
}

export interface Config {
  ui_language: string | null; // chosen at launch, or null to follow the browser
  ui_languages: string[];
  model_sizes: string[];
  fonts: FontInfo[];
  default_style: Style;
  projects_dir: string; // folder where projects are saved, on this computer
}

export type TranscriptionState =
  | "idle"
  | "extracting"
  | "downloading_model"
  | "loading_model"
  | "transcribing"
  | "done"
  | "error";

export interface JobStatus<State extends string = string> {
  status: State;
  progress: number; // 0 to 1
  error: string | null; // already translated by the server
}

export type TranscriptionStatus = JobStatus<TranscriptionState>;
export type RenderStatus = JobStatus<"idle" | "rendering" | "done" | "error">;
