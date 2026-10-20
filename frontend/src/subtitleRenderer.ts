/**
 * Drawing a subtitle on a canvas.
 *
 * The same code draws the preview over the video and the images burned into
 * the exported video, so the export looks exactly like the preview. All sizes
 * come from the style as fractions of the video height, so the result is the
 * same at any scale.
 */
import type { Style } from "./types";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  lines: string[];
  font: string; // CSS font shorthand
  lineHeight: number;
  centerX: number;
  /** Vertical center of each line. */
  lineCenters: number[];
  /** Background box of each line (also used to grab the subtitle with the mouse). */
  lineBoxes: Box[];
  bounds: Box;
}

const LINE_HEIGHT = 1.25; // times the font size
const PADDING_X = 0.3; // around each line when there is a background, times the font size
const PADDING_Y = 0.08;

export function fontCss(style: Style, pixels: number): string {
  return `${style.bold ? 700 : 400} ${pixels}px "${style.font}"`;
}

/**
 * Break a text into lines no wider than `maxWidth`. Line breaks typed by the
 * user are kept; a single word wider than the limit gets a line of its own.
 */
export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function layoutSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: Style,
  width: number,
  height: number,
): Layout {
  const fontSize = style.size * height;
  const font = fontCss(style, fontSize);
  ctx.font = font;
  const lines = wrapText(text, style.max_width * width, (t) => ctx.measureText(t).width);
  const lineHeight = fontSize * LINE_HEIGHT;
  const centerX = style.x * width;
  const top = style.y * height - (lines.length * lineHeight) / 2;
  const lineCenters = lines.map((_, i) => top + (i + 0.5) * lineHeight);
  const padX = fontSize * PADDING_X;
  const padY = fontSize * PADDING_Y;
  const lineBoxes = lines.map((line, i) => {
    const lineWidth = ctx.measureText(line).width;
    return {
      x: centerX - lineWidth / 2 - padX,
      y: lineCenters[i] - lineHeight / 2 - padY,
      width: lineWidth + 2 * padX,
      height: lineHeight + 2 * padY,
    };
  });
  const left = Math.min(...lineBoxes.map((b) => b.x));
  const right = Math.max(...lineBoxes.map((b) => b.x + b.width));
  const bounds = lines.length
    ? { x: left, y: lineBoxes[0].y, width: right - left, height: lineBoxes.length * lineHeight + 2 * padY }
    : { x: centerX, y: style.y * height, width: 0, height: 0 };
  return { lines, font, lineHeight, centerX, lineCenters, lineBoxes, bounds };
}

function rgba(hex: string, opacity: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

export function drawSubtitle(ctx: CanvasRenderingContext2D, layout: Layout, style: Style, height: number): void {
  ctx.save();
  ctx.font = layout.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (style.background) {
    ctx.fillStyle = rgba(style.background_color, style.background_opacity);
    const radius = style.size * height * 0.15;
    for (const box of layout.lineBoxes) {
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.width, box.height, radius);
      ctx.fill();
    }
  }

  const outline = style.outline_width * height;
  layout.lines.forEach((line, i) => {
    const y = layout.lineCenters[i];
    if (outline > 0) {
      // The stroke is centred on the letter edges: twice the width gives an
      // outline of the requested thickness outside the letters.
      ctx.lineWidth = outline * 2;
      ctx.lineJoin = "round";
      ctx.strokeStyle = style.outline_color;
      ctx.strokeText(line, layout.centerX, y);
    }
    ctx.fillStyle = style.text_color;
    ctx.fillText(line, layout.centerX, y);
  });
  ctx.restore();
}

/** Make sure the style's font is loaded before drawing with it. */
export async function loadFont(style: Style): Promise<void> {
  await document.fonts.load(fontCss(style, 40));
}
