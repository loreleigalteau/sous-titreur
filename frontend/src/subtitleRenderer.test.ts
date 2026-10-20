import { describe, expect, it } from "vitest";
import { wrapText } from "./subtitleRenderer";

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
