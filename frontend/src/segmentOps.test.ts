import { describe, expect, it } from "vitest";
import { insertSegment, mergeSegments, nextId, splitSegment } from "./segmentOps";
import type { Segment } from "./types";

const timed: Segment = {
  id: 1,
  start: 0,
  end: 4,
  text: "un deux trois quatre",
  words: [
    { text: "un", start: 0, end: 1 },
    { text: "deux", start: 1, end: 2 },
    { text: "trois", start: 2.2, end: 3 },
    { text: "quatre", start: 3, end: 4 },
  ],
};

describe("splitSegment", () => {
  it("cuts at the cursor using the word timings", () => {
    const [a, b] = splitSegment(timed, 8, 7)!; // after "un deux "
    expect(a).toMatchObject({ id: 1, start: 0, end: 2.2, text: "un deux" });
    expect(b).toMatchObject({ id: 7, start: 2.2, end: 4, text: "trois quatre" });
    expect(a.words.map((w) => w.text)).toEqual(["un", "deux"]);
    expect(b.words.map((w) => w.text)).toEqual(["trois", "quatre"]);
  });

  it("estimates the time when the text was edited", () => {
    const edited = { ...timed, text: "un deux trois quatre cinq" };
    const [a, b] = splitSegment(edited, 10, 2)!;
    expect(a.end).toBeCloseTo(1.6);
    expect(b.start).toBeCloseTo(1.6);
  });

  it("refuses to create an empty subtitle", () => {
    expect(splitSegment(timed, 0, 2)).toBeNull();
    expect(splitSegment(timed, timed.text.length, 2)).toBeNull();
    expect(splitSegment(timed, 2, 2)).not.toBeNull();
  });
});

it("mergeSegments joins texts and times", () => {
  const second: Segment = { id: 2, start: 4, end: 6, text: " cinq", words: [{ text: "cinq", start: 4, end: 6 }] };
  expect(mergeSegments(timed, second)).toMatchObject({
    id: 1,
    start: 0,
    end: 6,
    text: "un deux trois quatre cinq",
  });
});

describe("insertSegment", () => {
  const list: Segment[] = [
    { id: 1, start: 0, end: 1, text: "a", words: [] },
    { id: 2, start: 5, end: 6, text: "b", words: [] },
  ];

  it("inserts in time order with a 2-second duration when there is room", () => {
    const [result, index] = insertSegment(list, 1.5, 3);
    expect(index).toBe(1);
    expect(result[1]).toMatchObject({ id: 3, start: 1.5, end: 3.5, text: "" });
  });

  it("stops at the next subtitle", () => {
    const [result] = insertSegment(list, 4, 3);
    expect(result[1]).toMatchObject({ start: 4, end: 5 });
  });

  it("adds at the end and works on an empty list", () => {
    expect(insertSegment(list, 10, 3)[1]).toBe(2);
    expect(insertSegment([], 0, 1)[0]).toHaveLength(1);
  });
});

it("nextId", () => {
  expect(nextId([])).toBe(1);
  expect(nextId([{ ...timed, id: 9 }, timed])).toBe(10);
});
