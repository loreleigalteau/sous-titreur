import { describe, expect, it } from "vitest";
import { formatTime, parseTime } from "./time";

describe("formatTime", () => {
  it.each([
    [0, "00:00.000"],
    [1.5, "00:01.500"],
    [62.25, "01:02.250"],
    [59.9996, "01:00.000"],
    [3723.456, "1:02:03.456"],
    [-3, "00:00.000"],
  ])("formats %s as %s", (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });
});

describe("parseTime", () => {
  it.each([
    ["62.5", 62.5],
    ["1:02.5", 62.5],
    ["01:02,500", 62.5],
    [" 1:00:00 ", 3600],
    ["0", 0],
  ])("parses %s", (text, expected) => {
    expect(parseTime(text)).toBeCloseTo(expected);
  });

  it.each(["", "abc", "1:2:3:4", "-1", "1.5:00", "1:"])("rejects %j", (text) => {
    expect(parseTime(text)).toBeNull();
  });

  it("round-trips with formatTime", () => {
    for (const seconds of [0, 1.234, 61.5, 3723.456]) {
      expect(parseTime(formatTime(seconds))).toBeCloseTo(seconds);
    }
  });
});
