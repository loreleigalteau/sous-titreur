import { describe, expect, it } from "vitest";
import { markAtPlayhead, nextSegmentIndex, placeOnTimeline, previousSegmentIndex, shiftSegments } from "./timing";
import type { Segment } from "./types";

const seg = (id: number, start: number, end: number): Segment => ({ id, start, end, text: `s${id}`, words: [] });
// Three subtitles with gaps: [1-2] [3-4] [6-7]
const list = [seg(1, 1, 2), seg(2, 3, 4), seg(3, 6, 7)];

describe("placeOnTimeline", () => {
  it("moves freely in the gap", () => {
    expect(placeOnTimeline(list, 1, { start: 3.5, end: 4.5 }, 0.05)).toEqual({ start: 3.5, end: 4.5 });
  });

  it("snaps to the previous subtitle's end", () => {
    expect(placeOnTimeline(list, 1, { start: 2.08, end: 3.08 }, 0.1)).toEqual({ start: 2, end: 3 });
  });

  it("snaps to the next subtitle's start", () => {
    expect(placeOnTimeline(list, 1, { start: 4.95, end: 5.95 }, 0.1)).toEqual({ start: 5, end: 6 });
  });

  it("never overlaps a neighbour", () => {
    expect(placeOnTimeline(list, 1, { start: 1.2, end: 2.2 }, 0.05)).toEqual({ start: 2, end: 3 });
    expect(placeOnTimeline(list, 1, { start: 5.8, end: 6.8 }, 0.05)).toEqual({ start: 5, end: 6 });
  });

  it("does not go below zero", () => {
    expect(placeOnTimeline(list, 0, { start: -0.5, end: 0.5 }, 0.05)).toEqual({ start: 0, end: 1 });
  });

  it("resizes the start with snapping and limits", () => {
    expect(placeOnTimeline(list, 1, { start: 2.5, end: 4 }, 0.05)).toEqual({ start: 2.5, end: 4 });
    expect(placeOnTimeline(list, 1, { start: 2.04, end: 4 }, 0.05)).toEqual({ start: 2, end: 4 });
    expect(placeOnTimeline(list, 1, { start: 1.5, end: 4 }, 0.05)).toEqual({ start: 2, end: 4 });
  });

  it("resizes the end with snapping and limits", () => {
    expect(placeOnTimeline(list, 1, { start: 3, end: 5.97 }, 0.05)).toEqual({ start: 3, end: 6 });
    expect(placeOnTimeline(list, 1, { start: 3, end: 6.5 }, 0.05)).toEqual({ start: 3, end: 6 });
    expect(placeOnTimeline(list, 1, { start: 3, end: 3.01 }, 0.05).end).toBeCloseTo(3.1);
  });

  it("the last subtitle can grow freely", () => {
    expect(placeOnTimeline(list, 2, { start: 6, end: 9 }, 0.05)).toEqual({ start: 6, end: 9 });
  });
});

describe("shiftSegments", () => {
  it("shifts everything, words included", () => {
    const withWords = [{ ...seg(1, 1, 2), words: [{ text: "a", start: 1, end: 2 }] }];
    expect(shiftSegments(withWords, 0.5)[0]).toMatchObject({ start: 1.5, end: 2.5, words: [{ start: 1.5, end: 2.5 }] });
  });

  it("shifts only from an index", () => {
    expect(shiftSegments(list, 1, 1).map((s) => s.start)).toEqual([1, 4, 7]);
  });

  it("never goes before zero", () => {
    expect(shiftSegments(list, -5).map((s) => s.start)).toEqual([0, 2, 5]);
  });

  it("returns the same list when nothing changes", () => {
    expect(shiftSegments(list, 0)).toBe(list);
    expect(shiftSegments([seg(1, 0, 1)], -1)).toEqual([seg(1, 0, 1)]);
  });
});

describe("navigation", () => {
  it("finds the next subtitle", () => {
    expect(nextSegmentIndex(list, 0)).toBe(0);
    expect(nextSegmentIndex(list, 1)).toBe(1);
    expect(nextSegmentIndex(list, 6.5)).toBe(-1);
  });

  it("goes back to the start of the current subtitle, or to the previous one", () => {
    expect(previousSegmentIndex(list, 3.8)).toBe(1);
    expect(previousSegmentIndex(list, 3.1)).toBe(0);
    expect(previousSegmentIndex(list, 0.5)).toBe(-1);
  });
});

describe("markAtPlayhead", () => {
  it("sets the start or end of the subtitle being shown", () => {
    expect(markAtPlayhead(list, 3.5, "start")).toEqual({ index: 1, span: { start: 3.5, end: 4 } });
    expect(markAtPlayhead(list, 3.5, "end")).toEqual({ index: 1, span: { start: 3, end: 3.5 } });
  });

  it("between subtitles: start of the next one, end of the previous one", () => {
    expect(markAtPlayhead(list, 5, "start")).toEqual({ index: 2, span: { start: 5, end: 7 } });
    expect(markAtPlayhead(list, 5, "end")).toEqual({ index: 1, span: { start: 3, end: 5 } });
  });

  it("refuses an invalid result", () => {
    expect(markAtPlayhead(list, 8, "start")).toBeNull();
    expect(markAtPlayhead(list, 0.5, "end")).toBeNull();
  });
});
