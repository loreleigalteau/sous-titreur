import { describe, expect, it } from "vitest";
import { format, MESSAGES } from "./index";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const reference = MESSAGES.en;

  for (const [language, messages] of Object.entries(MESSAGES)) {
    it(`${language} has the same placeholders as English`, () => {
      for (const [key, text] of Object.entries(reference)) {
        expect(placeholders(messages[key as keyof typeof reference]), key).toEqual(placeholders(text));
      }
    });
  }
});

describe("format", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(format("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
