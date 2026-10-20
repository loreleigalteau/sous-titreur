import { forwardRef, useEffect, useRef, useState, type PointerEvent } from "react";
import { useI18n } from "../i18n";
import { drawSubtitle, layoutSubtitle, loadFont, type Box } from "../subtitleRenderer";
import { formatTime } from "../time";
import type { Segment, Style } from "../types";

/** Index of the subtitle shown at `time`, or -1. */
export function activeSegmentIndex(segments: Segment[], time: number): number {
  return segments.findIndex((segment) => time >= segment.start && time < segment.end);
}

export interface VideoSize {
  width: number;
  height: number;
}

export interface VideoInfo extends VideoSize {
  duration: number; // seconds
}

interface Props {
  src: string;
  segments: Segment[];
  style: Style;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  /** Called once, at the end of a drag, with the new position. */
  onMove: (position: { x: number; y: number }) => void;
  onVideoInfo: (info: VideoInfo) => void;
}

// Share of the window height the video may take.
const MAX_HEIGHT = 0.62;
// Within this distance of the center, a dragged subtitle snaps to it.
const SNAP = 0.02;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const contains = (box: Box, x: number, y: number) =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

/**
 * Video with its subtitle drawn on top, in the video's own proportions
 * (vertical videos included).
 *
 * The subtitle is drawn on a canvas by the same code as the exported video
 * (subtitleRenderer.ts), so what you see is what you get. It can be dragged
 * to a new position. The browser's video controls are replaced by our own:
 * they would cover the bottom of the picture, where subtitles usually go.
 */
export const VideoPlayer = forwardRef<HTMLVideoElement, Props>(function VideoPlayer(
  { src, segments, style, activeIndex, onActiveChange, onMove, onVideoInfo },
  ref,
) {
  const { t } = useI18n();
  const areaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoSize, setVideoSize] = useState<VideoSize | null>(null);
  const [frame, setFrame] = useState<VideoSize>({ width: 0, height: 0 });
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const [fontVersion, setFontVersion] = useState(0);
  // Position while dragging; committed to the style when the drag ends.
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const bounds = useRef<Box | null>(null); // subtitle area, in canvas pixels

  // Read by the animation loop, which must not restart on every edit.
  const latest = useRef({ segments, activeIndex, onActiveChange });
  latest.current = { segments, activeIndex, onActiveChange };

  useEffect(() => {
    // "timeupdate" only fires about 4 times per second, which makes subtitles
    // appear late. Checking on every frame keeps them in sync.
    let frameId = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const { segments, activeIndex, onActiveChange } = latest.current;
        const index = activeSegmentIndex(segments, video.currentTime);
        if (index !== activeIndex) onActiveChange(index);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Fit the video in the available space, keeping its proportions.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const fit = () => {
      const ratio = videoSize ? videoSize.width / videoSize.height : 16 / 9;
      const width = Math.min(area.clientWidth, window.innerHeight * MAX_HEIGHT * ratio);
      setFrame({ width, height: width / ratio });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [videoSize]);

  // Redraw once the font is loaded (fonts are downloaded on first use).
  useEffect(() => {
    let cancelled = false;
    loadFont(style).then(() => !cancelled && setFontVersion((v) => v + 1));
    return () => {
      cancelled = true;
    };
  }, [style]);

  const shownStyle = dragPosition ? { ...style, ...dragPosition } : style;
  const activeText = segments[activeIndex]?.text ?? "";
  // While paused between subtitles, show a sample so the style and position
  // can be adjusted.
  const sample = !activeText.trim() && !playing;
  const text = sample ? (segments.find((s) => s.text.trim())?.text ?? t("style_sample")) : activeText;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frame.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(frame.width * ratio);
    canvas.height = Math.round(frame.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text.trim()) {
      bounds.current = null;
      return;
    }
    const layout = layoutSubtitle(ctx, text, shownStyle, canvas.width, canvas.height);
    bounds.current = layout.bounds;
    ctx.globalAlpha = sample ? 0.55 : 1;
    drawSubtitle(ctx, layout, shownStyle, canvas.height);
    ctx.globalAlpha = 1;
    if (dragPosition && dragPosition.x === 0.5) {
      // Guide showing that the subtitle is centred.
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.setLineDash([6 * ratio, 6 * ratio]);
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
    }
  }, [frame, text, sample, shownStyle, dragPosition, fontVersion]);

  /** Pointer position as fractions of the frame, and in canvas pixels. */
  const pointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;
    return { fx, fy, px: fx * canvas.width, py: fy * canvas.height };
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const { fx, fy, px, py } = pointer(event);
    if (bounds.current && contains(bounds.current, px, py)) {
      drag.current = { dx: fx - style.x, dy: fy - style.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else {
      togglePlay();
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const { fx, fy, px, py } = pointer(event);
    if (drag.current) {
      let x = clamp(fx - drag.current.dx);
      if (Math.abs(x - 0.5) < SNAP) x = 0.5;
      setDragPosition({ x, y: clamp(fy - drag.current.dy) });
    } else {
      const over = bounds.current && contains(bounds.current, px, py);
      event.currentTarget.style.cursor = over ? "move" : "pointer";
    }
  };

  const onPointerUp = () => {
    if (drag.current && dragPosition) onMove(dragPosition);
    drag.current = null;
    setDragPosition(null);
  };

  return (
    <div className="player-area" ref={areaRef}>
      <div className="player-frame" style={{ width: frame.width, height: frame.height }}>
        <video
          ref={(element) => {
            videoRef.current = element;
            if (typeof ref === "function") ref(element);
            else if (ref) ref.current = element;
          }}
          src={src}
          preload="metadata"
          playsInline
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            const size = { width: video.videoWidth, height: video.videoHeight };
            setVideoSize(size);
            setDuration(video.duration);
            onVideoInfo({ ...size, duration: video.duration });
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
          onError={() => setUnsupported(true)}
        />
        <canvas
          ref={canvasRef}
          className="subtitle-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="player-controls" style={{ width: frame.width }}>
        <button type="button" onClick={togglePlay} title={playing ? t("pause") : t("play")}>
          {playing ? "❚❚" : "▶"}
          <span className="visually-hidden">{playing ? t("pause") : t("play")}</span>
        </button>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={time}
          aria-label={t("seek")}
          onChange={(event) => {
            if (videoRef.current) videoRef.current.currentTime = Number(event.target.value);
          }}
        />
        <span className="player-time">
          {formatTime(time).slice(0, -4)} / {formatTime(duration).slice(0, -4)}
        </span>
      </div>
      <p className="hint">{t("drag_hint")}</p>
      {unsupported && <p className="warning">{t("video_unsupported")}</p>}
    </div>
  );
});
