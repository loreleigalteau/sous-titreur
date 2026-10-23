/** Calls to the local Python server. */
import type {
  Config,
  Overlay,
  Preset,
  PresetListing,
  Project,
  ProjectSummary,
  RenderStatus,
  Segment,
  Style,
  TranscriptionStatus,
} from "./types";

// The server refuses changes without this header: it proves the request comes
// from this interface and not from another website open in the browser.
const APP_HEADER = { "X-Sous-Titreur": "1" };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = method === "GET" ? {} : { ...APP_HEADER };
  const isBinary = body instanceof Blob;
  if (body !== undefined && !isBinary) headers["Content-Type"] = "application/json";
  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : isBinary ? body : JSON.stringify(body),
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return (response.status === 204 ? undefined : await response.json()) as T;
}

const projectUrl = (id: string) => `/api/projects/${encodeURIComponent(id)}`;

export const api = {
  config: () => request<Config>("GET", "/api/config"),
  listProjects: () => request<ProjectSummary[]>("GET", "/api/projects"),
  getProject: (id: string) => request<Project>("GET", projectUrl(id)),
  deleteProject: (id: string) => request<void>("DELETE", projectUrl(id)),
  saveContent: (id: string, segments: Segment[], style: Style) =>
    request<unknown>("PUT", `${projectUrl(id)}/content`, { segments, style }),
  splitSegments: (segments: Segment[], maxChars: number) =>
    request<Segment[]>("POST", "/api/segments/split", { segments, max_chars: maxChars }),
  startTranscription: (id: string, model: string, language: string | null, maxChars: number | null) =>
    request<unknown>("POST", `${projectUrl(id)}/transcription`, { model, language, max_chars: maxChars }),
  transcriptionStatus: (id: string, language: string) =>
    request<TranscriptionStatus>("GET", `${projectUrl(id)}/transcription?lang=${language}`),
  videoUrl: (id: string) => `${projectUrl(id)}/video`,
  waveform: (id: string) =>
    request<{ peaks_per_second: number; peaks: number[] }>("GET", `${projectUrl(id)}/waveform`),
  exportUrl: (id: string, format: "srt" | "vtt" | "ass", language: string) =>
    `${projectUrl(id)}/export/${format}?lang=${language}`,

  presets: () => request<PresetListing>("GET", "/api/presets"),
  createPreset: (name: string, style: Style) => request<Preset>("POST", "/api/presets", { name, style }),
  updatePreset: (id: string, change: { name?: string; style?: Style }) =>
    request<Preset>("PUT", `/api/presets/${encodeURIComponent(id)}`, change),
  deletePreset: (id: string) => request<void>("DELETE", `/api/presets/${encodeURIComponent(id)}`),
  setDefaultPreset: (id: string) => request<void>("PUT", "/api/presets/default", { id }),

  // Video export: see backend/app/server.py for the sequence of calls.
  clearFrames: (id: string) => request<void>("DELETE", `${projectUrl(id)}/render/frames`),
  uploadFrame: (id: string, name: string, image: Blob) =>
    request<void>("PUT", `${projectUrl(id)}/render/frames/${name}`, image),
  startRender: (id: string, overlays: Overlay[]) =>
    request<unknown>("POST", `${projectUrl(id)}/render`, { overlays }),
  renderStatus: (id: string, language: string) =>
    request<RenderStatus>("GET", `${projectUrl(id)}/render?lang=${language}`),
  renderFileUrl: (id: string) => `${projectUrl(id)}/render/file`,

  /**
   * Send a video file to the server. Uses XMLHttpRequest rather than fetch
   * because only XMLHttpRequest reports upload progress.
   */
  uploadVideo(file: File, onProgress: (fraction: number) => void) {
    const xhr = new XMLHttpRequest();
    const promise = new Promise<Project>((resolve, reject) => {
      xhr.open("POST", `/api/projects?filename=${encodeURIComponent(file.name)}`);
      for (const [name, value] of Object.entries(APP_HEADER)) xhr.setRequestHeader(name, value);
      xhr.responseType = "json";
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
      xhr.onload = () =>
        xhr.status === 201
          ? resolve(xhr.response as Project)
          : reject(new ApiError(xhr.status, JSON.stringify(xhr.response)));
      xhr.onerror = () => reject(new ApiError(0, "network error"));
      xhr.onabort = () => reject(new ApiError(0, "aborted"));
      xhr.send(file); // the raw file, streamed by the browser
    });
    return { promise, abort: () => xhr.abort() };
  },
};
