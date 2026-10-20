/**
 * Timing operations: moving subtitles on the timeline, shifting them all,
 * and finding the previous / next subtitle from the playhead.
 * The list of subtitles is assumed to be in time order.
 */
import type { Segment } from "./types";

// Shortest subtitle that can be made by resizing, in seconds.
export const MIN_DURATION = 0.1;

export interface Span {
  start: number;
  end: number;
}

/**
 * Where a subtitle dropped on the timeline really goes: it snaps to the edges
 * of its neighbours when close to them (`snap`, in seconds) and never
 * overlaps them. Whether it was moved or resized is deduced from which edges
 * changed.
 */
export function placeOnTimeline(segments: Segment[], index: number, wanted: Span, snap: number): Span {
  const current = segments[index];
  const before = segments[index - 1];
  const after = segments[index + 1];
  const floor = before ? before.end : 0;
  const ceiling = after ? after.start : Infinity;
  const near = (a: number, b: number) => Math.abs(a - b) <= snap;

  const moved = Math.abs(wanted.end - wanted.start - (current.end - current.start)) < 1e-6;
  if (moved) {
    const duration = wanted.end - wanted.start;
    let start = wanted.start;
    if (before && near(start, floor)) start = floor;
    else if (after && near(start + duration, ceiling)) start = ceiling - duration;
    // Keep it between its neighbours (if the gap is too small, against the previous one).
    start = Math.max(floor, Math.min(start, ceiling - duration));
    return { start, end: start + duration };
  }

  let { start, end } = wanted;
  if (start !== current.start) {
    if (before && near(start, floor)) start = floor;
    start = Math.min(Math.max(start, floor), end - MIN_DURATION);
  }
  if (end !== current.end) {
    if (after && near(end, ceiling)) end = ceiling;
    end = Math.max(Math.min(end, ceiling), start + MIN_DURATION);
  }
  return { start, end };
}

/**
 * Shift subtitles by `offset` seconds, from `fromIndex` to the end. A negative
 * shift is limited so that no subtitle starts before 0.
 */
export function shiftSegments(segments: Segment[], offset: number, fromIndex = 0): Segment[] {
  const moved = segments.slice(fromIndex);
  if (moved.length === 0 || offset === 0) return segments;
  const earliest = Math.min(...moved.map((s) => s.start));
  const applied = Math.max(offset, -earliest);
  if (applied === 0) return segments;
  const shift = (t: number) => t + applied;
  return [
    ...segments.slice(0, fromIndex),
    ...moved.map((s) => ({
      ...s,
      start: shift(s.start),
      end: shift(s.end),
      words: s.words.map((w) => ({ ...w, start: shift(w.start), end: shift(w.end) })),
    })),
  ];
}

/** First subtitle starting after `time`, or -1. */
export function nextSegmentIndex(segments: Segment[], time: number): number {
  return segments.findIndex((s) => s.start > time + 0.001);
}

/**
 * Subtitle to go back to: the start of the current one, unless we are at its
 * very beginning, in which case the one before.
 */
export function previousSegmentIndex(segments: Segment[], time: number): number {
  let found = -1;
  segments.forEach((s, i) => {
    if (s.start < time - 0.25) found = i;
  });
  return found;
}

/**
 * Set the start ("[") or the end ("]") of a subtitle to the playhead.
 * The subtitle is the one being shown, otherwise the next one for a start
 * and the last one started for an end. Returns null if there is none or if
 * the result would be invalid.
 */
export function markAtPlayhead(
  segments: Segment[],
  time: number,
  edge: "start" | "end",
): { index: number; span: Span } | null {
  const active = segments.findIndex((s) => time >= s.start && time < s.end);
  let index = active;
  if (index === -1) {
    index = edge === "start" ? nextSegmentIndex(segments, time) : previousSegmentIndex(segments, time + 0.25);
  }
  if (index === -1) return null;
  const { start, end } = segments[index];
  if (edge === "start") {
    if (time >= end - MIN_DURATION) return null;
    return { index, span: { start: time, end } };
  }
  if (time <= start + MIN_DURATION) return null;
  return { index, span: { start, end: time } };
}
