/**
 * Editing operations on subtitles: split, merge, add.
 * They return new objects and never modify their input.
 */
import type { Segment, Word } from "./types";

// Duration of a subtitle added by hand, when there is room for it.
const NEW_SEGMENT_DURATION = 2;

export function nextId(segments: Segment[]): number {
  return segments.reduce((max, s) => Math.max(max, s.id), 0) + 1;
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Split a subtitle at a position in its text. The time of the cut comes from
 * the word timings when they still match the text, otherwise it is estimated
 * in proportion to the text length. Returns null if one side would be empty.
 */
export function splitSegment(segment: Segment, cursor: number, newId: number): [Segment, Segment] | null {
  const before = segment.text.slice(0, cursor).trimEnd();
  const after = segment.text.slice(cursor).trimStart();
  if (!before || !after) return null;

  let time: number;
  let firstWords: Word[];
  let secondWords: Word[];
  const words = segment.words;
  if (words.length > 1 && words.length === countWords(segment.text)) {
    // A cut in the middle of a word counts that word in the first part.
    const n = Math.min(countWords(before), words.length - 1);
    time = words[n].start;
    firstWords = words.slice(0, n);
    secondWords = words.slice(n);
  } else {
    time = segment.start + ((segment.end - segment.start) * cursor) / segment.text.length;
    firstWords = words.filter((w) => w.start < time);
    secondWords = words.filter((w) => w.start >= time);
  }
  return [
    { ...segment, end: time, text: before, words: firstWords },
    { id: newId, start: time, end: segment.end, text: after, words: secondWords },
  ];
}

/** Merge a subtitle with the one that follows it. */
export function mergeSegments(first: Segment, second: Segment): Segment {
  return {
    id: first.id,
    start: Math.min(first.start, second.start),
    end: Math.max(first.end, second.end),
    text: `${first.text.trimEnd()} ${second.text.trimStart()}`.trim(),
    words: [...first.words, ...second.words],
  };
}

/**
 * Insert an empty subtitle starting at `time`, keeping the list in time order.
 * It lasts up to two seconds, without running into the next subtitle when
 * there is room. Returns the new list and the index of the new subtitle.
 */
export function insertSegment(segments: Segment[], time: number, newId: number): [Segment[], number] {
  let index = segments.findIndex((s) => s.start > time);
  if (index === -1) index = segments.length;
  const next = segments[index];
  const room = next ? next.start - time : Infinity;
  const end = time + (room >= 0.5 ? Math.min(room, NEW_SEGMENT_DURATION) : NEW_SEGMENT_DURATION);
  const segment: Segment = { id: newId, start: time, end, text: "", words: [] };
  return [[...segments.slice(0, index), segment, ...segments.slice(index)], index];
}
