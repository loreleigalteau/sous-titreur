import { describe, expect, it } from "vitest";
import { frameAt, subtitleFrames, wordTimes } from "./karaoke";
import type { Segment, Style } from "./types";

const style = { highlight: false, max_words: 0 } as Style;
const segment: Segment = {
  id: 1,
  start: 0,
  end: 4,
  text: "un deux trois quatre",
  words: [
    { text: "un", start: 0.2, end: 0.6 },
    { text: "deux", start: 1, end: 1.5 },
    { text: "trois", start: 2, end: 2.6 },
    { text: "quatre", start: 3, end: 3.8 },
  ],
};

describe("wordTimes", () => {
  it("uses Whisper's timings while they match the text", () => {
    expect(wordTimes(segment).map((w) => w.start)).toEqual([0.2, 1, 2, 3]);
  });

  it("estimates the times of an edited text from the position of each word", () => {
    const edited = { ...segment, text: "aa bb", words: segment.words };
    const words = wordTimes(edited);
    expect(words.map((w) => w.text)).toEqual(["aa", "bb"]);
    expect(words[0].start).toBe(0);
    expect(words[1].start).toBeCloseTo(4 * (3 / 5));
    expect(words[1].end).toBe(4);
  });
});

describe("subtitleFrames", () => {
  it("shows the whole subtitle when nothing is set", () => {
    expect(subtitleFrames(segment, style)).toEqual([
      { start: 0, end: 4, text: "un deux trois quatre", highlight: -1 },
    ]);
  });

  it("keeps the line breaks typed by the user", () => {
    const typed = { ...segment, text: "un deux\ntrois quatre" };
    expect(subtitleFrames(typed, style)[0].text).toBe("un deux\ntrois quatre");
  });

  it("highlights each word until the next one starts", () => {
    const frames = subtitleFrames(segment, { ...style, highlight: true });
    expect(frames.map((f) => [f.start, f.end, f.highlight])).toEqual([
      [0, 1, 0], // from the subtitle's start
      [1, 2, 1],
      [2, 3, 2],
      [3, 4, 3], // until the subtitle's end
    ]);
    expect(new Set(frames.map((f) => f.text))).toEqual(new Set(["un deux trois quatre"]));
  });

  it("shows a few words at a time", () => {
    const frames = subtitleFrames(segment, { ...style, max_words: 3 });
    expect(frames).toEqual([
      { start: 0, end: 3, text: "un deux trois", highlight: -1 },
      { start: 3, end: 4, text: "quatre", highlight: -1 },
    ]);
  });

  it("combines both", () => {
    const frames = subtitleFrames(segment, { ...style, highlight: true, max_words: 2 });
    expect(frames.map((f) => `${f.text}#${f.highlight}@${f.start}`)).toEqual([
      "un deux#0@0",
      "un deux#1@1",
      "trois quatre#0@2",
      "trois quatre#1@3",
    ]);
  });

  it("finds the frame at a given time", () => {
    const frames = subtitleFrames(segment, { ...style, highlight: true });
    expect(frameAt(frames, 2.5)?.highlight).toBe(2);
    expect(frameAt(frames, 5)).toBeNull();
  });

  it("an empty subtitle has no frame", () => {
    expect(subtitleFrames({ ...segment, text: "  " }, style)).toEqual([]);
  });
});
