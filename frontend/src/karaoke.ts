/**
 * Word by word: what is on screen at each moment of a subtitle.
 *
 * A subtitle is cut into "frames": the words shown (all of them, or a few at a
 * time), and which one is being spoken. The preview and the video export use
 * the same frames, so they match. The server has the same logic for the ASS
 * export (backend/app/karaoke.py): keep both in line.
 */
import type { Segment, Style } from "./types";

export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export interface Frame {
  start: number;
  end: number;
  text: string; // the words on screen, separated by spaces
  highlight: number; // index of the spoken word in `text`, -1 for none
}

/**
 * The words of a subtitle with their times. Whisper's timings are used while
 * they still match the text; after an edit, times are estimated from the
 * position of each word in the text.
 */
export function wordTimes(segment: Segment): TimedWord[] {
  const text = segment.text.trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === segment.words.length) {
    return parts.map((part, i) => ({ text: part, start: segment.words[i].start, end: segment.words[i].end }));
  }
  const duration = Math.max(segment.end - segment.start, 0);
  const total = Math.max(text.length, 1);
  let position = 0;
  return parts.map((part) => {
    const begin = text.indexOf(part, position);
    position = begin + part.length;
    return {
      text: part,
      start: segment.start + (duration * begin) / total,
      end: segment.start + (duration * position) / total,
    };
  });
}

/** The frames of a subtitle, in time order, covering it from start to end. */
export function subtitleFrames(segment: Segment, style: Style): Frame[] {
  const words = wordTimes(segment);
  if (words.length === 0) return [];
  if (!style.highlight && !(style.max_words > 0)) {
    // Nothing word by word: the subtitle as typed, line breaks included.
    return [{ start: segment.start, end: segment.end, text: segment.text, highlight: -1 }];
  }
  const size = style.max_words > 0 ? style.max_words : words.length;
  const groups: TimedWord[][] = [];
  for (let i = 0; i < words.length; i += size) groups.push(words.slice(i, i + size));

  const frames: Frame[] = [];
  groups.forEach((group, g) => {
    // A group stays until the next one starts, so the screen never goes blank
    // in a short pause between two words.
    const groupStart = g === 0 ? segment.start : group[0].start;
    const groupEnd = g + 1 < groups.length ? groups[g + 1][0].start : segment.end;
    const text = group.map((w) => w.text).join(" ");
    if (!style.highlight) {
      frames.push({ start: groupStart, end: groupEnd, text, highlight: -1 });
      return;
    }
    group.forEach((word, w) => {
      frames.push({
        start: w === 0 ? groupStart : word.start,
        end: w + 1 < group.length ? group[w + 1].start : groupEnd,
        text,
        highlight: w,
      });
    });
  });
  return frames.filter((frame) => frame.end > frame.start);
}

/** The frame shown at `time`, or null. */
export function frameAt(frames: Frame[], time: number): Frame | null {
  return frames.find((frame) => time >= frame.start && time < frame.end) ?? null;
}
