import { describe, expect, it } from "vitest";
import { matchingPreset, sameStyle } from "./presets";
import type { Preset, Style } from "./types";

const base: Style = {
  font: "Montserrat", bold: true, size: 0.038, text_color: "#ffff00", outline_color: "#000000",
  outline_width: 0.002, background: false, background_color: "#000000", background_opacity: 0.6,
  highlight_color: "#ffd700", highlight: false, highlight_scale: 1, max_words: 0, x: 0.5, y: 0.83, max_width: 0.9,
};
const preset = (id: string, change: Partial<Style> = {}): Preset => ({ id, name: id, style: { ...base, ...change } });

describe("sameStyle", () => {
  it("compares every setting, position included", () => {
    expect(sameStyle(base, { ...base })).toBe(true);
    expect(sameStyle(base, { ...base, y: 0.5 })).toBe(false);
    expect(sameStyle(base, { ...base, font: "Anton" })).toBe(false);
  });

  it("ignores tiny rounding differences", () => {
    expect(sameStyle(base, { ...base, size: 0.038 + 1e-12 })).toBe(true);
  });
});

describe("matchingPreset", () => {
  const presets = [preset("builtin:social"), preset("mine"), preset("other", { text_color: "#ffffff" })];

  it("finds the preset with the same settings, preferring the user's own", () => {
    expect(matchingPreset(base, presets, null)?.id).toBe("mine");
  });

  it("prefers the preset the user just chose", () => {
    expect(matchingPreset(base, presets, "builtin:social")?.id).toBe("builtin:social");
  });

  it("returns null for settings that match no preset", () => {
    expect(matchingPreset({ ...base, size: 0.1 }, presets, null)).toBeNull();
  });
});
