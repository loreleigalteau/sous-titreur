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

/** A word of a line, positioned on the canvas. */
export interface PlacedWord {
  text: string;
  x: number; // left edge
  width: number;
}

export interface Layout {
  lines: string[];
  /** The words of each line, with their positions (for the word-by-word highlight). */
  lineWords: PlacedWord[][];
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
  const measure = (t: string) => ctx.measureText(t).width;
  const space = measure(" ");
  // With "spoken word bigger", every word gets the room it needs at the bigger
  // size: the spoken word never touches its neighbours, and the words do not
  // move when the highlight goes from one to the next.
  const scale = style.highlight ? Math.max(1, style.highlight_scale) : 1;
  const slot = (word: string) => measure(word) * scale;
  const widthOf = (line: string) => {
    if (scale === 1) return measure(line);
    const words = line.split(" ");
    return words.reduce((sum, word) => sum + slot(word), 0) + space * (words.length - 1);
  };

  const lines = wrapText(text, style.max_width * width, widthOf);
  const lineHeight = fontSize * LINE_HEIGHT;
  const centerX = style.x * width;
  const top = style.y * height - (lines.length * lineHeight) / 2;
  const lineCenters = lines.map((_, i) => top + (i + 0.5) * lineHeight);
  const padX = fontSize * PADDING_X;
  const padY = fontSize * PADDING_Y;
  const lineBoxes = lines.map((line, i) => {
    const lineWidth = widthOf(line);
    return {
      x: centerX - lineWidth / 2 - padX,
      y: lineCenters[i] - lineHeight / 2 - padY,
      width: lineWidth + 2 * padX,
      height: lineHeight + 2 * padY,
    };
  });
  const lineWords = lines.map((line) => {
    const words = line.split(" ");
    if (scale === 1) {
      // Each word starts where the text before it (and its space) ends.
      const lineLeft = centerX - measure(line) / 2;
      return words.map((word, i) => ({
        text: word,
        x: lineLeft + (i === 0 ? 0 : measure(words.slice(0, i).join(" ") + " ")),
        width: measure(word),
      }));
    }
    // Each word is centred in its slot.
    let cursor = centerX - widthOf(line) / 2;
    return words.map((word) => {
      const wordWidth = measure(word);
      const placed = { text: word, x: cursor + (slot(word) - wordWidth) / 2, width: wordWidth };
      cursor += slot(word) + space;
      return placed;
    });
  });
  const left = Math.min(...lineBoxes.map((b) => b.x));
  const right = Math.max(...lineBoxes.map((b) => b.x + b.width));
  const bounds = lines.length
    ? { x: left, y: lineBoxes[0].y, width: right - left, height: lineBoxes.length * lineHeight + 2 * padY }
    : { x: centerX, y: style.y * height, width: 0, height: 0 };
  return { lines, lineWords, font, lineHeight, centerX, lineCenters, lineBoxes, bounds };
}

function rgba(hex: string, opacity: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
}

/**
 * Draw a subtitle. `highlight` is the index of the spoken word (counting the
 * words of all lines in order), or -1 for none.
 */
export function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  style: Style,
  height: number,
  highlight = -1,
): void {
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
  // The stroke is centred on the letter edges: twice the width gives an
  // outline of the requested thickness outside the letters.
  ctx.lineWidth = outline * 2;
  ctx.lineJoin = "round";
  ctx.strokeStyle = style.outline_color;
  const draw = (text: string, x: number, y: number, color: string) => {
    if (outline > 0) ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };

  if (highlight < 0) {
    // Whole lines at once.
    layout.lines.forEach((line, i) => draw(line, layout.centerX, layout.lineCenters[i], style.text_color));
    ctx.restore();
    return;
  }

  // Word by word: every word at its place, the spoken one last, on top.
  ctx.textAlign = "left";
  let spoken: { word: PlacedWord; y: number } | null = null;
  let index = 0;
  layout.lineWords.forEach((words, i) => {
    for (const word of words) {
      if (index === highlight) spoken = { word, y: layout.lineCenters[i] };
      else draw(word.text, word.x, layout.lineCenters[i], style.text_color);
      index += 1;
    }
  });
  if (spoken) {
    const { word, y } = spoken as { word: PlacedWord; y: number };
    // Bigger, it grows from its centre: the other words do not move.
    ctx.font = fontCss(style, style.size * height * style.highlight_scale);
    ctx.textAlign = "center";
    draw(word.text, word.x + word.width / 2, y, style.highlight_color);
  }
  ctx.restore();
}

/** Make sure the style's font is loaded before drawing with it. */
export async function loadFont(style: Style): Promise<void> {
  await document.fonts.load(fontCss(style, 40));
}
