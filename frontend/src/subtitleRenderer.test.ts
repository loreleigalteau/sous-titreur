import { describe, expect, it } from "vitest";
import { layoutSubtitle, wrapText } from "./subtitleRenderer";
import type { Style } from "./types";

// Each character is 1 unit wide.
const measure = (text: string) => text.length;

describe("wrapText", () => {
  it("keeps a short text on one line", () => {
    expect(wrapText("Bonjour à tous", 20, measure)).toEqual(["Bonjour à tous"]);
  });

  it("breaks between words", () => {
    expect(wrapText("un deux trois quatre", 9, measure)).toEqual(["un deux", "trois", "quatre"]);
  });

  it("keeps typed line breaks and squeezes spaces", () => {
    expect(wrapText("ligne  un\n\nligne deux", 50, measure)).toEqual(["ligne un", "ligne deux"]);
  });

  it("gives an over-long word its own line", () => {
    expect(wrapText("a anticonstitutionnellement b", 10, measure)).toEqual([
      "a",
      "anticonstitutionnellement",
      "b",
    ]);
  });
});

describe("layoutSubtitle with the spoken word bigger", () => {
  // A fake canvas: every character is 10 pixels wide.
  const ctx = { font: "", measureText: (t: string) => ({ width: t.length * 10 }) } as unknown as CanvasRenderingContext2D;
  const style = {
    font: "Montserrat", bold: true, size: 0.05, x: 0.5, y: 0.5, max_width: 0.9,
    highlight: true, highlight_scale: 1.5,
  } as Style;

  it("leaves room for each word at the bigger size, so none can touch its neighbour", () => {
    const words = layoutSubtitle(ctx, "Bonjour à tous", style, 1000, 1000).lineWords[0];
    for (let i = 0; i + 1 < words.length; i++) {
      const a = words[i];
      const b = words[i + 1];
      // Right edge of word a and left edge of word b, both enlarged 1.5 times.
      const aRight = a.x + a.width / 2 + (a.width * 1.5) / 2;
      const bLeft = b.x + b.width / 2 - (b.width * 1.5) / 2;
      expect(bLeft - aRight).toBeCloseTo(10); // exactly one space between them
    }
  });

  it("does not change the layout when the highlight is off", () => {
    const words = layoutSubtitle(ctx, "un deux", { ...style, highlight: false }, 1000, 1000).lineWords[0];
    expect(words.map((w) => w.x)).toEqual([500 - 35, 500 - 35 + 30]);
  });
});
