/**
 * Preparing a video export: each subtitle is drawn as a transparent image the
 * size of the video, with the same code as the preview, and sent to the
 * server, which lays the images over the video with FFmpeg.
 */
import { api } from "./api";
import { drawSubtitle, layoutSubtitle, loadFont } from "./subtitleRenderer";
import type { Overlay, Segment, Style } from "./types";

function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG encoding failed"))), "image/png"),
  );
}

/**
 * Draw and upload the subtitle images, then start the export.
 * `onProgress` receives the number of images done and the total.
 */
export async function startVideoExport(
  projectId: string,
  segments: Segment[],
  style: Style,
  size: { width: number; height: number },
  onProgress: (done: number, total: number) => void,
): Promise<void> {
  await loadFont(style);
  await api.clearFrames(projectId);

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  // Shown between subtitles.
  await api.uploadFrame(projectId, "blank.png", await toPng(canvas));

  const visible = segments.filter((s) => s.text.trim() && s.end > s.start);
  const overlays: Overlay[] = [];
  for (const [i, segment] of visible.entries()) {
    ctx.clearRect(0, 0, size.width, size.height);
    drawSubtitle(ctx, layoutSubtitle(ctx, segment.text, style, size.width, size.height), style, size.height);
    const image = `${i + 1}.png`;
    await api.uploadFrame(projectId, image, await toPng(canvas));
    overlays.push({ image, start: segment.start, end: segment.end });
    onProgress(i + 1, visible.length);
  }
  await api.startRender(projectId, overlays);
}
