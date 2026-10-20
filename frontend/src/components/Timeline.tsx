import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/plugins/regions";
import { api } from "../api";
import { useI18n } from "../i18n";
import { placeOnTimeline, type Span } from "../timing";
import type { Segment } from "../types";

interface Props {
  projectId: string;
  video: HTMLVideoElement | null;
  duration: number;
  segments: Segment[];
  activeIndex: number;
  disabled: boolean;
  /** A subtitle was moved or resized on the timeline (already snapped and limited). */
  onChange: (index: number, span: Span) => void;
  /** A subtitle was clicked. */
  onSelect: (index: number) => void;
}

const HEIGHT = 90;
const DEFAULT_ZOOM = 100; // pixels per second
// Blocks closer than this to a neighbour's edge snap to it, in screen pixels.
const SNAP_PIXELS = 8;
const COLOR = "rgba(99, 102, 241, 0.22)";
const ACTIVE_COLOR = "rgba(99, 102, 241, 0.5)";

/**
 * Timeline under the video: the sound wave, with one block per subtitle that
 * can be dragged to move it or stretched from its edges.
 *
 * It uses wavesurfer.js, connected to the editor's own video element so the
 * two stay in sync. The sound wave comes from the server (see waveform.py):
 * the browser never decodes the audio itself.
 */
export function Timeline({ projectId, video, duration, segments, activeIndex, disabled, onChange, onSelect }: Props) {
  const { t } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const blocks = useRef(new Map<number, Region>()); // segment id -> block
  // Read by the wavesurfer event handlers, created once.
  const latest = useRef({ segments, zoom, onChange, onSelect });
  latest.current = { segments, zoom, onChange, onSelect };

  useEffect(() => {
    api
      .waveform(projectId)
      .then((data) => setPeaks(data.peaks))
      .catch(() => setFailed(true));
  }, [projectId]);

  // Create the timeline once the video and the sound wave are ready.
  useEffect(() => {
    if (!container.current || !video || !peaks || !duration) return;
    const plugin = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: container.current,
      media: video,
      // A video without sound gets a flat line.
      peaks: [peaks.length ? peaks : [0]],
      duration,
      height: HEIGHT,
      minPxPerSec: latest.current.zoom,
      waveColor: "#9ca3af",
      progressColor: "#6b7280",
      cursorColor: "#ef4444",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      autoScroll: true,
      autoCenter: true,
      plugins: [plugin],
    });

    plugin.on("region-updated", (region) => {
      const { segments, zoom, onChange } = latest.current;
      const index = segments.findIndex((s) => String(s.id) === region.id);
      if (index === -1) return;
      const span = placeOnTimeline(segments, index, { start: region.start, end: region.end }, SNAP_PIXELS / zoom);
      region.setOptions(span); // show where it really went
      onChange(index, span);
    });
    plugin.on("region-clicked", (region, event) => {
      event.stopPropagation(); // the click selects the subtitle instead of seeking
      const index = latest.current.segments.findIndex((s) => String(s.id) === region.id);
      if (index !== -1) latest.current.onSelect(index);
    });

    wavesurfer.current = ws;
    regions.current = plugin;
    const existing = blocks.current;
    return () => {
      existing.clear();
      regions.current = null;
      wavesurfer.current = null;
      ws.destroy();
    };
  }, [video, peaks, duration]);

  // Keep the blocks in line with the subtitles: only what changed is updated,
  // so typing in a subtitle stays fast even with hundreds of them.
  useEffect(() => {
    const plugin = regions.current;
    if (!plugin) return;
    const seen = new Set<number>();
    segments.forEach((segment, index) => {
      seen.add(segment.id);
      const color = index === activeIndex ? ACTIVE_COLOR : COLOR;
      const block = blocks.current.get(segment.id);
      if (!block) {
        const label = document.createElement("div");
        label.className = "timeline-label";
        label.textContent = segment.text;
        blocks.current.set(
          segment.id,
          plugin.addRegion({
            id: String(segment.id),
            start: segment.start,
            end: Math.max(segment.end, segment.start + 0.01),
            content: label,
            color,
            drag: !disabled,
            resize: !disabled,
          }),
        );
        return;
      }
      if (block.start !== segment.start || block.end !== segment.end) {
        block.setOptions({ start: segment.start, end: Math.max(segment.end, segment.start + 0.01) });
      }
      const label = block.content;
      if (label && label.textContent !== segment.text) label.textContent = segment.text;
      if (block.color !== color) block.setOptions({ color });
      if (block.drag === disabled) block.setOptions({ drag: !disabled, resize: !disabled });
    });
    for (const [id, block] of blocks.current) {
      if (!seen.has(id)) {
        block.remove();
        blocks.current.delete(id);
      }
    }
  }, [segments, activeIndex, disabled, peaks, video, duration]);

  useEffect(() => {
    try {
      wavesurfer.current?.zoom(zoom);
    } catch {
      // Not ready yet: the zoom is applied when it is created.
    }
  }, [zoom]);

  return (
    <section className="timeline" aria-label={t("timeline_label")}>
      <div className="timeline-toolbar">
        <span>{t("timeline_label")}</span>
        <label className="timeline-zoom">
          {t("timeline_zoom")}
          <input
            type="range"
            min={10}
            max={400}
            step={5}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
      </div>
      {failed && <p className="error">{t("server_unreachable")}</p>}
      {!failed && !peaks && <p className="hint">{t("waveform_loading")}</p>}
      {/* Filled by wavesurfer.js, not by React. */}
      <div ref={container} className="timeline-wave" />
    </section>
  );
}
